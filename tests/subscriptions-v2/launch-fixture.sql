create table public.signals(id text primary key);
create table public.signal_events(id bigint primary key,signal_id text);
create table public.indicator_requests(
  user_id uuid, status text, expires_at timestamptz, purchase_id bigint
);
grant select on public.signals,public.signal_events to authenticated;
create policy fixture_signals on public.signals for select to authenticated using(true);
create policy fixture_events on public.signal_events for select to authenticated using(true);
insert into public.signals values ('public-signal'),('private-signal');
insert into public.signal_events values (1,'public-signal'),(2,'private-signal');
insert into public.purchases(user_id,kind,status,expires_at,pay_ref,amount,course_id,paid_at)
values('00000000-0000-4000-8000-000000000003','course','paid',null,'fixture-lifetime',300,'a',now());
