begin;
-- A narrow read of the current academy monthly-access rule. Scope remains
-- academy until the actual admin_grant implementation and audience are known.
create function public.vx_sub_v2_legacy_academy_until()
returns timestamptz language sql stable security invoker set search_path='' as $$
  select max(p.expires_at)
  from public.purchases p
  where p.user_id=auth.uid() and p.kind='monthly'
    and p.status in ('paid','done') and p.expires_at>statement_timestamp();
$$;
revoke all on function public.vx_sub_v2_legacy_academy_until() from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_legacy_academy_until() to authenticated;
commit;
