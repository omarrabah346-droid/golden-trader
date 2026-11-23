import assert from 'node:assert/strict';
import { test } from 'node:test';

test('local Supabase HTTP: receipt upload, private object access, owner signed read', {
  skip: process.env.VX_SUB_RUN_LOCAL_HTTP !== '1',
  timeout: 20_000
}, async () => {
  const root = new URL(process.env.VX_SUB_LOCAL_URL ?? 'http://127.0.0.1:54321');
  assert.match(root.hostname, /^(127\.0\.0\.1|localhost|\[::1\])$/);
  assert.equal(root.pathname, '/');
  const { VX_SUB_TEST_ANON_KEY: key, VX_SUB_TEST_MEMBER_JWT: member,
    VX_SUB_TEST_OTHER_JWT: other, VX_SUB_TEST_OWNER_JWT: owner,
    VX_SUB_TEST_ORDER: order } = process.env;
  assert.ok(key && member && other && owner && order, 'Provide isolated fixture credentials and a fresh member order');
  const endpoint = new URL('functions/v1/vexora-v2-receipts', root);
  endpoint.searchParams.set('order', order);
  const bytes = new TextEncoder().encode('%PDF-1.4\n% VEXORA synthetic receipt\n%%EOF');
  function send(action, token, body) {
    endpoint.searchParams.set('action', action);
    return fetch(endpoint, {
      method: 'POST', redirect: 'error',
      headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/octet-stream' },
      body
    });
  }
  assert.equal((await send('upload', other, bytes)).status, 403);
  assert.equal((await send('upload', member, bytes)).status, 201);
  assert.equal((await send('view', other)).status, 403);
  assert.equal((await send('view', member)).status, 403);
  const view = await send('view', owner);
  assert.equal(view.status, 200);
  const signed = new URL((await view.json()).url);
  assert.equal(signed.origin, root.origin);
  const direct = new URL(signed);
  assert.match(direct.pathname, /\/object\/sign\/vexora-v2-receipts\//);
  direct.pathname = direct.pathname.replace('/object/sign/', '/object/authenticated/');
  direct.search = '';
  const rejected = await fetch(direct, {
    redirect: 'error', headers: { apikey: key, Authorization: 'Bearer ' + other }
  });
  assert.ok(rejected.status >= 400 && rejected.status < 500);
  const downloaded = await fetch(signed, { redirect: 'error' });
  assert.equal(downloaded.status, 200);
  assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()), bytes);
});
