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
  if (!result.ok) throw new Error(path + ' returned HTTP ' + result.status);
  return result.json();
}

function sql(input) {
  const result = spawnSync('docker', [
    'exec', '-i', db, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'
  ], { input, encoding: 'utf8', timeout: 20_000, windowsHide: true });
  if (result.status !== 0) throw new Error('Isolated HTTP fixture SQL failed');
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
const plan = '00000000-0000-4000-8000-000000000010';
sql(`begin;
insert into vx_sub_v2.owner_identity values(true,'${owner.id}');
insert into vx_sub_v2.enrollment(user_id,plan_id) values('${member.id}','${plan}');
commit;`);
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
