import { isPaidFeature } from './subscription-features.mjs';

export async function loadSubscriptionFeatures(client) {
  const { data, error } = await client.rpc('vx_sub_v2_my_status');
  if (error) throw new Error('Could not load subscription status');
  const status = data?.[0];
  const features = new Set(status?.state === 'active' ? status.features : []);
  // UI access only. Each protected backend must check the same session's entitlement.
  return feature => isPaidFeature(feature) && features.has(feature);
}

export async function createSubscriptionOrder(client, requestId, planId) {
  const { data, error } = await client.rpc('vx_sub_v2_request', {
    p_request_id: requestId,
    p_plan: planId
  });
  if (error || !data?.[0]) throw new Error('Could not create subscription order');
  return data[0];
}
