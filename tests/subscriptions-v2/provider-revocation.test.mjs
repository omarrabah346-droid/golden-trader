import assert from 'node:assert/strict';
import { test } from 'node:test';
import { revokeProviderAccess } from '../../docs/security/subscriptions-v2/provider-revocation.mjs';

test('external revocation requires fresh explicit denial from all three sources', async () => {
  const none = { mappingVerified: true, revision: 2, legacy: false, lifetime: false, grant: false, v2: false };
  for (const provider of ['telegram', 'tradingview']) {
    for (const rights of [null, { ...none, legacy: true }, { ...none, lifetime: true },
      { ...none, v2: true }, { ...none, grant: true }, { ...none, grant: undefined }, { ...none, lifetime: undefined }, { ...none, revision: 1 },
      { ...none, mappingVerified: false }, none]) {
      let calls = 0;
      const decision = await revokeProviderAccess({
        provider, userId: 'test-user', resourceId: 'test-resource', revision: 2,
        withCurrentRights: async (target, act) => act(rights),
        revoke: async target => { assert.equal(target.provider, provider); calls++; }
      });
      assert.equal(calls, rights === none ? 1 : 0);
      assert.equal(decision, rights === none ? 'revoked' : 'retained');
    }
  }
});
