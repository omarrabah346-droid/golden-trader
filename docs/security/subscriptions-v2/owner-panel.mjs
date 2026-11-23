const labels = {
  pending: 'قيد المراجعة',
  approved: 'معتمد',
  rejected: 'مرفوض'
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const element = (tag, text, className) => {
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

async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(`vx_sub_v2_${name}`, args);
  if (error) throw new Error(`تعذر تنفيذ عملية المالك (${name})`);
  return data;
}

export async function mountOwnerSubscriptions(root, client, receiptUrl) {
  root.classList.add('vx-v2-owner');
  root.dir = 'rtl';
  root.setAttribute('aria-label', 'لوحة إدارة اشتراكات VEXORA V2');

  const header = element('header', undefined, 'vx-v2-owner__header');
  header.append(element('span', 'لوحة المالك · VEXORA V2', 'vx-v2__eyebrow'));
  header.append(element('h2', 'مراجعة الاشتراكات والمنح', 'vx-v2__title'));
  header.append(element('p', 'الاعتماد والرفض والسحب تتم عبر وظائف الخادم، وتبقى صلاحيات المالك منفصلة عن الاشتراك.', 'vx-v2__copy'));

  const status = element('p', '', 'vx-v2__notice');
  status.setAttribute('role', 'status');

  const controls = element('div', undefined, 'vx-v2-owner__controls');
  const filter = element('select', undefined, 'vx-v2__select');
  filter.setAttribute('aria-label', 'تصفية طلبات الاشتراك');
  for (const [value, text] of [['pending', 'طلبات قيد المراجعة'], ['all', 'كل الطلبات']]) {
    filter.add(new Option(text, value));
  }
  const refresh = button('تحديث الطلبات', 'vx-v2__button vx-v2__button--quiet');
  controls.append(filter, refresh);

  const orderList = element('div', undefined, 'vx-v2-owner__orders');

  const grants = element('section', undefined, 'vx-v2-owner__grants');
  grants.append(element('h3', 'إدارة المنح المجانية', 'vx-v2__section-title'));
  grants.append(element('p', 'الإضافة والتمديد والإلغاء لا تعدّل سجلات الدفع أو حقوق المشتريات القديمة.', 'vx-v2__muted'));
  const grantForm = element('form', undefined, 'vx-v2-owner__grant-form');
  const userLabel = element('label', 'معرّف المستخدم (UUID)', 'vx-v2__label');
  const userInput = element('input', undefined, 'vx-v2__input');
  userInput.type = 'text';
  userInput.required = true;
  userInput.autocomplete = 'off';
  userInput.spellcheck = false;
  userLabel.append(userInput);
  const expiryLabel = element('label', 'تاريخ انتهاء المنحة', 'vx-v2__label');
  const expiryInput = element('input', undefined, 'vx-v2__input');
  expiryInput.type = 'datetime-local';
  expiryLabel.append(expiryInput);
  const loadGrants = button('عرض منح المستخدم', 'vx-v2__button vx-v2__button--quiet');
  loadGrants.type = 'button';
  const createGrant = button('إضافة منحة شاملة', 'vx-v2__button');
  createGrant.type = 'button';
  const grantActions = element('div', undefined, 'vx-v2-owner__actions');
  grantActions.append(loadGrants, createGrant);
  grantForm.append(userLabel, expiryLabel, grantActions);
  const grantList = element('div', undefined, 'vx-v2-owner__grant-list');
  grants.append(grantForm, grantList);

  root.replaceChildren(header, status, controls, orderList, grants);

  let allOrders = [];
  const validUser = () => {
    const user = userInput.value.trim();
    if (!uuidPattern.test(user)) throw new Error('أدخل UUID صحيحاً للمستخدم.');
    return user;
  };
  const expiryIso = () => {
    if (!expiryInput.value) throw new Error('حدد تاريخ انتهاء المنحة.');
    const expiry = new Date(expiryInput.value);
    if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) {
      throw new Error('يجب أن يكون تاريخ الانتهاء في المستقبل.');
    }
    return expiry.toISOString();
  };

  async function showGrants() {
    const user = validUser();
    const rows = await rpc(client, 'owner_grants', { p_user: user });
    if (userInput.value.trim() !== user) return;
    grantList.replaceChildren();
    if (!rows?.length) {
      grantList.append(element('p', 'لا توجد منح مسجلة لهذا الحساب.', 'vx-v2__muted'));
      return;
    }
    for (const grant of rows) {
      const row = element('article', undefined, 'vx-v2-owner__grant');
      const revoked = Boolean(grant.revoked_at);
      row.append(element('strong', revoked ? 'منحة ملغاة' : 'منحة مجانية'));
      row.append(element('span', `تبدأ: ${dateText(grant.starts_at)}`));
      row.append(element('span', `تنتهي: ${dateText(grant.expires_at)}`));
      if (revoked) {
        row.append(element('span', `ألغيت: ${dateText(grant.revoked_at)}`, 'vx-v2__muted'));
      } else {
        const actions = element('div', undefined, 'vx-v2-owner__actions');
        const extend = button('تمديد حتى التاريخ المحدد', 'vx-v2__button vx-v2__button--quiet');
        extend.onclick = () => runAction(extend, async () => {
          await changeGrant(user, 'extend', grant.id);
        });
        const revoke = button('إلغاء المنحة', 'vx-v2__button vx-v2__button--danger');
        revoke.onclick = () => runAction(revoke, async () => {
          await changeGrant(user, 'revoke', grant.id);
        });
        actions.append(extend, revoke);
        row.append(actions);
      }
      grantList.append(row);
    }
  }

  async function changeGrant(user, action, grantId = null) {
    const expiry = action === 'revoke' ? null : expiryIso();
    await rpc(client, 'manage_grant', {
      p_user: user,
      p_action: action,
      p_grant: grantId,
      p_expiry: expiry
    });
    await showGrants();
    status.textContent = action === 'revoke' ? 'تم إلغاء المنحة من الخادم.' : 'تم حفظ المنحة على الخادم.';
  }

  loadGrants.onclick = async () => runAction(loadGrants, async () => {
    await showGrants();
    status.textContent = 'تم تحميل سجل المنح.';
  });
  createGrant.onclick = async () => runAction(createGrant, async () => {
    await changeGrant(validUser(), 'create');
  });
  userInput.oninput = () => grantList.replaceChildren();

  async function reload() {
    refresh.disabled = true;
    status.textContent = 'جارٍ تحميل الطلبات…';
    try {
      allOrders = await rpc(client, 'owner_review') || [];
      renderOrders();
      status.textContent = `تم تحميل ${allOrders.length} طلب من الخدمة.`;
    } catch {
      orderList.replaceChildren();
      status.textContent = 'تعذر تحميل الطلبات. تحقق من جلسة المالك وصلاحيات RPC.';
    } finally {
      refresh.disabled = false;
    }
  }

  function renderOrders() {
    const rows = filter.value === 'pending'
      ? allOrders.filter(row => row.state === 'pending')
      : allOrders;
    orderList.replaceChildren();
    if (!rows.length) {
      orderList.append(element('p', 'لا توجد طلبات ضمن هذا العرض.', 'vx-v2__muted'));
      return;
    }
    for (const row of rows) orderList.append(renderOrder(row));
  }

  function renderOrder(row) {
    const card = element('article', undefined, 'vx-v2-owner__order');
    const title = element('div', undefined, 'vx-v2-owner__order-head');
    title.append(element('h3', row.kind === 'initial' ? 'طلب تفعيل أول' : 'طلب تجديد', 'vx-v2__section-title'));
    title.append(element('span', labels[row.state] || 'حالة غير معروفة', `vx-v2__order-state vx-v2__order-state--${row.state}`));
    card.append(title);
    const details = element('dl', undefined, 'vx-v2-owner__details');
    addDetail(details, 'المبلغ', amountText(row.amount_cents));
    addDetail(details, 'رقم الطلب', row.order_id);
    addDetail(details, 'معرّف الحساب', row.user_id);
    addDetail(details, 'تاريخ الطلب', dateText(row.created_at));
    if (row.expires_at) addDetail(details, 'انتهاء الاشتراك', dateText(row.expires_at));
    card.append(details);

    const actions = element('div', undefined, 'vx-v2-owner__order-actions');
    if (row.receipt_ready) {
      const view = button('عرض الإيصال الآمن', 'vx-v2__button vx-v2__button--quiet');
      const receiptLink = element('a', 'فتح الإيصال في تبويب جديد', 'vx-v2__button vx-v2__button--quiet');
      receiptLink.hidden = true;
      receiptLink.target = '_blank';
      receiptLink.rel = 'noopener noreferrer';
      view.onclick = async () => runAction(view, async () => {
        const url = new URL(await receiptUrl(row.order_id));
        receiptLink.href = url.href;
        receiptLink.hidden = false;
        status.textContent = 'تم طلب رابط مؤقت للإيصال.';
      });
      actions.append(view, receiptLink);
    } else {
      actions.append(element('span', 'الإيصال غير مرفق', 'vx-v2__muted'));
    }

    if (row.state === 'pending') {
      if (row.receipt_ready) actions.append(actionForm('اعتماد التحويل', [
        ['reference', 'مرجع التحويل', 'text', true],
        ['amount', 'المبلغ المؤكد بالسنت', 'number', true]
      ], async values => {
        await rpc(client, 'approve', {
          p_order: row.order_id,
          p_verified_key: values.reference,
          p_amount_cents: Number(values.amount),
          p_currency: 'USD'
        });
      }, {
        amount: String(row.amount_cents), min: row.amount_cents,
        after: async () => { await reload(); status.textContent = 'تم اعتماد التحويل وتحديث الاشتراك.'; },
        onError: () => { status.textContent = 'تعذر اعتماد التحويل. لم تُفعّل المزايا من الواجهة.'; }
      }));

      actions.append(actionForm('رفض الطلب', [
        ['reason', 'سبب الرفض', 'text', true]
      ], values => rpc(client, 'reject', { p_order: row.order_id, p_reason: values.reason }), {
        after: async () => { await reload(); status.textContent = 'تم رفض الطلب.'; },
        onError: () => { status.textContent = 'تعذر رفض الطلب من الخادم.'; }
      }));
    }

    if (row.expires_at && !row.revoked_at) {
      actions.append(actionForm('سحب الاشتراك', [
        ['reason', 'سبب السحب', 'text', true]
      ], values => rpc(client, 'revoke', { p_user: row.user_id, p_reason: values.reason }), {
        danger: true,
        after: async () => { await reload(); status.textContent = 'تم سحب الاشتراك من الخادم.'; },
        onError: () => { status.textContent = 'تعذر سحب الاشتراك من الخادم.'; }
      }));
    }
    card.append(actions);
    return card;
  }

  refresh.onclick = reload;
  filter.onchange = renderOrders;
  await reload();
}

function addDetail(list, label, value) {
  list.append(element('dt', label));
  list.append(element('dd', String(value ?? '—')));
}

function button(text, className) {
  const item = element('button', text, className);
  item.type = 'button';
  return item;
}

function actionForm(title, fields, submitAction, options = {}) {
  const form = element('form', undefined, `vx-v2-owner__action-form${options.danger ? ' is-danger' : ''}`);
  const controls = fields.map(([name, labelText, type, required]) => {
    const label = element('label', labelText, 'vx-v2__label');
    const input = element('input', undefined, 'vx-v2__input');
    input.name = name;
    input.type = type;
    input.required = required;
    if (options[name] !== undefined) input.value = options[name];
    if (name === 'amount') {
      input.min = String(options.min || 1);
      input.step = '1';
    }
    label.append(input);
    form.append(label);
    return input;
  });
  const submit = element('button', title, `vx-v2__button${options.danger ? ' vx-v2__button--danger' : ''}`);
  submit.type = 'submit';
  form.append(submit);
  form.onsubmit = async event => {
    event.preventDefault();
    submit.disabled = true;
    try {
      await submitAction(Object.fromEntries(controls.map(input => [input.name, input.value.trim()])));
      await options.after?.();
    } catch {
      options.onError?.();
    } finally {
      submit.disabled = false;
    }
  };
  return form;
}

async function runAction(buttonElement, action) {
  buttonElement.disabled = true;
  try { await action(); }
  catch { buttonElement.closest('.vx-v2-owner')?.querySelector('[role="status"]')?.replaceChildren(element('span', 'تعذر إكمال العملية من الخادم.')); }
  finally { buttonElement.disabled = false; }
}
