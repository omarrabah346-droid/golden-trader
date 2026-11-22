import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../../docs/security/vexora-subscriptions-v2.draft.sql', import.meta.url), 'utf8');

function plusMonth(instant) {
  const date = new Date(instant);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + 1);
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, last));
  return date.getTime();
}

function fixture(orders) {
  const payments = new Map();
  const decisions = new Map();
  const subscriptions = new Map();
  let tail = Promise.resolve();

  function approve(actor, orderId, key, cents, time) {
    // Reference atomicity only. PostgreSQL locks and RLS are outside this test.
    const next = tail.then(() => {
      assert.equal(actor, 'verified-owner', 'forbidden');
      const order = orders[orderId];
      assert.equal(cents, order.kind === 'initial' ? 30000 : 10000, 'wrong price');
      const prior = decisions.get(orderId);
      if (prior) {
        assert.equal(prior.key, key, 'approval payload mismatch');
        return prior.expiry;
      }
      assert.ok(!payments.has(key), 'duplicate settlement');
      const previous = subscriptions.get(order.user);
      assert.equal(order.kind === 'initial', previous === undefined, 'invalid lifecycle');
      assert.ok(!previous?.revoked, 'revoked');
      const start = Math.max(Date.parse(time), previous?.expiry ?? 0);
      const expiry = plusMonth(start);
      payments.set(key, orderId);
      decisions.set(orderId, { key, expiry });
      subscriptions.set(order.user, { expiry });
      return expiry;
    });
    tail = next.catch(() => {});
    return next;
  }

  return {
    approve,
    view(actor, time) {
      const subscription = subscriptions.get(actor);
      return Boolean(subscription && !subscription.revoked && Date.parse(time) < subscription.expiry);
    },
    revoke(actor, user) {
      assert.equal(actor, 'verified-owner', 'forbidden');
      subscriptions.get(user).revoked = true;
    },
    history(actor) {
      return [...decisions.keys()].filter(id => orders[id].user === actor);
    },
  };
}

const jan = '2026-01-31T12:00:00Z';
const feb = '2026-02-28T12:00:00Z';
const initial = { user: 'A', kind: 'initial' };
const renewal = { user: 'A', kind: 'renewal' };

test('draft is inert and contains proposed isolation and idempotency controls', () => {
  assert.equal(sql.replace(/\/\*[\s\S]*?\*\/|^--.*$/gm, '').trim(), '');
  for (const pattern of [
    /payment_key text not null unique/i,
    /unique \(user_id, request_id\)/i,
    /for update/i,
    /pg_advisory_xact_lock/i,
    /require_owner\(\)/i,
    /enable row level security/i,
    /revoke all on all tables.+authenticated/i,
    /set search_path = ''/i,
  ]) assert.match(sql, pattern);
  assert.doesNotMatch(sql, /create or replace/i);
});

test('retries of the same approval return the original expiry once', async () => {
  const f = fixture({ a: initial });
  const call = () => f.approve('verified-owner', 'a', 'rail:scope:1', 30000, jan);
  assert.deepEqual(await Promise.all([call(), call()]), [Date.parse(feb), Date.parse(feb)]);
  await assert.rejects(f.approve('verified-owner', 'a', 'rail:scope:2', 30000, jan), /payload/);
  assert.deepEqual(f.history('A'), ['a']);
});

test('concurrent use of one settlement across users has one winner', async () => {
  const f = fixture({ a: initial, b: { ...initial, user: 'B' } });
  const results = await Promise.allSettled(['a', 'b'].map(id =>
    f.approve('verified-owner', id, 'rail:scope:1', 30000, jan)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /duplicate settlement/);
  assert.equal(f.history('A').length + f.history('B').length, 1);
});

test('a second initial order cannot grant a second initial period', async () => {
  const f = fixture({ a: initial, b: initial });
  const results = await Promise.allSettled(['a','b'].map(id =>
    f.approve('verified-owner', id, 'rail:scope:' + id, 30000, jan)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /invalid lifecycle/);
});

test('staff, users, and anonymous cannot grant or revoke; price is server-set', async () => {
  const f = fixture({ a: initial });
  for (const actor of ['staff', 'A', null]) {
    await assert.rejects(f.approve(actor, 'a', 'rail:scope:1', 30000, jan), /forbidden/);
    assert.throws(() => f.revoke(actor, 'A'), /forbidden/);
  }
  await assert.rejects(f.approve('verified-owner', 'a', 'rail:scope:1', 10000, jan), /wrong price/);
  assert.deepEqual(f.history('A'), []);
});

test('early and late renewal use the correct base; expiry and revocation preserve history', async () => {
  const f = fixture({ a: initial, b: renewal, c: renewal });
  await f.approve('verified-owner', 'a', 'rail:scope:1', 30000, jan);
  assert.equal(f.view('A', feb), false);
  assert.equal(f.view('B', jan), false);
  assert.equal(await f.approve('verified-owner', 'b', 'rail:scope:2', 10000, '2026-02-12T12:00:00Z'),
    Date.parse('2026-03-28T12:00:00Z'));
  assert.equal(await f.approve('verified-owner', 'c', 'rail:scope:3', 10000, '2026-04-03T12:00:00Z'),
    Date.parse('2026-05-03T12:00:00Z'));
  assert.equal(f.view('A', '2026-04-04T12:00:00Z'), true);
  f.revoke('verified-owner', 'A');
  assert.equal(f.view('A', '2026-04-04T12:00:00Z'), false);
  assert.deepEqual(f.history('A'), ['a', 'b', 'c']);
  assert.deepEqual(f.history('B'), []);
});
