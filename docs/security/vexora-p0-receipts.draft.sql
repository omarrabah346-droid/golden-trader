-- REVIEW ONLY. Keep outside the migration directory.
-- All statements are commented so opening this file in a SQL editor is inert.
-- Phase 1: inspect the approved environment before finalizing the change.

-- SELECT id, name, public
-- FROM storage.buckets
-- WHERE id = 'receipts';

-- SELECT c.relrowsecurity
-- FROM pg_catalog.pg_class AS c
-- WHERE c.oid = 'storage.objects'::regclass;

-- Inspect every policy, including ones whose predicates do not name a bucket.
-- SELECT policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_catalog.pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects'
-- ORDER BY policyname;

-- Phase 2: candidate RLS change, after verified server cutover and approval.
-- Make the existing receipts bucket private through the supported Storage API
-- or dashboard. Verify that it exists and that public = false before accepting
-- the cutover. The policy below cannot protect a public download endpoint.
-- Confirm RLS is already enabled on storage.objects and the proposed policy
-- name is unused. No existing policy is removed by this draft.
-- The server must authenticate the caller, authorize against the purchase
-- and its canonical object key, and only then use its privileged Storage client.
-- Both owner and authorized staff reads go through that server path.
-- Direct client uploads also move to the server before this policy takes effect.

-- BEGIN;
--
-- CREATE POLICY "vexora receipts server only"
-- ON storage.objects
-- AS RESTRICTIVE
-- FOR ALL
-- TO PUBLIC
-- USING (bucket_id <> 'receipts')
-- WITH CHECK (bucket_id <> 'receipts');
--
-- COMMIT;

-- Rollback preparation: audit the pre-change settings and preserve the
-- private bucket. Any removal of this policy requires explicit approval
-- and a verified replacement control before restoring client access.
