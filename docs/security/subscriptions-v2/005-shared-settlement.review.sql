begin;

-- Stop all settlement writers while backfilling and enabling the shared claim.
lock table vx_sub_v2.legacy_payment_reservations, vx_sub_v2.settlements in access exclusive mode;
create table vx_sub_v2.payment_claims (
  payment_key text primary key check (
    length(payment_key)<=300 and payment_key ~ '^[a-z0-9_-]+:[a-z0-9_-]+:[A-Za-z0-9._:-]+$'
  ),
  source text not null check(source in ('legacy','v2')),
  source_ref text not null check(length(trim(source_ref)) between 1 and 300),
  claimed_at timestamptz not null default clock_timestamp()
);
alter table vx_sub_v2.payment_claims enable row level security;
revoke all on vx_sub_v2.payment_claims from public,anon,authenticated,service_role;

-- Abort on historical overlap rather than choosing a winner during migration.
insert into vx_sub_v2.payment_claims(payment_key,source,source_ref)
select payment_key,'legacy',evidence_ref from vx_sub_v2.legacy_payment_reservations
union all
select payment_key,'v2',order_id::text from vx_sub_v2.settlements;

-- Private integration contract. Invoke inside the same transaction as legacy
-- approval, after its own owner and payment checks. Decide grants after auditing
-- the real legacy writer. Exact retries are handled by the writer before claiming.
create function vx_sub_v2.claim_legacy_payment(p_payment_key text,p_source_ref text)
returns void language sql security definer set search_path='' as $$
  insert into vx_sub_v2.payment_claims(payment_key,source,source_ref)
  values(p_payment_key,'legacy',p_source_ref);
$$;
revoke all on function vx_sub_v2.claim_legacy_payment(text,text) from public,anon,authenticated,service_role;

create function vx_sub_v2.claim_v2_payment() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into vx_sub_v2.payment_claims(payment_key,source,source_ref)
    values(new.payment_key,'v2',new.order_id::text);
  return new;
end;
$$;
revoke all on function vx_sub_v2.claim_v2_payment() from public,anon,authenticated,service_role;
create trigger claim_v2_payment after insert on vx_sub_v2.settlements
for each row execute function vx_sub_v2.claim_v2_payment();

commit;
