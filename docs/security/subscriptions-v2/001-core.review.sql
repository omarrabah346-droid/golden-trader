begin;
create role vx_sub_v2_executor nologin noinherit;
create schema vx_sub_v2;
revoke all on schema vx_sub_v2 from public, anon, authenticated, service_role;

create table vx_sub_v2.owner_identity (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique
);
-- Provision exactly one verified owner through a reviewed privileged process.
-- An empty owner table intentionally makes every administrative RPC fail closed.

create table vx_sub_v2.plans (
  id uuid primary key,
  audience text not null check (audience in ('student', 'partner')),
  features text[] not null check (features = array['academy','vip','indicators','marketing','ai','extras']::text[])
);

-- Stable plan IDs for enrollment. Both audiences receive the full V2 package.
insert into vx_sub_v2.plans(id,audience,features) values
  ('00000000-0000-4000-8000-000000000010','student',array['academy','vip','indicators','marketing','ai','extras']::text[]),
  ('00000000-0000-4000-8000-000000000011','partner',array['academy','vip','indicators','marketing','ai','extras']::text[]);

create table vx_sub_v2.enrollment (
  user_id uuid not null,
  plan_id uuid not null references vx_sub_v2.plans,
  primary key (user_id, plan_id)
);
-- Rows are assigned through a trusted bridge to the existing account/partner model.

create table vx_sub_v2.subscriptions (
  user_id uuid primary key,
  plan_id uuid not null references vx_sub_v2.plans,
  starts_at timestamptz not null,
  expires_at timestamptz not null check (expires_at > starts_at),
  revoked_at timestamptz,
  revoked_by uuid,
  revoke_reason text,
  revision bigint not null default 1
);

create table vx_sub_v2.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  request_id uuid not null,
  plan_id uuid not null references vx_sub_v2.plans,
  kind text not null check (kind in ('initial','renewal')),
  amount_cents integer not null check (
    (kind='initial' and amount_cents=30000) or
    (kind='renewal' and amount_cents=10000)),
  currency text not null default 'USD' check (currency='USD'),
  state text not null default 'pending' check (state in ('pending','approved','rejected')),
  created_at timestamptz not null default clock_timestamp(),
  decided_at timestamptz,
  decided_by uuid,
  decision_reason text,
  unique (user_id, request_id)
);

create table vx_sub_v2.receipts (
  order_id uuid primary key references vx_sub_v2.orders,
  object_key text unique not null
);
-- Server-only intake: authenticate submitter, verify order ownership and pending
-- state under the same order lock, then bind the validated private object key.

create table vx_sub_v2.settlements (
  order_id uuid primary key references vx_sub_v2.orders,
  payment_key text not null unique,
  verified_amount_cents integer not null,
  verified_currency text not null check (verified_currency='USD'),
  approved_by uuid not null,
  approved_at timestamptz not null,
  coverage_start timestamptz not null,
  coverage_end timestamptz not null
);

create table vx_sub_v2.reconcile_queue (
  user_id uuid not null references vx_sub_v2.subscriptions,
  revision bigint not null,
  due_at timestamptz not null,
  primary key (user_id, revision, due_at)
);
-- Internal worker contract (leases, retries and per-provider state in design).

alter table vx_sub_v2.owner_identity enable row level security;
alter table vx_sub_v2.plans enable row level security;
alter table vx_sub_v2.enrollment enable row level security;
alter table vx_sub_v2.subscriptions enable row level security;
alter table vx_sub_v2.orders enable row level security;
alter table vx_sub_v2.receipts enable row level security;
alter table vx_sub_v2.settlements enable row level security;
alter table vx_sub_v2.reconcile_queue enable row level security;
revoke all on all tables in schema vx_sub_v2 from public, anon, authenticated, service_role;

-- Optional self-read RLS defense if read grants are added in a later review.
-- There are no direct authenticated table grants in this proposal.
create policy own_order on vx_sub_v2.orders for select to authenticated
  using (user_id = (select auth.uid()));
create policy own_subscription on vx_sub_v2.subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

-- JWT subject reader owned by the migration role. Mirrors auth.uid() so the
-- executor role never needs USAGE on Supabase's auth schema (owned by
-- supabase_auth_admin; a GRANT from the migration role is silently ignored).
create function vx_sub_v2.uid() returns uuid
language sql stable security invoker set search_path = '' as $$
  select nullif(coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  ), '')::uuid;
$$;
revoke all on function vx_sub_v2.uid() from public, anon, authenticated, service_role;

create function vx_sub_v2.require_owner() returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_uid uuid := vx_sub_v2.uid();
begin
  if v_uid is null or not exists (
    select 1 from vx_sub_v2.owner_identity where user_id = v_uid
  ) then raise exception 'Owner approval required' using errcode = '42501'; end if;
  return v_uid;
end;
$$;
revoke all on function vx_sub_v2.require_owner() from public, anon, authenticated, service_role;

create function public.vx_sub_v2_request(p_request_id uuid, p_plan uuid)
returns table(order_id uuid, kind text, amount_cents integer, state text)
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := vx_sub_v2.uid();
  o vx_sub_v2.orders%rowtype;
  s vx_sub_v2.subscriptions%rowtype;
begin
  if v_uid is null or p_request_id is null then
    raise exception 'Valid session and request ID required';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,81921));
  select * into o from vx_sub_v2.orders x
    where x.user_id=v_uid and x.request_id=p_request_id;
  if not found then
    perform 1 from vx_sub_v2.enrollment e where e.user_id=v_uid and e.plan_id=p_plan;
    if not found then raise exception 'Plan unavailable'; end if;
    select * into s from vx_sub_v2.subscriptions x where x.user_id=v_uid;
    if s.user_id is not null and (s.plan_id <> p_plan or s.revoked_at is not null) then
      raise exception 'Subscription requires review';
    end if;
    insert into vx_sub_v2.orders(user_id,request_id,plan_id,kind,amount_cents)
    values(v_uid,p_request_id,p_plan,
      case when s.user_id is null then 'initial' else 'renewal' end,
      case when s.user_id is null then 30000 else 10000 end)
    on conflict(user_id,request_id) do nothing;
    select * into strict o from vx_sub_v2.orders x
      where x.user_id=v_uid and x.request_id=p_request_id;
  end if;
  if o.plan_id is distinct from p_plan then raise exception 'Request ID payload mismatch'; end if;
  return query select o.id,o.kind,o.amount_cents,o.state;
end;
$$;

create function public.vx_sub_v2_approve(
  p_order uuid, p_verified_key text, p_amount_cents integer, p_currency text)
returns table(coverage_start timestamptz, coverage_end timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_owner uuid := vx_sub_v2.require_owner();
  o vx_sub_v2.orders%rowtype;
  s vx_sub_v2.subscriptions%rowtype;
  t vx_sub_v2.settlements%rowtype;
  v_now timestamptz;
  v_start timestamptz;
  v_end timestamptz;
  v_revision bigint;
begin
  -- p_verified_key comes from the owner's checked settlement, never from the buyer.
  -- Production adapter must canonicalize by rail + provider/network + event ID.
  -- The grammar below is a draft interface, not a substitute for verification.
  if p_verified_key is null or p_verified_key !~ '^[a-z0-9_-]+:[a-z0-9_-]+:[A-Za-z0-9._:-]+$'
     or length(p_verified_key)>300 then raise exception 'Invalid settlement identity'; end if;
  select * into strict o from vx_sub_v2.orders where id=p_order for update;
  if p_amount_cents is distinct from o.amount_cents or p_currency is distinct from o.currency then
    raise exception 'Verified payment does not match order';
  end if;
  if o.state='approved' then
    select * into strict t from vx_sub_v2.settlements where order_id=o.id;
    if t.payment_key <> p_verified_key then raise exception 'Approval payload mismatch'; end if;
    return query select t.coverage_start,t.coverage_end;
    return;
  end if;
  if o.state <> 'pending' then raise exception 'Order is not pending'; end if;
  perform 1 from vx_sub_v2.receipts where order_id=o.id;
  if not found then raise exception 'Verified receipt binding required'; end if;

  -- Serialization key for all approval/revocation operations for this user.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(o.user_id::text, 81921));
  perform 1 from vx_sub_v2.enrollment where user_id=o.user_id and plan_id=o.plan_id for share;
  if not found then raise exception 'Plan no longer available'; end if;
  select * into s from vx_sub_v2.subscriptions where user_id=o.user_id for update;
  if (o.kind='initial') is distinct from (s.user_id is null)
     or (s.user_id is not null and (s.plan_id<>o.plan_id or s.revoked_at is not null)) then
    raise exception 'Order does not match current subscription lifecycle';
  end if;
  v_now := clock_timestamp();
  v_start := greatest(v_now, coalesce(s.expires_at,v_now));
  v_end := ((v_start at time zone 'UTC') + interval '1 month') at time zone 'UTC';

  -- The globally unique key rejects reuse across users/orders, also under concurrency.
  -- A conflict aborts the RPC transaction, including any entitlement/outbox writes.
  insert into vx_sub_v2.settlements values
    (o.id,p_verified_key,p_amount_cents,p_currency,v_owner,v_now,v_start,v_end);
  insert into vx_sub_v2.subscriptions(user_id,plan_id,starts_at,expires_at)
    values(o.user_id,o.plan_id,v_start,v_end)
    on conflict(user_id) do update set
      starts_at=case when vx_sub_v2.subscriptions.expires_at<=v_now
        then excluded.starts_at else vx_sub_v2.subscriptions.starts_at end,
      expires_at=excluded.expires_at,
      revision=vx_sub_v2.subscriptions.revision+1
    returning revision into v_revision;
  update vx_sub_v2.orders set state='approved',decided_by=v_owner,decided_at=v_now where id=o.id;
  insert into vx_sub_v2.reconcile_queue values (o.user_id,v_revision,v_now),(o.user_id,v_revision,v_end);
  return query select v_start,v_end;
end;
$$;

create function public.vx_sub_v2_reject(p_order uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := vx_sub_v2.require_owner();
begin
  if nullif(trim(p_reason),'') is null then raise exception 'Reason required'; end if;
  update vx_sub_v2.orders set state='rejected',decided_by=v_owner,
    decided_at=clock_timestamp(),decision_reason=p_reason
    where id=p_order and state='pending';
  if not found then raise exception 'Order is not pending'; end if;
end;
$$;

create function public.vx_sub_v2_revoke(p_user uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_owner uuid := vx_sub_v2.require_owner(); v_revision bigint; v_now timestamptz;
begin
  if p_user is null or nullif(trim(p_reason),'') is null then raise exception 'User and reason required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user::text,81921));
  v_now := clock_timestamp();
  update vx_sub_v2.subscriptions set revoked_at=v_now, revoked_by=v_owner,
    revoke_reason=p_reason, revision=revision+1 where user_id=p_user and revoked_at is null
    returning revision into v_revision;
  if found then insert into vx_sub_v2.reconcile_queue values(p_user,v_revision,v_now); end if;
end;
$$;

create function public.vx_sub_v2_my_status()
returns table(state text, expires_at timestamptz, features text[])
language sql stable security definer set search_path = '' as $$
  select case when s.revoked_at is not null then 'revoked'
              when s.expires_at <= statement_timestamp() then 'expired' when s.starts_at > statement_timestamp() then 'scheduled' else 'active' end,
         s.expires_at, case when s.revoked_at is null and s.starts_at <= statement_timestamp() and s.expires_at > statement_timestamp()
              then p.features else array[]::text[] end
  from vx_sub_v2.subscriptions s join vx_sub_v2.plans p on p.id=s.plan_id
  where s.user_id=vx_sub_v2.uid();
$$;

create function public.vx_sub_v2_my_orders()
returns table(order_id uuid, kind text, amount_cents integer, currency text,
              state text, created_at timestamptz, decided_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select o.id,o.kind,o.amount_cents,o.currency,o.state,o.created_at,o.decided_at
  from vx_sub_v2.orders o where o.user_id=vx_sub_v2.uid() order by o.created_at desc;
$$;

revoke all on function public.vx_sub_v2_request(uuid,uuid),
  public.vx_sub_v2_approve(uuid,text,integer,text), public.vx_sub_v2_reject(uuid,text),
  public.vx_sub_v2_revoke(uuid,text), public.vx_sub_v2_my_status(),
  public.vx_sub_v2_my_orders() from public, anon, authenticated, service_role;
-- PostgREST resolves public RPCs under the JWT role; EXECUTE alone is not enough.
grant usage on schema public to authenticated;
grant execute on function public.vx_sub_v2_request(uuid,uuid),
  public.vx_sub_v2_approve(uuid,text,integer,text), public.vx_sub_v2_reject(uuid,text),
  public.vx_sub_v2_revoke(uuid,text), public.vx_sub_v2_my_status(),
  public.vx_sub_v2_my_orders() to authenticated;

-- The execution role is isolated from legacy objects and cannot log in.
grant usage on schema vx_sub_v2 to vx_sub_v2_executor;
grant execute on function vx_sub_v2.uid(), vx_sub_v2.require_owner() to vx_sub_v2_executor;
grant select on vx_sub_v2.owner_identity, vx_sub_v2.plans,
  vx_sub_v2.enrollment, vx_sub_v2.receipts to vx_sub_v2_executor;
-- Row locks on enrollment need UPDATE privilege. RLS permits locking but denies writes.
grant update on vx_sub_v2.enrollment to vx_sub_v2_executor;
grant select, insert, update on vx_sub_v2.orders, vx_sub_v2.subscriptions to vx_sub_v2_executor;
grant select, insert on vx_sub_v2.settlements to vx_sub_v2_executor;
grant insert on vx_sub_v2.reconcile_queue to vx_sub_v2_executor;

do $$
declare t text;
begin
  foreach t in array array['owner_identity','plans','enrollment','receipts',
     'orders','subscriptions','settlements','reconcile_queue'] loop
    execute format('create policy executor_read on vx_sub_v2.%I for select to vx_sub_v2_executor using (true)', t);
  end loop;
  foreach t in array array['orders','subscriptions','settlements','reconcile_queue'] loop
    execute format('create policy executor_insert on vx_sub_v2.%I for insert to vx_sub_v2_executor with check (true)', t);
  end loop;
  foreach t in array array['orders','subscriptions','enrollment'] loop
    execute format('create policy executor_update on vx_sub_v2.%I for update to vx_sub_v2_executor using (true) with check (%s)',
      t, case when t='enrollment' then 'false' else 'true' end);
  end loop;
end;
$$;

grant create on schema public to vx_sub_v2_executor;
alter function public.vx_sub_v2_request(uuid,uuid) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_approve(uuid,text,integer,text) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_reject(uuid,text) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_revoke(uuid,text) owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_my_status() owner to vx_sub_v2_executor;
alter function public.vx_sub_v2_my_orders() owner to vx_sub_v2_executor;
revoke create on schema public from vx_sub_v2_executor;
commit;

-- Fail the migration loudly instead of relying on silent GRANT warnings.
do $$ begin
  if not has_schema_privilege('vx_sub_v2_executor','vx_sub_v2','USAGE') then
    raise exception 'V2 migration check: executor lacks USAGE on vx_sub_v2';
  end if;
  if not has_function_privilege('vx_sub_v2_executor','vx_sub_v2.uid()','EXECUTE') then
    raise exception 'V2 migration check: executor lacks EXECUTE on vx_sub_v2.uid()';
  end if;
  if has_function_privilege('anon','vx_sub_v2.uid()','EXECUTE') then
    raise exception 'V2 migration check: vx_sub_v2.uid() must not be executable by anon';
  end if;
end $$;
