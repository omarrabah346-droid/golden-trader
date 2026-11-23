const paidFeatures = new Set(['academy', 'vip', 'indicators', 'marketing', 'ai', 'extras']);

export const isPaidFeature = feature => paidFeatures.has(feature);
