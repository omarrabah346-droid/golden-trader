begin;
-- Dedicated V2 bucket. Execute only after testing against the actual Storage schema.
insert into storage.buckets(id,name,public)
values('vexora-v2-receipts','vexora-v2-receipts',false);
-- All access uses server-verified order membership and short-lived signed URLs.
-- Restrictive rules also fence off any older broad permissive object policies.
create policy vx_v2_receipts_client_fence on storage.objects
as restrictive for all to anon,authenticated
using (bucket_id <> 'vexora-v2-receipts')
with check (bucket_id <> 'vexora-v2-receipts');
commit;
