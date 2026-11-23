import { requireV2Feature } from '../../docs/security/subscriptions-v2/server-entitlements.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSubscriptionOrder, loadSubscriptionFeatures } from
  '../../docs/security/subscriptions-v2/subscription-client.mjs';

test('order request forwards stable request and plan IDs with server-set pricing', async () => {
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'vx_sub_v2_request');
    assert.deepEqual(args, { p_request_id: 'request', p_plan: 'plan' });
    return { data: [{ order_id: 'order', kind: 'renewal', amount_cents: 10000 }] };
  }};
  assert.equal((await createSubscriptionOrder(client, 'request', 'plan')).amount_cents, 10000);
});

test('UI entitlements follow the active plan and fail closed for other states', async () => {
  for (const status of ['active', 'expired', 'scheduled', 'revoked', undefined]) {
    const allowed = await loadSubscriptionFeatures({ rpc: async name => {
      assert.equal(name, 'vx_sub_v2_my_status');
      return { data: status ? [{ state: status, features: ['academy', 'vip', 'other'] }] : [] };
    }});
    assert.equal(allowed('academy'), status === 'active');
    assert.equal(allowed('vip'), status === 'active');
    assert.equal(allowed('marketing'), false);
    assert.equal(allowed('other'), false);
  }
  await assert.rejects(loadSubscriptionFeatures({ rpc: async () => ({ error: true }) }), /Could not load/);
});

test('server checks every paid feature on each request and rejects non-paid permissions', async () => {
  const calls = [];
  let active = true;
  const client = { rpc: async (name, args) => {
    assert.equal(name, 'vx_sub_v2_can_access');
    calls.push(args.p_feature);
    return { data: active };
  }};
  const features = ['academy', 'vip', 'indicators', 'marketing', 'ai', 'extras'];
  for (const feature of features) await requireV2Feature(client, feature);
  active = false;
  await assert.rejects(requireV2Feature(client, 'academy'), { status: 403 });
  active = true;
  await requireV2Feature(client, 'academy');
  await assert.rejects(requireV2Feature(client, 'admin'), TypeError);
  await assert.rejects(requireV2Feature(client, 'owner'), TypeError);
  await assert.rejects(requireV2Feature({ rpc: async () => ({ error: true }) }, 'vip'), { status: 503 });
  assert.deepEqual(calls, [...features, 'academy', 'academy']);
});
