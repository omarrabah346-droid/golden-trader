create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon,authenticated,service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;

-- This database exists solely for disposable subscription fixtures.
create table public.legacy_payment_fixture(id integer primary key, access_active boolean);
insert into public.legacy_payment_fixture values(1,true);

create table auth.users(id uuid primary key);
insert into auth.users select format('00000000-0000-4000-8000-00000000000%s',n)::uuid from generate_series(1,4) n;

-- Minimal shape for migration policy tests. This does not emulate the Storage API.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean);
create table storage.objects(bucket_id text not null,name text not null);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select,insert on storage.objects to authenticated;
create policy permissive_fixture on storage.objects to authenticated using(true) with check(true);
create table public.purchases(
  id bigint generated always as identity primary key,
  user_id uuid not null,kind text not null,status text not null,expires_at timestamptz
);
insert into public.purchases(user_id,kind,status,expires_at)
values('00000000-0000-4000-8000-000000000002','monthly','paid',now()+interval '1 day');

alter table public.purchases enable row level security;
grant select on public.purchases to authenticated;
create policy fixture_purchase_owner on public.purchases for select to authenticated using(user_id=auth.uid());
