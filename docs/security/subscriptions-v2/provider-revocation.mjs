const supportedProviders = new Set(['telegram', 'tradingview']);

// withCurrentRights must serialize the current mapped resource revision and
// all competing entitlement writes until the provider call has completed.
export async function revokeProviderAccess({ provider, userId, resourceId, revision,
  withCurrentRights, revoke }) {
  if (!supportedProviders.has(provider) || !userId || !resourceId || revision == null) {
    throw new TypeError('Invalid provider work item');
  }
  const target = Object.freeze({ provider, userId, resourceId, revision });
  return withCurrentRights(target, async rights => {
    if (!rights || rights.revision !== revision || rights.mappingVerified !== true ||
        rights.legacy !== false || rights.lifetime !== false || rights.v2 !== false) {
      return 'retained';
    }
    await revoke(target);
    return 'revoked';
  });
}
