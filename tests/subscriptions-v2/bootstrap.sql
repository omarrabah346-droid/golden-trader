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
