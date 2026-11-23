import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL(process.env.VX_SUB_LOCAL_URL);
assert.equal(root.protocol, 'http:');
assert.match(root.hostname, /^(127\.0\.0\.1|localhost)$/);
assert.equal(root.port, '56881');
assert.equal(root.origin + '/', root.href);
const db = process.env.VX_SUB_LOCAL_DOCKER_DB;
assert.match(db, /^supabase_db_vxv2-[a-f0-9]{12}$/);
const anon = process.env.VX_SUB_TEST_ANON_KEY;
const service = process.env.VX_SUB_LOCAL_SERVICE_KEY;
assert.ok(anon && service, 'Isolated CLI did not supply local API keys');

async function call(path, key, body, token = key) {
  const result = await fetch(new URL(path, root), {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const responseText = await result.text();
  let responseBody;
  try { responseBody = responseText ? JSON.parse(responseText) : null; }
  catch { responseBody = responseText.slice(0, 2000); }
  if (!result.ok) {
    throw new Error(path + ' returned HTTP ' + result.status + ': ' + JSON.stringify(responseBody));
  }
  return responseBody;
}

function sql(input) {
  const result = spawnSync('docker', [
    'exec', '-i', db, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'
  ], { input, encoding: 'utf8', timeout: 20_000, windowsHide: true });
  if (result.status !== 0) {
    throw new Error('Isolated HTTP fixture SQL failed: ' + (result.stderr || '').trim().slice(0, 2000));
  }
  return (result.stdout || '').trim();
}

sql(`do $$ begin
  if exists(select 1 from auth.users) or
     exists(select 1 from vx_sub_v2.owner_identity) or
     not exists(select 1 from storage.buckets where id='vexora-v2-receipts' and not public)
  then raise exception 'Not a fresh receipt test database'; end if;
end $$;`);

async function createUser(role) {
  const email = role + '-' + randomUUID() + '@vexora-test.invalid';
  const password = randomUUID() + '!Test1';
  const user = await call('/auth/v1/admin/users', service, { email, password, email_confirm: true });
  assert.match(user.id, /^[a-f0-9-]{36}$/);
  const session = await call('/auth/v1/token?grant_type=password', anon, { email, password });
  assert.ok(session.access_token);
  return { id: user.id, token: session.access_token };
}

const owner = await createUser('owner');
const member = await createUser('member');
const other = await createUser('other');
const memberClaims = JSON.parse(Buffer.from(member.token.split('.')[1], 'base64url').toString('utf8'));
assert.equal(memberClaims.role, 'authenticated', 'Auth JWT must select the authenticated database role');
assert.equal(memberClaims.sub, member.id, 'Auth JWT subject must match the seeded enrollment');
const plan = '00000000-0000-4000-8000-000000000010';
sql(`begin;
insert into vx_sub_v2.owner_identity values(true,'${owner.id}');
insert into vx_sub_v2.enrollment(user_id,plan_id) values('${member.id}','${plan}');
commit;`);
// Verify the fixture is inspecting the isolated database that recorded migration 001.
// This is read-only and helps distinguish an unapplied migration from an ACL reset.
const migrationContext = sql(`select jsonb_build_object(
  'database', current_database(),
  'current_user', current_user,
  'session_user', session_user,
  'core_migration_001_applied', exists (
    select 1 from supabase_migrations.schema_migrations where version='20260101000000'
  ),
  'executor_auth_usage', has_schema_privilege('vx_sub_v2_executor','auth','USAGE'),
  'executor_auth_usage_direct', exists (
    select 1 from pg_namespace n,
      lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    where n.nspname='auth' and a.grantee=(select oid from pg_roles where rolname='vx_sub_v2_executor')
      and a.privilege_type='USAGE'
  )
)::text;`);
console.log('Isolated migration context (read-only): ' + migrationContext);
// Read-only privilege report: effective access, direct ACL, inherited role ACL, and PUBLIC ACL.
const executorSchemaPrivileges = sql(`with recursive membership(roleid) as (
  select oid from pg_roles where rolname='vx_sub_v2_executor'
  union
  select am.roleid from pg_auth_members am join membership m on am.member=m.roleid
), executor as (
  select oid from pg_roles where rolname='vx_sub_v2_executor'
)
select n.nspname,
  has_schema_privilege(e.oid,n.oid,'USAGE') as effective_usage,
  exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    where a.grantee=e.oid and a.privilege_type='USAGE') as direct_acl,
  coalesce((select string_agg(r.rolname,', ' order by r.rolname)
    from membership m join pg_roles r on r.oid=m.roleid
    where m.roleid<>e.oid and pg_has_role(e.oid,r.oid,'USAGE')
      and has_schema_privilege(r.oid,n.oid,'USAGE')), '(none)') as inherited_from,
  exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
    where a.grantee=0 and a.privilege_type='USAGE') as public_usage
from pg_namespace n cross join executor e
where n.nspname in ('vx_sub_v2','auth')
order by n.nspname;`);
console.log('Executor schema privileges (effective/direct/inherited/PUBLIC):\n' + executorSchemaPrivileges);

// Read-only preflight distinguishes missing migration grants/RLS from an RPC-level rejection.
sql(`do $$ begin
  if not has_schema_privilege('authenticated','public','USAGE') then
    raise exception 'Fixture diagnostic: authenticated lacks USAGE on public schema';
  end if;
  if not has_function_privilege('authenticated','public.vx_sub_v2_request(uuid,uuid)','EXECUTE') then
    raise exception 'Fixture diagnostic: authenticated lacks EXECUTE on vx_sub_v2_request';
  end if;
  if not (select p.prosecdef and r.rolname='vx_sub_v2_executor'
      from pg_proc p join pg_roles r on r.oid=p.proowner
      where p.oid='public.vx_sub_v2_request(uuid,uuid)'::regprocedure) then
    raise exception 'Fixture diagnostic: request RPC is not SECURITY DEFINER owned by vx_sub_v2_executor';
  end if;
  if not has_function_privilege('vx_sub_v2_executor','auth.uid()','EXECUTE') then
    raise exception 'Fixture diagnostic: executor lacks EXECUTE on auth.uid';
  end if;
  if not has_table_privilege('vx_sub_v2_executor','vx_sub_v2.enrollment','SELECT') or
     not has_table_privilege('vx_sub_v2_executor','vx_sub_v2.orders','INSERT') then
    raise exception 'Fixture diagnostic: executor table grants are incomplete';
  end if;
  if not (select relrowsecurity from pg_class where oid='vx_sub_v2.enrollment'::regclass) or
     not (select relrowsecurity from pg_class where oid='vx_sub_v2.orders'::regclass) then
    raise exception 'Fixture diagnostic: V2 RLS is not enabled';
  end if;
  if not exists(select 1 from pg_policies where schemaname='vx_sub_v2'
      and tablename='enrollment' and policyname='executor_read') or
     not exists(select 1 from pg_policies where schemaname='vx_sub_v2'
      and tablename='orders' and policyname='executor_insert') then
    raise exception 'Fixture diagnostic: required executor RLS policies are absent';
  end if;
end $$;`);
sql(`do $$ begin
  if not has_schema_privilege('vx_sub_v2_executor','vx_sub_v2','USAGE') then
    raise exception 'Fixture diagnostic: vx_sub_v2_executor lacks effective USAGE on schema vx_sub_v2';
  end if;
end $$;`);
sql(`do $$ begin
  if not has_schema_privilege('vx_sub_v2_executor','auth','USAGE') then
    raise exception 'Fixture diagnostic: vx_sub_v2_executor lacks effective USAGE on schema auth';
  end if;
end $$;`);
const rows = await call('/rest/v1/rpc/vx_sub_v2_request', anon, {
  p_request_id: randomUUID(), p_plan: plan
}, member.token);
assert.match(rows[0].order_id, /^[a-f0-9-]{36}$/);

const env = { ...process.env };
delete env.VX_SUB_LOCAL_SERVICE_KEY;
Object.assign(env, {
  VX_SUB_RUN_LOCAL_HTTP: '1',
  VX_SUB_TEST_MEMBER_JWT: member.token,
  VX_SUB_TEST_OTHER_JWT: other.token,
  VX_SUB_TEST_OWNER_JWT: owner.token,
  VX_SUB_TEST_ORDER: rows[0].order_id
});
const test = fileURLToPath(new URL('./supabase-http.test.mjs', import.meta.url));
const result = spawnSync(process.execPath, ['--test', test], { env, stdio: 'inherit', timeout: 30_000 });
process.exit(result.status ?? 1);
