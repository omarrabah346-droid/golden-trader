import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const port = process.env.VX_SUB_TEST_PORT;
const user = 'vx_test_admin';
const database = 'vx_sub_test';

function sql(input) {
  return new Promise((resolve, reject) => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^PG/i.test(key)));
    const child = spawn(process.env.VX_SUB_TEST_PSQL || 'psql', [
      '-X', '-h', process.env.VX_SUB_TEST_SOCKET || '127.0.0.1', '-p', port, '-U', user, '-d', database,
      '-A', '-t', '-q', '-v', 'ON_ERROR_STOP=1'
    ], { env, windowsHide: true });
    let output = '';
    let errors = '';
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { errors += value; });
    child.on('error', reject);
    child.stdin.on('error', reject);
    child.on('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(errors)));
    child.stdin.end(input);
  });
}

const as = (n, statement, role = 'authenticated') =>
  sql(`set role ${role}; set request.jwt.claim.sub='${id(n)}'; ${statement}`);
const request = (n, token) => as(n, `select order_id from vx_sub_v2_request('${id(token)}','${id(n === 3 ? 11 : 10)}');`);
const bind = (n, order) => as(1, `select vx_sub_v2_bind_receipt('${id(n)}','${order}',
  '${id(n)}/${order}/${id(99)}.png');`, 'service_role');
const approve = (order, key, cents, actor = 1) => as(actor,
  `select * from vx_sub_v2_approve('${order}','bank:fixture:${key}',${cents},'USD');`);

test('isolated PostgreSQL lifecycle, role checks, provider work and concurrent settlement', { skip: process.env.VX_SUB_RUN_POSTGRES !== '1' }, async () => {
  assert.match(port || '', /^56[0-9]{3}$/, 'Use a freshly initialized local test cluster on port 56xxx');
  const marker = await sql("select current_database(),current_user, current_setting('cluster_name'), count(*) from pg_namespace where nspname='vx_sub_v2';");
  assert.equal(marker, 'vx_sub_test|vx_test_admin|vexora-subscriptions-fixture|0');
  for (const file of ['bootstrap.sql', '../../docs/security/subscriptions-v2/001-core.review.sql',
    '../../docs/security/subscriptions-v2/002-review-and-provider-work.review.sql', '../../docs/security/subscriptions-v2/003-feature-access.review.sql', '../../docs/security/subscriptions-v2/004-legacy-clearance.review.sql',
    '../../docs/security/subscriptions-v2/005-shared-settlement.review.sql', 'fixtures.sql']) {
    await sql(await readFile(new URL(file, import.meta.url), 'utf8'));
  }
  const order = await request(2, 20);
  assert.equal(await request(2, 20), order);
  assert.equal(await as(3, 'select count(*) from vx_sub_v2_my_orders();'), '0');
  await assert.rejects(as(2, 'select * from vx_sub_v2_owner_review();'), /Owner approval required/);
  await assert.rejects(as(2, 'select * from vx_sub_v2.orders;'), /permission denied/);
  await assert.rejects(as(2, 'select * from vx_sub_v2_my_orders();', 'anon'), /permission denied/);
  await assert.rejects(approve(order, 'first', 30000, 2), /Owner approval required/);
  await assert.rejects(approve(order, 'first', 30000), /receipt binding/);
  await assert.rejects(bind(3, order), /Pending order unavailable/);
  await bind(2, order);
  await assert.rejects(approve(order, 'first', 10000), /does not match/);
  await assert.rejects(approve(order, 'first', 30000), /Owner activation clearance required/);
  const clear = (actor, target, expiry) => as(actor,
    `select vx_sub_v2_clear_activation('${id(target)}',${expiry},'fixture');`);
  await assert.rejects(clear(2, 2, 'null'), /Owner approval required/);
  await assert.rejects(clear(1, 2, "now()+interval '1 day'"), /Legacy term must finish/);
  await clear(1, 2, "now()-interval '1 day'");
  await clear(1, 3, 'null');
  await clear(1, 4, 'null');
  assert.equal(await as(3, 'begin; reset role; grant usage on schema vx_sub_v2 to authenticated; grant select on vx_sub_v2.orders to authenticated; set role authenticated; select count(*) from vx_sub_v2.orders; rollback;'), '0');
  await assert.rejects(as(2, "select vx_sub_v2.claim_legacy_payment('bank:fixture:unauthorized','fixture');"), /permission denied/);
  const [first, duplicate] = await Promise.all([approve(order, 'first', 30000), approve(order, 'first', 30000)]);
  assert.equal(first, duplicate);
  assert.equal(await as(2, 'select state,features from vx_sub_v2_my_status();'), 'active|{academy,vip,indicators,marketing,ai,extras}');
  assert.equal(await as(2, "select vx_sub_v2_can_access('extras');"), 't');
  assert.equal(await as(1, "select vx_sub_v2_can_access('extras');"), 'f');
  assert.equal(await as(1, `select receipt_ready from vx_sub_v2_owner_review() where order_id='${order}';`), 't');
  assert.equal(await as(1, 'select count(*) from vx_sub_v2_provider_work() where desired_access;'), '2');

  const early = await request(2, 21);
  await bind(2, early);
  const renewed = await approve(early, 'early', 10000);
  assert.equal(renewed.split('|')[0], first.split('|')[1]);
  await sql(`update vx_sub_v2.subscriptions set starts_at=now()-interval '2 months',
    expires_at=now()-interval '1 month' where user_id='${id(2)}';`);
  assert.equal(await as(2, 'select state,features from vx_sub_v2_my_status();'), 'expired|{}');
  assert.equal(await as(2, "select vx_sub_v2_can_access('extras');"), 'f');
  const late = await request(2, 22);
  await bind(2, late);
  await approve(late, 'late', 10000);
  assert.equal(await as(2, "select vx_sub_v2_can_access('extras');"), 't');
  assert.equal(await sql(`select coverage_start=approved_at from vx_sub_v2.settlements where order_id='${late}';`), 't');

  const partners = await Promise.all([request(3, 30), request(4, 40)]);
  await Promise.all(partners.map((item, index) => bind(index + 3, item)));
  // Hold the first settlement uncommitted, then observe the second backend
  // waiting on its transaction before requiring the unique constraint error.
  const winner = as(1, `begin; select * from vx_sub_v2_approve('${partners[0]}',
    'bank:fixture:shared',30000,'USD'); select pg_sleep(5); commit;`);
  async function awaitBackend(predicate) {
    for (let attempt = 0; attempt < 20; attempt++) {
      if (await sql(`select exists(select from pg_stat_activity where pid<>pg_backend_pid()
        and datname=current_database() and ${predicate});`) === 't') return;
      await new Promise(resolve => setTimeout(resolve, 75));
    }
    assert.fail('Expected a concurrent backend wait');
  }
  await awaitBackend("wait_event='PgSleep'");
  const loser = assert.rejects(approve(partners[1], 'shared', 30000), /duplicate key/);
  await awaitBackend("wait_event_type='Lock' and wait_event='transactionid'");
  await Promise.all([winner, loser]);
  assert.equal(await as(3, 'select state,features from vx_sub_v2_my_status();'), 'active|{academy,vip,indicators,marketing,ai,extras}');
  assert.equal(await as(4, 'select count(*) from vx_sub_v2_my_status();'), '0');
  assert.equal(await sql("select count(*) from vx_sub_v2.settlements where payment_key='bank:fixture:shared';"), '1');

  await assert.rejects(sql("select vx_sub_v2.claim_legacy_payment('bank:fixture:shared','fixture');"), /duplicate key/);
  const legacyWinner = sql("begin; select vx_sub_v2.claim_legacy_payment('bank:fixture:legacy_race','fixture'); select pg_sleep(5); commit;");
  await awaitBackend("wait_event='PgSleep'");
  const v2Loser = assert.rejects(approve(partners[1], 'legacy_race', 30000), /duplicate key/);
  await awaitBackend("wait_event_type='Lock' and wait_event='transactionid'");
  await Promise.all([legacyWinner, v2Loser]);
  assert.equal(await sql("select source from vx_sub_v2.payment_claims where payment_key='bank:fixture:legacy_race';"), 'legacy');
  assert.equal(await as(4, 'select count(*) from vx_sub_v2_my_status();'), '0');

  await sql("begin; select vx_sub_v2.claim_legacy_payment('bank:fixture:legacy_rollback','fixture'); rollback;");
  await approve(partners[1], 'legacy_rollback', 30000);
  assert.equal(await sql("select source from vx_sub_v2.payment_claims where payment_key='bank:fixture:legacy_rollback';"), 'v2');

  await as(1, `select vx_sub_v2_revoke('${id(2)}','fixture');`);
  assert.equal(await as(2, 'select state,features from vx_sub_v2_my_status();'), 'revoked|{}');
  assert.equal(await as(2, "select vx_sub_v2_can_access('extras');"), 'f');
  const recordResult = (success, observed, error) => as(1,
    `select vx_sub_v2_provider_result(user_id,revision,due_at,provider,${success},${observed},${error})
      from vx_sub_v2_provider_work() where user_id='${id(2)}' and provider='telegram' and not desired_access;`);
  assert.equal(await recordResult(false, 'null', "'fixture_failure'"), 'failed');
  assert.equal(await recordResult(true, false, 'null'), 'succeeded');
  assert.equal(await sql('select count(*) from vx_sub_v2.provider_attempts;'), '2');
  assert.equal(await sql('select access_active from public.legacy_payment_fixture where id=1;'), 't');
});

test('isolated owner grant lifecycle', { skip: process.env.VX_SUB_RUN_POSTGRES !== '1' }, async () => {
  await sql(await readFile(new URL('../../docs/security/subscriptions-v2/006-free-grants.review.sql', import.meta.url), 'utf8'));
  const user = id(4);
  const create = `select vx_sub_v2_manage_grant('${user}','create',null,now()+interval '1 day');`;
  await assert.rejects(as(4, create), /Owner approval required/);
  const grant = await as(1, create);
  assert.match(grant, /^\d+$/);
  assert.equal(await as(4, "select vx_sub_v2_has_free_grant('academy');"), 't');
  assert.equal(await as(3, "select vx_sub_v2_has_free_grant('academy');"), 'f');
  await as(1, `select vx_sub_v2_manage_grant('${user}','extend',${grant},now()+interval '2 days');`);
  await as(1, `select vx_sub_v2_manage_grant('${user}','revoke',${grant});`);
  assert.equal(await as(4, "select vx_sub_v2_has_free_grant('academy');"), 'f');
  assert.equal(await as(4, "select vx_sub_v2_can_access('academy');"), 't');
  await sql(`insert into vx_sub_v2.free_grants(user_id,starts_at,expires_at)
    values('${user}',now()-interval '2 days',now()-interval '1 day');`);
  assert.equal(await as(4, "select vx_sub_v2_has_free_grant('academy');"), 'f');
});


test('isolated receipt permissions and legacy cutover', { skip: process.env.VX_SUB_RUN_POSTGRES !== '1' }, async () => {
  for (const name of ['007-private-receipts.review.sql', '008-receipt-intake.review.sql',
    '009-disable-legacy-payment.cutover.sql', '010-legacy-academy-reader.review.sql']) {
    await sql(await readFile(new URL('../../docs/security/subscriptions-v2/' + name, import.meta.url), 'utf8'));
  }
  await sql("insert into storage.objects values ('vexora-v2-receipts','fixture'),('another-bucket','fixture');");
  assert.equal(await as(2, "select count(*) from storage.objects;"), '1');
  await assert.rejects(as(2, "insert into storage.objects values ('vexora-v2-receipts','fixture-write');"), /row-level security/);
  const order = await request(3, 198);
  assert.equal(await as(3, `select vx_sub_v2_may_upload_receipt('${order}');`), 't');
  assert.equal(await as(2, `select vx_sub_v2_may_upload_receipt('${order}');`), 'f');
  await bind(3, order);
  assert.equal(await as(3, `select vx_sub_v2_may_upload_receipt('${order}');`), 'f');
  const userId = id(2);
  await assert.rejects(sql(`insert into public.purchases(user_id,kind,status) values('${userId}','monthly','paid');`),
    /Legacy payment approval disabled/);
  assert.equal(await sql("select count(*) from public.purchases where status='paid';"), '1');
  assert.equal(await as(2, "select vx_sub_v2_legacy_academy_until() > now();"), 't');
  assert.equal(await as(3, "select vx_sub_v2_legacy_academy_until() is null;"), 't');
});
