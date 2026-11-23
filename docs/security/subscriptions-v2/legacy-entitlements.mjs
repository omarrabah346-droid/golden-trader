import { isPaidFeature } from './subscription-features.mjs';

const validDate = value => typeof value === 'string' && Number.isFinite(Date.parse(value));

// All inputs are normalized on the server from verified sources. Missing data must
// be marked unresolved by the adapter. Retain source records outside this projection.
export function resolveEntitlement({ feature, resourceId, legacy, v2Allowed, at }) {
  if (!isPaidFeature(feature) || !resourceId || !validDate(at)) {
    throw new TypeError('Invalid entitlement input');
  }
  if (legacy.lifetimeResources.includes(resourceId)) return 'lifetime';
  if (legacy.activeResources.includes(resourceId) && validDate(legacy.expiresAt)
      && Date.parse(at) < Date.parse(legacy.expiresAt)) return 'legacy';
  if (!['new', 'existing'].includes(legacy.state)) return 'review';
  if (legacy.state === 'existing' && (!validDate(legacy.expiresAt)
      || Date.parse(at) < Date.parse(legacy.expiresAt) || legacy.ownerCleared !== true)) return 'none';
  return v2Allowed === true ? 'v2' : 'none';
}

export function legacyReviewReport(records) {
  const counts = { missingExpiry: 0, ambiguousRights: 0, missingSettlementEvidence: 0 };
  let affectedAccounts = 0;
  for (const record of records) {
    const missingExpiry = record.state === 'existing' && !validDate(record.expiresAt);
    const ambiguousRights = record.state === 'unresolved';
    const missingSettlementEvidence = record.settlementReviewRequired === true;
    if (missingExpiry) counts.missingExpiry++;
    if (ambiguousRights) counts.ambiguousRights++;
    if (missingSettlementEvidence) counts.missingSettlementEvidence++;
    if (missingExpiry || ambiguousRights || missingSettlementEvidence) affectedAccounts++;
  }
  return { affectedAccounts, counts };
}
