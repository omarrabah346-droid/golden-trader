begin;

-- Call with the end user's authenticated session for every protected V2 operation.
-- The boolean grants access to a paid feature only. Admin authorization is separate.
create function public.vx_sub_v2_can_access(p_feature text)
returns boolean
language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from public.vx_sub_v2_my_status() s
    where s.state='active' and p_feature=any(s.features)
  );
$$;

revoke all on function public.vx_sub_v2_can_access(text) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_can_access(text) to authenticated;

commit;
