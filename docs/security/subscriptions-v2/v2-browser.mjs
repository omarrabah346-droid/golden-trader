import { createSubscriptionOrder } from './subscription-client.mjs';

const planIds = {
  student: '00000000-0000-4000-8000-000000000010',
  partner: '00000000-0000-4000-8000-000000000011'
};

const features = [
  ['academy', 'الأكاديمية والدورات'],
  ['vip', 'قنوات VIP والتوصيات'],
  ['indicators', 'المؤشرات وأدوات التحليل'],
  ['marketing', 'مركز التسويق واستوديو الفيديو'],
  ['ai', 'أدوات الذكاء الاصطناعي'],
  ['extras', 'المزايا الإضافية']
];

const states = {
  pending: 'قيد مراجعة المالك',
  approved: 'معتمد',
  rejected: 'مرفوض',
  active: 'نشط',
  expired: 'منتهي',
  scheduled: 'مجدول',
  revoked: 'مسحوب'
};

const node = (tag, text, className) => {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
};

const dateText = value => value
  ? new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—';

const amountText = cents => new Intl.NumberFormat('ar', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(Number(cents || 0) / 100);

async function rpc(client, name, args) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw new Error(`تعذر تنفيذ الخدمة (${name})`);
  return data;
}

async function uploadReceipt(client, orderId, file) {
  const query = new URLSearchParams({ action: 'upload', order: orderId });
  const { data, error } = await client.functions.invoke(`vexora-v2-receipts?${query}`, {
    body: file,
    headers: { 'Content-Type': 'application/octet-stream' }
  });
  if (error || data?.received !== true) throw new Error('تعذر رفع الإيصال');
}

export async function submitV2Order(client, { planId, requestId, receipt, onCreated }) {
  const order = await createSubscriptionOrder(client, requestId, planId);
  const expected = order.kind === 'initial' ? 30000 : order.kind === 'renewal' ? 10000 : null;
  if (expected === null || Number(order.amount_cents) !== expected) {
    throw new Error('المبلغ الذي أعاده الخادم لا يطابق سعر الباقة');
  }
  onCreated?.(order);
  if (receipt) await uploadReceipt(client, order.order_id, receipt);
  return order;
}

export async function mountV2Order(root, client, audience) {
  root.classList.add('vx-v2');
  root.dir = 'rtl';
  root.setAttribute('aria-label', 'إدارة اشتراك VEXORA V2');

  const head = node('header', undefined, 'vx-v2__header');
  head.append(node('span', 'VEXORA V2', 'vx-v2__eyebrow'));
  head.append(node('h2', 'اشتراك واحد، كل مزايا المنصة', 'vx-v2__title'));
  head.append(node('p', 'يبدأ الاشتراك بعد اعتماد المالك للتحويل. لا توجد عملية دفع آلية.', 'vx-v2__copy'));

  const prices = node('div', undefined, 'vx-v2__prices');
  prices.append(priceCard('التفعيل الأول', '$300', 'لمدة شهر واحد'));
  prices.append(priceCard('التجديد', '$100', 'لكل شهر إضافي'));

  const overview = node('section', undefined, 'vx-v2__overview');
  const status = node('p', 'جارٍ تحميل حالة الاشتراك…', 'vx-v2__notice');
  status.setAttribute('role', 'status');
  const featuresRoot = node('ul', undefined, 'vx-v2__features');
  const orderHistory = node('div', undefined, 'vx-v2__orders');
  overview.append(status, featuresRoot, orderHistory);

  const note = node('p', 'حقوق المشتريات القديمة، ومنها الدورات مدى الحياة، مستقلة عن اشتراك V2 ولا تُلغى بانتهائه.', 'vx-v2__legacy-note');

  const form = node('form', undefined, 'vx-v2__form');
  const formTitle = node('h3', 'طلب اشتراك أو تجديد', 'vx-v2__form-title');
  const audienceLabel = node('label', 'نوع الحساب', 'vx-v2__label');
  const audienceSelect = node('select', undefined, 'vx-v2__select');
  audienceSelect.setAttribute('aria-label', 'اختيار نوع الحساب');
  audienceSelect.add(new Option('طالب', 'student'));
  audienceSelect.add(new Option('شريك', 'partner'));
  if (audience === 'partner') audienceSelect.value = 'partner';
  audienceLabel.append(audienceSelect);
  const fileLabel = node('label', 'إيصال التحويل', 'vx-v2__label');
  const file = node('input', undefined, 'vx-v2__file');
  file.type = 'file';
  file.accept = '.pdf,.jpg,.jpeg,.png,.webp';
  file.required = true;
  fileLabel.append(file);
  const submit = node('button', 'إنشاء الطلب ورفع الإيصال', 'vx-v2__button');
  submit.type = 'submit';
  submit.disabled = true;
  const formStatus = node('p', '', 'vx-v2__form-status');
  formStatus.setAttribute('role', 'status');
  const pendingSelect = node('select', undefined, 'vx-v2__select');
  pendingSelect.setAttribute('aria-label', 'طلب معلق لإرفاق الإيصال');
  form.append(formTitle, audienceLabel, fileLabel, pendingSelect, submit, formStatus);

  root.replaceChildren(head, prices, overview, note, form);

  let dashboard = { subscription: null, orders: [], access: {} };
  let loadEpoch = 0;
  let requestId = crypto.randomUUID();

  async function refresh() {
    const epoch = ++loadEpoch;
    status.textContent = 'جارٍ تحميل حالة الاشتراك…';
    try {
      const [statusRows, orderRows] = await Promise.all([
        rpc(client, 'vx_sub_v2_my_status'),
        rpc(client, 'vx_sub_v2_my_orders')
      ]);
      if (epoch !== loadEpoch) return;
      const orders = await Promise.all((orderRows || []).map(async order => {
        if (order.state !== 'pending') return { ...order, canUploadReceipt: false };
        try {
          const allowed = await rpc(client, 'vx_sub_v2_may_upload_receipt', { p_order: order.order_id });
          return { ...order, canUploadReceipt: allowed === true };
        } catch {
          return { ...order, canUploadReceipt: false };
        }
      }));
      const accessRows = await Promise.all(features.map(async ([feature]) => {
        try {
          const [current, legacy] = await Promise.all([
            rpc(client, 'vx_sub_v2_can_access', { p_feature: feature }),
            feature === 'academy' || feature === 'ai'
              ? rpc(client, 'vx_sub_v2_has_legacy_grant', { p_feature: feature, p_course: null })
              : Promise.resolve(false)
          ]);
          return [feature, current === true || legacy === true];
        } catch {
          return [feature, null];
        }
      }));
      if (epoch !== loadEpoch) return;
      dashboard = {
        subscription: statusRows?.[0] || null,
        orders,
        access: Object.fromEntries(accessRows)
      };
      renderDashboard();
    } catch {
      status.textContent = 'تعذر تحميل الحالة من خدمة الاشتراكات. أعد المحاولة لاحقاً.';
      featuresRoot.replaceChildren();
      orderHistory.replaceChildren();
    }
  }

  function renderDashboard() {
    const subscription = dashboard.subscription;
    const label = subscription ? (states[subscription.state] || 'الحالة غير معروفة') : 'لم يبدأ اشتراك V2 بعد';
    status.replaceChildren(
      node('strong', label, `vx-v2__state vx-v2__state--${subscription?.state || 'none'}`),
      node('span', subscription?.expires_at ? `الانتهاء: ${dateText(subscription.expires_at)}` : 'تُفعّل المزايا بعد اعتماد المالك')
    );

    featuresRoot.replaceChildren(...features.map(([key, title]) => {
      const item = node('li', undefined, 'vx-v2__feature');
      item.append(node('span', title));
      const permitted = dashboard.access[key];
      const state = permitted === null ? 'تعذر التحقق' : permitted ? 'متاحة' : 'تحتاج استحقاقاً نشطاً';
      item.append(node('span', state, permitted === true ? 'vx-v2__feature-state is-on' : 'vx-v2__feature-state'));
      return item;
    }));

    const orders = dashboard.orders;
    orderHistory.replaceChildren(node('h3', 'سجل الطلبات', 'vx-v2__section-title'));
    if (!orders.length) {
      orderHistory.append(node('p', 'لا توجد طلبات سابقة.', 'vx-v2__muted'));
    } else {
      const list = node('ul', undefined, 'vx-v2__order-list');
      for (const order of orders) {
        const row = node('li', undefined, 'vx-v2__order-row');
        const amount = amountText(order.amount_cents);
        const kind = order.kind === 'initial' ? 'تفعيل أول' : 'تجديد';
        row.append(node('span', `${kind} · ${amount}`, 'vx-v2__order-name'));
        row.append(node('span', states[order.state] || 'حالة غير معروفة', `vx-v2__order-state vx-v2__order-state--${order.state}`));
        row.append(node('time', dateText(order.created_at), 'vx-v2__muted'));
        if (order.state === 'pending') {
          row.append(node('span', order.canUploadReceipt ? 'بانتظار الإيصال' : 'بانتظار مراجعة المالك', 'vx-v2__muted'));
        }
        list.append(row);
      }
      orderHistory.append(list);
    }

    const pending = orders.filter(order => order.state === 'pending');
    const uploadable = pending.filter(order => order.canUploadReceipt);
    pendingSelect.replaceChildren();
    if (uploadable.length) {
      pendingSelect.hidden = false;
      pendingSelect.required = true;
      for (const order of uploadable) {
        const option = new Option(`${order.kind === 'initial' ? 'تفعيل' : 'تجديد'} · ${amountText(order.amount_cents)} · ${dateText(order.created_at)}`, order.order_id);
        pendingSelect.add(option);
      }
      submit.textContent = 'رفع الإيصال للطلب المحدد';
    } else {
      pendingSelect.hidden = true;
      pendingSelect.required = false;
      submit.textContent = subscription?.state === 'revoked' ? 'تواصل مع المالك لإعادة التفعيل' : (subscription ? 'طلب التجديد ورفع الإيصال · 100$' : 'طلب التفعيل ورفع الإيصال · 300$');
    }
    const canRequest = subscription?.state !== 'revoked' && (pending.length === 0 || uploadable.length > 0);
    submit.disabled = !canRequest;
    if (pending.length && !uploadable.length) formStatus.textContent = 'يوجد طلب قيد المراجعة. لا تنشئ طلباً مكرراً؛ الإيصال بانتظار مراجعة المالك.';
    else if (subscription?.state === 'revoked') formStatus.textContent = 'الاشتراك المسحوب يحتاج مراجعة المالك قبل طلب جديد.';
    else formStatus.textContent = 'يتحقق الخادم من تسجيل الحساب ضمن المسار المختار قبل إنشاء الطلب.';
  }

  form.onsubmit = async event => {
    event.preventDefault();
    const receipt = file.files?.[0];
    if (!receipt) return;
    if (receipt.size > 5 * 1024 * 1024) {
      formStatus.textContent = 'حجم الإيصال يتجاوز 5 ميغابايت.';
      return;
    }
    const selectedOrder = pendingSelect.hidden ? null : pendingSelect.value;
    submit.disabled = true;
    formStatus.textContent = 'جارٍ إرسال الطلب والإيصال بأمان…';
    try {
      if (selectedOrder) {
        await uploadReceipt(client, selectedOrder, receipt);
      } else {
        await submitV2Order(client, {
          planId: planIds[audienceSelect.value],
          requestId,
          receipt,
          onCreated: () => { requestId = crypto.randomUUID(); }
        });
      }
      formStatus.textContent = 'تم إرسال الإيصال. الطلب بانتظار مراجعة المالك.';
      file.value = '';
      await refresh();
    } catch {
      formStatus.textContent = 'تعذر إكمال الإرسال. قد يكون الطلب محفوظاً أو الإيصال مرفقاً مسبقاً؛ حدّث الحالة أو تواصل مع المالك.';
      await refresh();
    } finally {
      const pendingOrders = dashboard.orders.filter(order => order.state === 'pending');
      submit.disabled = dashboard.subscription?.state === 'revoked'
        || (pendingOrders.length > 0 && !pendingOrders.some(order => order.canUploadReceipt));
    }
  };

  await refresh();
}

function priceCard(title, price, detail) {
  const card = node('article', undefined, 'vx-v2__price');
  card.append(node('span', title, 'vx-v2__eyebrow'));
  card.append(node('strong', price, 'vx-v2__price-value'));
  card.append(node('span', detail, 'vx-v2__muted'));
  return card;
}

export async function mountV2Owner(root, client, supabaseUrl) {
  const { mountOwnerSubscriptions } = await import('./owner-panel.mjs');
  const receiptOrigin = new URL(supabaseUrl).origin;
  await mountOwnerSubscriptions(root, client, async order => {
    const query = new URLSearchParams({ action: 'view', order });
    const { data, error } = await client.functions.invoke(`vexora-v2-receipts?${query}`, { body: {} });
    if (error || !data?.url) throw new Error('تعذر إنشاء رابط الإيصال');
    const url = new URL(data.url);
    if (url.origin !== receiptOrigin) throw new Error('رابط الإيصال صادر من وجهة غير متوقعة');
    return url.href;
  });
}
