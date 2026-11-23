-- Apply separately only at V2 cutover after auditing other grant writers.
begin;
create function vx_sub_v2.block_legacy_paid_transition()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.status in ('paid','done') then
    if tg_op='INSERT' then
      raise exception 'Legacy payment approval disabled';
    end if;
    if old.status not in ('paid','done') or old.status is null then
      raise exception 'Legacy payment approval disabled';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function vx_sub_v2.block_legacy_paid_transition() from public,anon,authenticated,service_role;
create trigger zzzz_vx_sub_v2_block_legacy_paid before insert or update on public.purchases
for each row execute function vx_sub_v2.block_legacy_paid_transition();
commit;
