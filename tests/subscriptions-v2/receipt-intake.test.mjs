import assert from 'node:assert/strict';
import { test } from 'node:test';
import { receiptType } from '../../supabase/functions/vexora-v2-receipts/receipt-format.mjs';
import { requirePaidResource } from '../../docs/security/subscriptions-v2/paid-resource-gate.mjs';

test('receipt classification uses the bytes and rejects mismatched or truncated headers', () => {
  assert.equal(receiptType(new TextEncoder().encode('%PDF-1.7')).extension, 'pdf');
  assert.equal(receiptType(new TextEncoder().encode('<svg/>')), null);
  assert.equal(receiptType(Uint8Array.from([137,80,78,71])), null);
});

test('existing academy monthly access survives expiry of unrelated V2 access', async () => {
  const source = await requirePaidResource({
    operation: 'lessonBody', resourceId: 'course:fixture',
    readLegacy: async () => ({ state: 'unresolved', lifetimeResources: [], activeResources: [] }),
    userClient: { rpc: async (name) => {
      assert.equal(name, 'vx_sub_v2_has_legacy_grant');
      return { data: true };
    }}
  });
  assert.equal(source, 'legacy');
});
