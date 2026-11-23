-- Isolated schema matching only the verified RPC signatures and lesson mapping.
create table public.lessons(id text primary key,course_id text not null,idx integer not null);
create table public.lesson_bodies(lesson_id text primary key,body text);
create table public.config(key text primary key,value text);
alter table public.purchases add column paid_at timestamptz;
insert into public.lessons values ('preview','a',1),('paid-a','a',2),('paid-b','b',2);
insert into public.lesson_bodies values ('preview','preview body'),('paid-a','paid body'),('paid-b','paid body');
grant select on public.lesson_bodies to authenticated;
alter table public.lesson_bodies enable row level security;
create policy fixture_broad_read on public.lesson_bodies for select to authenticated using(true);
create function public.is_member() returns boolean language sql stable
as $$ select auth.uid() is not null $$;
create function public.lesson_body_tr(lg text,lid text) returns jsonb language sql security definer
as $$ select to_jsonb(lid) $$;
create function public.ai_ask(q text,ctx jsonb,lang text) returns bigint language sql security definer
as $$ select 42::bigint $$;
create function public.ai_result(aid bigint) returns jsonb language sql security definer
as $$ select to_jsonb(aid) $$;
create function public.vx_marketing_items(section text,changes jsonb) returns jsonb language sql security definer
as $$ select to_jsonb(section) $$;
create function public.vx_marketing_publications(item uuid,destination_name text,cancel_job uuid,
  expected_revision timestamptz) returns jsonb language sql security definer
as $$ select '[]'::jsonb $$;
