import { isPaidFeature } from './subscription-features.mjs';

// Install in server endpoints with a client bound to the verified caller's JWT.
// Feature names are chosen by the endpoint. They must not come from request data.
export async function requireV2Feature(userClient, feature) {
  if (!isPaidFeature(feature)) throw new TypeError('Unknown VEXORA paid feature');
  const { data, error } = await userClient.rpc('vx_sub_v2_can_access', { p_feature: feature });
  if (error) throw Object.assign(new Error('Subscription verification unavailable'), { status: 503 });
  if (data !== true) throw Object.assign(new Error('Active VEXORA subscription required'), { status: 403 });
}
