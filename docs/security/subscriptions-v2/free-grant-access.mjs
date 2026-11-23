import { isPaidFeature } from './subscription-features.mjs';

export async function hasFreeGrant(userClient, feature) {
  if (!isPaidFeature(feature)) throw new TypeError('Unknown paid feature');
  const { data, error } = await userClient.rpc('vx_sub_v2_has_free_grant', { p_feature: feature });
  if (error) throw Object.assign(new Error('Grant verification unavailable'), { status: 503 });
  return data === true;
}
