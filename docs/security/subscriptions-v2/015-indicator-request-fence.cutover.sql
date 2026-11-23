begin;
alter table public.indicator_requests enable row level security;
create policy vx_v2_indicator_request_insert on public.indicator_requests
as restrictive for insert to anon,authenticated
with check (
  auth.uid()=user_id and public.vx_sub_v2_can_access('indicators')
  and status='pending' and expires_at is null and purchase_id is null
);
-- A client cannot turn a pending request into a grant. Before cutover, move
-- administrative updates to an audited owner/worker RPC.
create policy vx_v2_indicator_request_update on public.indicator_requests
as restrictive for update to anon,authenticated using(false) with check(false);
commit;
