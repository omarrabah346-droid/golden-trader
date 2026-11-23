import { requireV2Feature } from './server-entitlements.mjs';
import { resolveEntitlement } from './legacy-entitlements.mjs';

const paidOperations = Object.freeze({
  lessonBody: 'academy',
  lessonTranslation: 'academy',
  courseMedia: 'academy',
  vipSignals: 'vip',
  vipMembership: 'vip',
  indicatorAccess: 'indicators',
  paidAnalysis: 'indicators',
  marketingWorkspace: 'marketing',
  videoStudio: 'marketing',
  aiRequest: 'ai',
  aiResult: 'ai',
  paidExtra: 'extras'
});

// Endpoint code selects the operation and resolves the actual resource.
// The verified-session client and the scoped legacy reader must refer to
// the same authenticated caller. Check resource ownership separately.
export async function requirePaidResource({ operation, resourceId, userClient, readLegacy }) {
  if (!Object.hasOwn(paidOperations, operation) || typeof resourceId !== 'string' || !resourceId) {
    throw new TypeError('Unknown paid operation or resource');
  }
  const feature = paidOperations[operation];
  const legacy = await readLegacy(resourceId);
  const at = new Date().toISOString();
  const input = { feature, resourceId, legacy, at };
  const decision = resolveEntitlement({ ...input, v2Allowed: false });
  if (decision === 'lifetime' || decision === 'legacy') return decision;
  if (decision === 'review') {
    throw Object.assign(new Error('Prior entitlement requires review'), { status: 503 });
  }
  if (resolveEntitlement({ ...input, v2Allowed: true }) !== 'v2') {
    throw Object.assign(new Error('Resource entitlement required'), { status: 403 });
  }
  await requireV2Feature(userClient, feature);
  return 'v2';
}
