begin;

-- Caller-scoped reader. Monthly never implies VIP, indicators, marketing or AI.
create function public.vx_sub_v2_has_legacy_grant(p_feature text,p_course text default null)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists (
    select 1 from public.purchases p
    where p.user_id=auth.uid() and p.pay_ref='GRANT' and p.amount=0 and p.status='paid'
      and (
        (p_feature='academy' and p.kind='monthly' and p.expires_at>statement_timestamp())
        or (p_feature='academy' and p.kind='course' and p.course_id=p_course
          and (p.expires_at is null or p.expires_at>statement_timestamp()))
        or (p_feature='ai' and p.kind='ai' and p.expires_at>statement_timestamp())
      )
  );
$$;
revoke all on function public.vx_sub_v2_has_legacy_grant(text,text) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_has_legacy_grant(text,text) to authenticated;

-- Preserve the legacy signature without its non-GRANT expiry fallback.
create or replace function public.admin_revoke(pid bigint)
returns void language plpgsql security definer set search_path='' as $$
begin
  if public.has_perm('payments') is distinct from true then
    raise exception 'Payment permission required' using errcode='42501';
  end if;
  delete from public.purchases p
  where p.id=pid and p.pay_ref='GRANT' and p.amount=0 and p.kind in ('monthly','ai','course');
end;
$$;
revoke all on function public.admin_revoke(bigint) from public,anon;
grant execute on function public.admin_revoke(bigint) to authenticated;

commit;
