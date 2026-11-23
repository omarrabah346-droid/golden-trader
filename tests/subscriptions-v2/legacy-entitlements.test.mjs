import assert from 'node:assert/strict';
import { test } from 'node:test';
import { legacyReviewReport, resolveEntitlement } from
  '../../docs/security/subscriptions-v2/legacy-entitlements.mjs';

const expiresAt = '2026-12-01T12:00:00Z';
const existing = { state: 'existing', expiresAt, ownerCleared: true,
  lifetimeResources: ['course:a'], activeResources: ['vip:gold'] };
const access = (resourceId, at, options = {}) => resolveEntitlement({
  feature: 'academy', resourceId, at, legacy: existing, v2Allowed: false, ...options
});

test('an active legacy term keeps its verified resources until its exact expiry', () => {
  assert.equal(access('vip:gold', '2026-12-01T11:59:59.999Z'), 'legacy');
  assert.equal(access('vip:gold', expiresAt), 'none');
  assert.equal(access('new:resource', '2026-12-01T11:00:00Z', { v2Allowed: true }), 'none');
});

test('owner clearance and an active V2 term are both required after legacy expiry', () => {
  assert.equal(access('new:resource', expiresAt, { v2Allowed: true }), 'v2');
  assert.equal(access('new:resource', expiresAt, {
    v2Allowed: true, legacy: { ...existing, ownerCleared: false }
  }), 'none');
  assert.equal(access('new:resource', expiresAt, {
    v2Allowed: true, legacy: { state: 'new', activeResources: [], lifetimeResources: [] }
  }), 'v2');
});

test('a lifetime course still works after expiry and never grants other courses', () => {
  assert.equal(access('course:a', expiresAt), 'lifetime');
  assert.equal(access('course:b', expiresAt), 'none');
  assert.equal(access('course:a', expiresAt, { legacy: { ...existing, state: 'unresolved' } }), 'lifetime');
  assert.equal(access('course:b', expiresAt, { legacy: { ...existing, state: 'unresolved' } }), 'review');
});

test('the review report contains only aggregate counts and counts an account once', () => {
  assert.deepEqual(legacyReviewReport([
    { state: 'existing', userId: 'private', settlementReviewRequired: true },
    { state: 'unresolved', email: 'private@example.invalid' },
    existing
  ]), { affectedAccounts: 2, counts: { missingExpiry: 1, ambiguousRights: 1, missingSettlementEvidence: 1 } });
});
