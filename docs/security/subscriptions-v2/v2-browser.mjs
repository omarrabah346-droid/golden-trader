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
  await uploadReceipt(client, order.order_id, receipt);
  return order;
}

async function uploadReceipt(client, orderId, receipt) {
  const query = new URLSearchParams({ action: 'upload', order: orderId });
  const { data, error } = await client.functions.invoke('vexora-v2-receipts?' + query, {
    body: receipt, headers: { 'Content-Type': 'application/octet-stream' }
  });
  if (error || data?.received !== true) throw new Error('Receipt upload unavailable');
}

const plans = [
  ['00000000-0000-4000-8000-000000000010', 'طالب'],
  ['00000000-0000-4000-8000-000000000011', 'شريك']
];

export async function mountV2Order(root, client) {
  const form = document.createElement('form');
  const choice = document.createElement('select');
  choice.setAttribute('aria-label', 'اختر الباقة أو الطلب السابق');
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = '.pdf,.jpg,.jpeg,.png,.webp';
  file.required = true;
  file.setAttribute('aria-label', 'إيصال الدفع');
  const send = document.createElement('button');
  send.textContent = 'إرسال الإيصال';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  const options = new Map();
  for (const [id, label] of plans) {
    choice.add(new Option(label + ' · طلب جديد', id));
    options.set(id, { planId: id, requestId: crypto.randomUUID() });
  }
  const { data, error } = await client.rpc('vx_sub_v2_my_orders');
  if (error) throw new Error('Unable to read prior orders');
  for (const order of data ?? []) {
    if (order.state !== 'pending') continue;
    choice.add(new Option('طلب معلّق · ' + order.order_id, order.order_id));
    options.set(order.order_id, { orderId: order.order_id });
  }
  form.append(choice, file, send, status);
  root.replaceChildren(form);
  form.onsubmit = async event => {
    event.preventDefault();
    const selected = options.get(choice.value);
    const receipt = file.files?.[0];
    if (!selected || !receipt) return;
    send.disabled = true;
    try {
      if (!selected.orderId) {
        const order = await createSubscriptionOrder(client, selected.requestId, selected.planId);
        selected.orderId = order.order_id;
      }
      await uploadReceipt(client, selected.orderId, receipt);
      status.textContent = 'وصل الإيصال للمراجعة.';
      file.value = '';
    } catch {
      status.textContent = 'تعذر إرسال الإيصال. أعد المحاولة على نفس الطلب.';
    } finally {
      send.disabled = false;
    }
  };
}
