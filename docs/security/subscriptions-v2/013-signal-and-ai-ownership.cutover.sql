begin;
-- Populate explicit public rows from reviewed source metadata before cutover.
-- tg_sent describes delivery, so it cannot authorize public reading.
create table vx_sub_v2.public_signals (
  signal_id text primary key references public.signals(id) on delete cascade
);
alter table vx_sub_v2.public_signals enable row level security;
revoke all on vx_sub_v2.public_signals from public,anon,authenticated,service_role;

create function public.vx_sub_v2_can_read_signal(p_signal text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from vx_sub_v2.public_signals p where p.signal_id=p_signal)
    or (auth.uid() is not null and (
      public.vx_sub_v2_can_access('vip') or
      exists(select 1 from vx_sub_v2.owner_identity o where o.user_id=auth.uid())
    ));
$$;
revoke all on function public.vx_sub_v2_can_read_signal(text) from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_can_read_signal(text) to anon,authenticated;
alter table public.signals enable row level security;
alter table public.signal_events enable row level security;
create policy vx_v2_signal_visibility on public.signals as restrictive
for select to anon,authenticated using (public.vx_sub_v2_can_read_signal(id));
-- Internal event payloads may contain fields absent from the public feed.
create policy vx_v2_signal_events_visibility on public.signal_events as restrictive
for select to anon,authenticated using (
  auth.uid() is not null and public.vx_sub_v2_can_access('vip')
);

create table vx_sub_v2.ai_result_owners (
  result_id bigint primary key,
  user_id uuid not null references auth.users(id)
);
alter table vx_sub_v2.ai_result_owners enable row level security;
revoke all on vx_sub_v2.ai_result_owners from public,anon,authenticated,service_role;

create or replace function public.ai_ask(q text,ctx jsonb,lang text)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_result bigint;
begin
  perform vx_sub_v2.require_feature('ai');
  v_result := vx_sub_v2.ai_ask(q,ctx,lang);
  if v_result is not null then
    insert into vx_sub_v2.ai_result_owners(result_id,user_id) values(v_result,auth.uid())
    on conflict(result_id) do nothing;
    if not exists(select 1 from vx_sub_v2.ai_result_owners
      where result_id=v_result and user_id=auth.uid()) then
      raise exception 'AI result owner mismatch' using errcode='42501';
    end if;
  end if;
  return v_result;
end;
$$;

create or replace function public.ai_result(aid bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_feature('ai');
  if not exists(select 1 from vx_sub_v2.ai_result_owners
    where result_id=aid and user_id=auth.uid()) then
    raise exception 'AI result unavailable' using errcode='42501';
  end if;
  return vx_sub_v2.ai_result(aid);
end;
$$;
commit;
