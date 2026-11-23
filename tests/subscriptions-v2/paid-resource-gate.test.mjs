import assert from 'node:assert/strict';
import { test } from 'node:test';
import { requirePaidResource } from '../../docs/security/subscriptions-v2/paid-resource-gate.mjs';

const legacy = { state: 'existing', expiresAt: '2020-01-01T00:00:00Z', ownerCleared: true,
  lifetimeResources: ['course:a'], activeResources: [] };

test('the resource gate preserves a lifetime purchase independently of V2 availability', async () => {
  const input = { operation: 'lessonBody', resourceId: 'course:a',
    readLegacy: async () => legacy, userClient: { rpc: () => assert.fail('V2 lookup') } };
  assert.equal(await requirePaidResource(input), 'lifetime');
  await assert.rejects(requirePaidResource({ ...input, resourceId: 'course:b',
    userClient: { rpc: async () => ({ data: false }) } }), { status: 403 });
});

test('the resource gate checks the endpoint-selected feature and blocks unresolved history', async () => {
  const input = { operation: 'videoStudio', resourceId: 'studio:render',
    readLegacy: async () => legacy, userClient: { rpc: async (name, params) => {
      if (name === 'vx_sub_v2_has_free_grant') return { data: false };
      assert.equal(name, 'vx_sub_v2_can_access');
      assert.deepEqual(params, { p_feature: 'marketing' });
      return { data: true };
    }} };
  assert.equal(await requirePaidResource(input), 'v2');
  await assert.rejects(requirePaidResource({ ...input, readLegacy: async () => ({
    ...legacy, state: 'unresolved'
  }) }), { status: 503 });
  await assert.rejects(requirePaidResource({ ...input, operation: 'constructor' }), TypeError);
});

test('a free grant works independently of V2 and prior term clearance', async () => {
  const decision = await requirePaidResource({
    operation: 'aiRequest', resourceId: 'ai:ask',
    readLegacy: async () => ({ ...legacy, ownerCleared: false }),
    userClient: { rpc: async (name, args) => {
      assert.equal(name, 'vx_sub_v2_has_free_grant');
      assert.deepEqual(args, { p_feature: 'ai' });
      return { data: true };
    }}
  });
  assert.equal(decision, 'grant');
});
