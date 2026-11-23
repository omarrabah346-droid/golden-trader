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
