begin;
create table vx_sub_v2.free_grants (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  starts_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  check (isfinite(expires_at) and expires_at > starts_at)
);
alter table vx_sub_v2.free_grants enable row level security;
revoke all on vx_sub_v2.free_grants from public,anon,authenticated,service_role;

create function public.vx_sub_v2_manage_grant(p_user uuid, p_action text,
  p_grant bigint default null,p_expiry timestamptz default null)
returns bigint language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid := vx_sub_v2.require_owner();
  v_now timestamptz;
  v_id bigint;
begin
  if p_user is null then raise exception 'User required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,81921));
  v_now := clock_timestamp();
  if p_action in ('create','extend') and
    (p_expiry is null or not isfinite(p_expiry) or p_expiry<=v_now) then
    raise exception 'Future finite expiry required';
  end if;
  case p_action
    when 'create' then
      if p_grant is not null then raise exception 'Unexpected grant ID'; end if;
      insert into vx_sub_v2.free_grants(user_id,starts_at,expires_at)
      values(p_user,v_now,p_expiry) returning id into v_id;
    when 'extend' then
      update vx_sub_v2.free_grants set expires_at=p_expiry
      where id=p_grant and user_id=p_user and revoked_at is null
        and expires_at>v_now and expires_at<p_expiry returning id into v_id;
    when 'revoke' then
      update vx_sub_v2.free_grants set revoked_at=coalesce(revoked_at,v_now)
      where id=p_grant and user_id=p_user and p_expiry is null returning id into v_id;
    else raise exception 'Unknown grant action';
  end case;
  if v_id is null then raise exception 'Grant transition unavailable'; end if;
  return v_id;
end;
$$;

create function public.vx_sub_v2_owner_grants(p_user uuid)
returns table(id bigint, starts_at timestamptz,expires_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_owner();
  return query select g.id,g.starts_at,g.expires_at,g.revoked_at
  from vx_sub_v2.free_grants g where g.user_id=p_user order by g.id desc;
end;
$$;

create function public.vx_sub_v2_has_free_grant(p_feature text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_feature=any(array['academy','vip','indicators','marketing','ai','extras']::text[])
    and exists (select 1 from vx_sub_v2.free_grants g
      where g.user_id=auth.uid() and g.revoked_at is null
        and g.starts_at<=statement_timestamp() and g.expires_at>statement_timestamp());
$$;

create or replace function public.vx_sub_v2_can_access(p_feature text)
returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(public.vx_sub_v2_has_free_grant(p_feature),false) or exists (
    select 1 from public.vx_sub_v2_my_status() s
    where s.state='active' and p_feature=any(s.features)
  );
$$;

revoke all on function public.vx_sub_v2_manage_grant(uuid,text,bigint,timestamptz),
  public.vx_sub_v2_owner_grants(uuid),public.vx_sub_v2_has_free_grant(text)
from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_manage_grant(uuid,text,bigint,timestamptz),
  public.vx_sub_v2_owner_grants(uuid),public.vx_sub_v2_has_free_grant(text) to authenticated;
commit;
