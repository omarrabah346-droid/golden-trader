const rpc = async (client, name, args = {}) => {
  const { data, error } = await client.rpc('vx_sub_v2_' + name, args);
  if (error) throw new Error('Subscription service returned an error');
  return data;
};

const element = (tag, text) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
};

// Mount only in an authenticated staging shell after wiring an owner-session RPC
// client and a backend that returns a short-lived signed receipt URL.
export async function mountOwnerSubscriptions(root, client, receiptUrl) {
  root.dir = 'rtl';
  const heading = element('h1', 'مراجعة اشتراكات VEXORA');
  const status = element('p');
  status.setAttribute('role', 'status');
  const orders = element('section');
  const refresh = element('button', 'تحديث الطلبات');
  const grants = element('section');
  const account = element('input');
  account.placeholder = 'معرّف حساب المستخدم';
  account.setAttribute('aria-label', account.placeholder);
  const date = element('input');
  date.type = 'datetime-local';
  date.setAttribute('aria-label', 'موعد الانتهاء بتوقيت جهازك');
  const grantList = element('ul');
  const expiry = () => new Date(date.value).toISOString();

  async function showGrants() {
    const user = account.value.trim();
    const rows = await rpc(client, 'owner_grants', { p_user: user });
    if (account.value.trim() !== user) return;
    grantList.replaceChildren(...rows.map(row => {
      const item = element('li', new Date(row.expires_at).toLocaleString('ar'));
      if (row.revoked_at) {
        item.append(element('span', ' · ملغاة'));
        return item;
      }
      item.append(
        grantButton('تمديد', () => changeGrant(user, 'extend', row.id)),
        grantButton('إلغاء', () => changeGrant(user, 'revoke', row.id))
      );
      return item;
    }));
  }

  function grantButton(label, run) {
    const button = element('button', label);
    button.type = 'button';
    button.onclick = async () => {
      button.disabled = true;
      try { await run(); }
      catch { status.textContent = 'تعذرت إدارة المنحة. تحقق من الحساب وتاريخ الانتهاء.'; }
      finally { button.disabled = false; }
    };
    return button;
  }

  async function changeGrant(user, action, id = null) {
    await rpc(client, 'manage_grant', {
      p_user: user, p_action: action, p_grant: id,
      p_expiry: action === 'revoke' ? null : expiry()
    });
    await showGrants();
    status.textContent = 'تم حفظ تغيير المنحة.';
  }

  account.oninput = () => grantList.replaceChildren();
  grants.append(element('h2', 'المنح المجانية'), account, date,
    grantButton('عرض المنح', showGrants),
    grantButton('إضافة منحة', () => changeGrant(account.value.trim(), 'create')), grantList);
  root.replaceChildren(heading, status, grants, refresh, orders);

  async function reload() {
    refresh.disabled = true;
    try {
      const rows = await rpc(client, 'owner_review');
      orders.replaceChildren(...rows.map(render));
      status.textContent = rows.length ? '' : 'لا توجد طلبات.';
    } catch {
      orders.replaceChildren();
      status.textContent = 'تعذر عرض الطلبات. تحقق من جلسة المالك.';
    } finally {
      refresh.disabled = false;
    }
  }

  function render(row) {
    const card = element('article');
    const states = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض' };
    const amount = new Intl.NumberFormat('ar', {
      style: 'currency', currency: 'USD'
    }).format(row.amount_cents / 100);
    card.append(element('h2', row.kind === 'initial' ? 'تفعيل أول' : 'تجديد'),
      element('p', states[row.state] + ' · ' + amount),
      element('p', 'الطلب ' + row.order_id),
      element('p', 'الحساب ' + row.user_id));
    if (row.expires_at) card.append(element('p', 'الانتهاء ' + new Date(row.expires_at).toLocaleString('ar')));
    if (row.revoked_at) card.append(element('p', 'تم سحب الصلاحيات'));
    if (row.receipt_ready) {
      const open = element('button', 'عرض الإيصال');
      const link = element('a', 'فتح رابط الإيصال المؤقت');
      link.hidden = true;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      open.onclick = async () => {
        link.hidden = true;
        try {
          const url = new URL(await receiptUrl(row.order_id));
          if (url.protocol !== 'https:') throw new Error('Invalid receipt URL');
          link.href = url.href;
          link.hidden = false;
        } catch {
          status.textContent = 'تعذر فتح الإيصال.';
        }
      };
      card.append(open, link);
    }

    function action(title, fields, run) {
      const form = element('form');
      const inputs = fields.map(([name, title, type]) => {
        const label = element('label', title + ' ');
        const input = element('input');
        input.name = name;
        input.type = type;
        input.required = true;
        label.append(input);
        form.append(label);
        return input;
      });
      const submit = element('button', title);
      form.append(submit);
      form.onsubmit = async (event) => {
        event.preventDefault();
        submit.disabled = true;
        try {
          await run(...inputs.map(input => input.value.trim()));
          await reload();
          status.textContent = 'تم حفظ الإجراء.';
        } catch {
          status.textContent = 'تعذر حفظ الإجراء. راجع البيانات وحدّث الطلبات.';
        } finally {
          submit.disabled = false;
        }
      };
      card.append(form);
    }

    if (row.state === 'pending') {
      if (row.receipt_ready) action('اعتماد الدفع', [
        ['reference', 'معرّف التحويل المتحقق', 'text'],
        ['cents', 'المبلغ المتحقق بالسنت الأمريكي', 'number']
      ], (reference, cents) => rpc(client, 'approve', {
        p_order: row.order_id, p_verified_key: reference, p_amount_cents: Number(cents), p_currency: 'USD'
      }));
      action('رفض الطلب', [['reason', 'السبب', 'text']], reason =>
        rpc(client, 'reject', { p_order: row.order_id, p_reason: reason }));
    }
    if (row.expires_at && !row.revoked_at) {
      action('سحب الصلاحيات', [['reason', 'السبب', 'text']], reason =>
        rpc(client, 'revoke', { p_user: row.user_id, p_reason: reason }));
    }
    return card;
  }

  refresh.onclick = reload;
  await reload();
}
