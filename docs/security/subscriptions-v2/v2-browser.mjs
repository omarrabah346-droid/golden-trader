import { mountOwnerSubscriptions } from './owner-panel.mjs';
import { createSubscriptionOrder } from './subscription-client.mjs';

export async function mountV2Owner(root, client) {
  await mountOwnerSubscriptions(root, client, async order => {
    const query = new URLSearchParams({ action: 'view', order });
    const { data, error } = await client.functions.invoke('vexora-v2-receipts?' + query, { body: {} });
    if (error || !data?.url) throw new Error('Receipt unavailable');
    return data.url;
  });
}

export async function submitV2Order(client, { planId, requestId, receipt }) {
  const order = await createSubscriptionOrder(client, requestId, planId);
  const query = new URLSearchParams({ action: 'upload', order: order.order_id });
  const { data, error } = await client.functions.invoke('vexora-v2-receipts?' + query, {
    body: receipt, headers: { 'Content-Type': 'application/octet-stream' }
  });
  if (error || data?.received !== true) throw new Error('Receipt upload unavailable');
  return order;
}
