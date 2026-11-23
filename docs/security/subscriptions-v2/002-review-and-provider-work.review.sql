begin;

-- Trusted receipt intake calls this after private storage validation.
create function public.vx_sub_v2_bind_receipt(p_user uuid,p_order uuid,p_key text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user is null or p_order is null or p_key is null or length(p_key)>240 or p_key !~
    ('^' || p_user::text || '/' || p_order::text || '/[0-9a-f-]{36}[.](pdf|png|jpg|webp)$')
  then raise exception 'Invalid receipt key'; end if;
  perform 1 from vx_sub_v2.orders where id=p_order and user_id=p_user and state='pending' for update;
  if not found then raise exception 'Pending order unavailable'; end if;
  insert into vx_sub_v2.receipts values(p_order,p_key)
    on conflict(order_id) do nothing;
  if not exists(select 1 from vx_sub_v2.receipts where order_id=p_order and object_key=p_key)
    then raise exception 'Receipt already bound'; end if;
end;
$$;

create function public.vx_sub_v2_owner_review(p_before timestamptz default 'infinity')
returns table(order_id uuid,user_id uuid,plan_id uuid,kind text,amount_cents integer,
  state text,created_at timestamptz,receipt_ready boolean,expires_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_owner();
  return query
  select o.id,o.user_id,o.plan_id,o.kind,o.amount_cents,o.state,o.created_at,
    r.order_id is not null,s.expires_at,s.revoked_at
  from vx_sub_v2.orders o
  left join vx_sub_v2.receipts r on r.order_id=o.id
  left join vx_sub_v2.subscriptions s on s.user_id=o.user_id
  where o.created_at<p_before
  order by o.created_at desc,o.id desc limit 50;
end;
$$;

-- A private signing backend uses the owner session to fetch this key by order ID.
create function public.vx_sub_v2_owner_receipt(p_order uuid)
returns text language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_owner();
  return (select object_key from vx_sub_v2.receipts where order_id=p_order);
end;
$$;

grant insert on vx_sub_v2.receipts to vx_sub_v2_executor;
create policy executor_insert on vx_sub_v2.receipts for insert to vx_sub_v2_executor with check (true);
revoke all on function public.vx_sub_v2_bind_receipt(uuid,uuid,text),
  public.vx_sub_v2_owner_review(timestamptz),public.vx_sub_v2_owner_receipt(uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_bind_receipt(uuid,uuid,text) to service_role;
grant execute on function public.vx_sub_v2_owner_review(timestamptz),
  public.vx_sub_v2_owner_receipt(uuid) to authenticated;
grant create on schema public to vx_sub_v2_executor;
alter function public.vx_sub_v2_bind_receipt(uuid,uuid,text) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_owner_review(timestamptz) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_owner_receipt(uuid) owner to vx_sub_v2_executor;
revoke create on schema public from vx_sub_v2_executor;

-- Provider work is manual until identity and provider contracts are approved.
-- The original queue is kept as an immutable record of scheduled transitions.
create table vx_sub_v2.provider_jobs (
  user_id uuid not null,
  revision bigint not null,
  due_at timestamptz not null,
  provider text not null check(provider in ('telegram','tradingview')),
  state text not null default 'pending' check(state in ('pending','succeeded','failed','superseded')),
  primary key(user_id,revision,due_at,provider),
  foreign key(user_id,revision,due_at) references vx_sub_v2.reconcile_queue
);
create table vx_sub_v2.provider_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  revision bigint not null,
  due_at timestamptz not null,
  provider text not null,
  actor uuid not null,
  attempted_at timestamptz not null default clock_timestamp(),
  result text not null check(result in ('succeeded','failed','superseded')),
  error_code text check(error_code ~ '^[a-z0-9_]{1,64}$'),
  foreign key(user_id,revision,due_at,provider) references vx_sub_v2.provider_jobs
);
alter table vx_sub_v2.provider_jobs enable row level security;
alter table vx_sub_v2.provider_attempts enable row level security;
revoke all on vx_sub_v2.provider_jobs,vx_sub_v2.provider_attempts from public,anon,authenticated,service_role;

create function vx_sub_v2.enqueue_providers() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into vx_sub_v2.provider_jobs(user_id,revision,due_at,provider)
  values(new.user_id,new.revision,new.due_at,'telegram'),
        (new.user_id,new.revision,new.due_at,'tradingview');
  return new;
end;
$$;
revoke all on function vx_sub_v2.enqueue_providers() from public,anon,authenticated,service_role;
create trigger enqueue_providers after insert on vx_sub_v2.reconcile_queue
for each row execute function vx_sub_v2.enqueue_providers();
insert into vx_sub_v2.provider_jobs(user_id,revision,due_at,provider)
select q.user_id,q.revision,q.due_at,p.provider
from vx_sub_v2.reconcile_queue q cross join (values('telegram'),('tradingview')) p(provider);

create function public.vx_sub_v2_provider_work()
returns table(user_id uuid,revision bigint,due_at timestamptz,provider text,desired_access boolean,state text)
language plpgsql security definer set search_path='' as $$
begin
  perform vx_sub_v2.require_owner();
  return query
  select j.user_id,j.revision,j.due_at,j.provider,
    s.revoked_at is null and s.starts_at<=statement_timestamp() and s.expires_at>statement_timestamp()
      and (case j.provider when 'telegram' then 'vip' else 'indicators' end)=any(p.features),
    j.state
  from vx_sub_v2.provider_jobs j join vx_sub_v2.subscriptions s
    on s.user_id=j.user_id and s.revision=j.revision
  join vx_sub_v2.plans p on p.id=s.plan_id
  where j.due_at<=statement_timestamp() and j.state in ('pending','failed')
  order by j.due_at,j.user_id,j.provider limit 100;
end;
$$;

create function public.vx_sub_v2_provider_result(p_user uuid,p_revision bigint,p_due timestamptz,
  p_provider text,p_succeeded boolean,p_observed_access boolean,p_error_code text)
returns text language plpgsql security definer set search_path='' as $$
declare
  v_owner uuid:=vx_sub_v2.require_owner();
  v_revision bigint;
  v_desired boolean;
  v_result text;
begin
  if p_succeeded is null or (not p_succeeded and p_error_code is null)
     or (p_succeeded and (p_error_code is not null or p_observed_access is null)) then
    raise exception 'Invalid provider result';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,81921));
  select s.revision, s.revoked_at is null and s.starts_at<=clock_timestamp()
    and s.expires_at>clock_timestamp()
    and (case p_provider when 'telegram' then 'vip' else 'indicators' end)=any(p.features)
    into strict v_revision,v_desired
  from vx_sub_v2.subscriptions s join vx_sub_v2.plans p on p.id=s.plan_id
  where s.user_id=p_user;
  v_result:=case when p_revision<>v_revision then 'superseded'
    when not p_succeeded then 'failed'
    when v_desired is distinct from p_observed_access then 'failed'
    else 'succeeded' end;
  if v_result='failed' and p_error_code is null then p_error_code:='observed_access_mismatch'; end if;
  update vx_sub_v2.provider_jobs set state=v_result
  where user_id=p_user and revision=p_revision and due_at=p_due and provider=p_provider
    and due_at<=clock_timestamp() and state in ('pending','failed');
  if not found then raise exception 'Actionable provider job unavailable'; end if;
  insert into vx_sub_v2.provider_attempts(user_id,revision,due_at,provider,actor,result,error_code)
    values(p_user,p_revision,p_due,p_provider,v_owner,v_result,p_error_code);
  -- An operator may have changed external access after the job became stale.
  if v_result='superseded' then
    insert into vx_sub_v2.reconcile_queue values(p_user,v_revision,clock_timestamp());
  end if;
  return v_result;
end;
$$;

grant select,update on vx_sub_v2.provider_jobs to vx_sub_v2_executor;
grant insert on vx_sub_v2.provider_attempts to vx_sub_v2_executor;
create policy executor_read on vx_sub_v2.provider_jobs for select to vx_sub_v2_executor using(true);
create policy executor_update on vx_sub_v2.provider_jobs for update to vx_sub_v2_executor using(true) with check(true);
create policy executor_insert on vx_sub_v2.provider_attempts for insert to vx_sub_v2_executor with check(true);
revoke all on function public.vx_sub_v2_provider_work(),
  public.vx_sub_v2_provider_result(uuid,bigint,timestamptz,text,boolean,boolean,text)
  from public,anon,authenticated,service_role;
grant execute on function public.vx_sub_v2_provider_work(),
  public.vx_sub_v2_provider_result(uuid,bigint,timestamptz,text,boolean,boolean,text) to authenticated;
grant create on schema public to vx_sub_v2_executor;
alter function public.vx_sub_v2_provider_work() owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_provider_result(uuid,bigint,timestamptz,text,boolean,boolean,text) owner to vx_sub_v2_executor;
revoke create on schema public from vx_sub_v2_executor;
commit;
