begin;

-- Direct PostgREST queries remain subject to existing permissive policies.
-- The restrictive policy adds an entitlement check even if a permissive
-- policy grants broad access. Run on the isolated copy before cutover.
create function public.vx_sub_v2_can_read_lesson(p_lesson text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from public.lessons l
    where l.id=p_lesson and (
      exists(select 1 from vx_sub_v2.owner_identity o where o.user_id=auth.uid())
      or public.vx_sub_v2_can_access('academy')
      or public.vx_sub_v2_has_legacy_grant('academy',l.course_id)
      or (public.is_member() and l.idx <= coalesce((
        select case when trim(c.value) ~ '^[0-9]{1,6}$' then nullif(trim(c.value)::int,0) end
        from public.config c where c.key='free_lessons'
      ),1))
      or exists (select 1 from public.purchases p
        where p.user_id=auth.uid() and p.course_id=l.course_id and p.kind='course'
          and p.status in ('paid','done') and p.pay_ref<>'GRANT'
          and p.amount>0 and p.paid_at is not null and p.expires_at is null)
    )
  );
$$;
revoke all on function public.vx_sub_v2_can_read_lesson(text) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_can_read_lesson(text) to authenticated,anon;

alter table public.lesson_bodies enable row level security;
create policy vx_sub_v2_lesson_bodies_read on public.lesson_bodies
as restrictive for select to anon,authenticated
using (public.vx_sub_v2_can_read_lesson(lesson_id));

-- Move audited signatures out of the exposed schema. The existing
-- SECURITY DEFINER implementations keep their owner and internal checks.
do $$
declare signature text;
begin
  foreach signature in array array[
    'public.lesson_body_tr(text,text)', 'public.ai_ask(text,jsonb,text)',
    'public.ai_result(bigint)', 'public.vx_marketing_items(text,jsonb)',
    'public.vx_marketing_publications(uuid,text,uuid,timestamptz)'
  ] loop
    if not exists (select 1 from pg_catalog.pg_proc p
      where p.oid=pg_catalog.to_regprocedure(signature) and p.prosecdef) then
      raise exception 'Missing verified SECURITY DEFINER RPC: %',signature;
    end if;
    execute format('revoke all on function %s from public,anon,authenticated,service_role',signature);
    execute format('alter function %s set schema vx_sub_v2',signature);
  end loop;
end;
$$;

create function vx_sub_v2.require_feature(p_feature text)
returns void language plpgsql stable security invoker set search_path='' as $$
begin
  if auth.uid() is null or not (
    public.vx_sub_v2_can_access(p_feature)
    or (p_feature='ai' and public.vx_sub_v2_has_legacy_grant('ai',null))
    or exists(select 1 from vx_sub_v2.owner_identity where user_id=auth.uid())
  ) then raise exception 'Active entitlement required' using errcode='42501'; end if;
end;
$$;
revoke all on function vx_sub_v2.require_feature(text) from public,anon,authenticated,service_role;

create function public.lesson_body_tr(lg text,lid text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not public.vx_sub_v2_can_read_lesson(lid) then
    raise exception 'Lesson entitlement required' using errcode='42501';
  end if;
  return vx_sub_v2.lesson_body_tr(lg,lid);
end;
$$;

create function public.ai_ask(q text,ctx jsonb,lang text)
returns bigint language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_feature('ai');
  return vx_sub_v2.ai_ask(q,ctx,lang);
end;
$$;
create function public.ai_result(aid bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_feature('ai');
  return vx_sub_v2.ai_result(aid);
end;
$$;

create function public.vx_marketing_items(section text,changes jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_feature('marketing');
  return vx_sub_v2.vx_marketing_items(section,changes);
end;
$$;
create function public.vx_marketing_publications(item uuid default null,destination_name text default null,
  cancel_job uuid default null,expected_revision timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_feature('marketing');
  return vx_sub_v2.vx_marketing_publications(item,destination_name,cancel_job,expected_revision);
end;
$$;

revoke all on function public.lesson_body_tr(text,text),public.ai_ask(text,jsonb,text),
  public.ai_result(bigint),public.vx_marketing_items(text,jsonb),
  public.vx_marketing_publications(uuid,text,uuid,timestamptz)
from public,anon,authenticated,service_role;
grant execute on function public.lesson_body_tr(text,text),public.ai_ask(text,jsonb,text),
  public.ai_result(bigint),public.vx_marketing_items(text,jsonb),
  public.vx_marketing_publications(uuid,text,uuid,timestamptz) to authenticated;

commit;
