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
