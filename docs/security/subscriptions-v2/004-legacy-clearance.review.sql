begin;

-- Staging review only. Populate through a reviewed legacy adapter using verified
-- data before enabling any order approval. Missing clearance denies settlement.
create table vx_sub_v2.activation_clearance (
  user_id uuid primary key,
  legacy_expires_at timestamptz,
  approved_by uuid not null,
  approved_at timestamptz not null default clock_timestamp(),
  evidence_ref text not null check(length(trim(evidence_ref)) between 1 and 300)
);

alter table vx_sub_v2.activation_clearance enable row level security;
revoke all on vx_sub_v2.activation_clearance from public,anon,authenticated,service_role;

-- Canonical references of already-accounted legacy payments, populated only
-- after evidence reconciliation. The V2 settlements unique key remains in force.
create table vx_sub_v2.legacy_payment_reservations (
  payment_key text primary key,
  evidence_ref text not null check(length(trim(evidence_ref)) between 1 and 300)
);
alter table vx_sub_v2.legacy_payment_reservations enable row level security;
revoke all on vx_sub_v2.legacy_payment_reservations from public,anon,authenticated,service_role;

create function public.vx_sub_v2_clear_activation(p_user uuid, p_legacy_expiry timestamptz, p_evidence_ref text)
returns void language plpgsql security definer set search_path='' as $$
declare v_owner uuid := vx_sub_v2.require_owner();
begin
  if p_legacy_expiry is not null and (not isfinite(p_legacy_expiry) or p_legacy_expiry > clock_timestamp()) then
    raise exception 'Legacy term must finish before migration';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,81921));
  insert into vx_sub_v2.activation_clearance(user_id,legacy_expires_at,approved_by,evidence_ref)
    values (p_user,p_legacy_expiry,v_owner,p_evidence_ref);
end;
$$;
revoke all on function public.vx_sub_v2_clear_activation(uuid,timestamptz,text) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_clear_activation(uuid,timestamptz,text) to authenticated;
grant insert on vx_sub_v2.activation_clearance to vx_sub_v2_executor;
create policy executor_insert on vx_sub_v2.activation_clearance for insert to vx_sub_v2_executor with check(true);
grant create on schema public to vx_sub_v2_executor;
alter function public.vx_sub_v2_clear_activation(uuid,timestamptz,text) owner to vx_sub_v2_executor;
revoke create on schema public from vx_sub_v2_executor;

create function vx_sub_v2.verify_activation_settlement() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from vx_sub_v2.legacy_payment_reservations r where r.payment_key=new.payment_key) then
    raise exception 'Payment already accounted for by the legacy system';
  end if;
  if exists(select 1 from vx_sub_v2.orders o where o.id=new.order_id and o.kind='initial')
    and not exists (
      select 1 from vx_sub_v2.orders o
      join vx_sub_v2.activation_clearance c on c.user_id=o.user_id
      where o.id=new.order_id
        and (c.legacy_expires_at is null or c.legacy_expires_at<=new.approved_at)
    ) then
    raise exception 'Owner activation clearance required';
  end if;
  return new;
end;
$$;
revoke all on function vx_sub_v2.verify_activation_settlement() from public,anon,authenticated,service_role;
create trigger verify_activation_settlement before insert on vx_sub_v2.settlements
for each row execute function vx_sub_v2.verify_activation_settlement();

commit;
