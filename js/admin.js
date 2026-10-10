/* ============================================================
   Lumora Admin Panel — Supabase Auth + RLS
   ============================================================ */
(() => {
'use strict';

const SUPABASE_URL = 'https://mpoqvpqeysgoqjtcwtfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wb3F2cHFleXNnb3FqdGN3dGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODE1NTUsImV4cCI6MjEwNzA1NzU1NX0.i0YEZkxAmy4wEnX0QP8Hm2erm1bxPFmO6sp78clevb0';
const CURRENCY = 'USD';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tr = o => (o && (o.ar || o.en || o.fr)) || '';
const fmt = n => {
  try { return new Intl.NumberFormat('ar-u-nu-latn', { style: 'currency', currency: CURRENCY, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0); }
  catch { return (Math.round((Number(n) || 0) * 100) / 100) + ' ' + CURRENCY; }
};
const dt = s => s ? new Date(s).toLocaleString('ar-u-nu-latn', { dateStyle: 'short', timeStyle: 'short' }) : '—';

let toastT;
function toast(msg, kind = '') {
  const el = $('#toast'); if (!el) return;
  el.textContent = msg; el.className = 'toast on ' + kind;
  clearTimeout(toastT); toastT = setTimeout(() => el.className = 'toast ' + kind, 2400);
}

let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('Supabase library not loaded');
  }
} catch (e) { console.error('Supabase init failed:', e); }

let session = null;
let products = [];
let orders = [];

const savedTheme = localStorage.getItem('lumora_admin_theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = savedTheme;

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('lumora_admin_theme', next);
}

async function boot() {
  if (!sb) {
    document.body.innerHTML = '<div style="display:grid;place-items:center;min-height:100vh;font-family:system-ui;padding:20px;text-align:center"><div><h2 style="color:#ff4d6d">⚠️ فشل تحميل Supabase</h2><p style="color:#6a6786;margin-top:8px">تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p></div></div>';
    return;
  }

  const { data: { session: s } } = await sb.auth.getSession();
  if (s) {
    session = s;
    const ok = await verifyAdmin();
    if (ok) return showDashboard();
  }
  showAuth();
}

async function verifyAdmin() {
  if (!session) return false;
  const { data, error } = await sb
    .from('admins')
    .select('role')
    .eq('user_id', session.user.id)
    .maybeSingle();

  if (error || !data) {
    await sb.auth.signOut();
    session = null;
    return false;
  }
  session.role = data.role;
  return true;
}

function showAuth() {
  $('#authScreen').hidden = false;
  $('#dashboard').hidden = true;
  setTimeout(() => $('#loginForm [name=email]')?.focus(), 50);
}

async function showDashboard() {
  $('#authScreen').hidden = true;
  $('#dashboard').hidden = false;
  $('#userEmail').textContent = session.user.email;

  $('#accountInfo').innerHTML = `
    <div><b>البريد:</b> <span>${esc(session.user.email)}</span></div>
    <div><b>المعرّف:</b> <code>${esc(session.user.id.slice(0, 8))}…</code></div>
    <div><b>الدور:</b> <span class="badge confirmed">${esc(session.role || 'admin')}</span></div>
    <div><b>آخر دخول:</b> <span>${dt(session.user.last_sign_in_at)}</span></div>
  `;

  await Promise.all([loadProducts(), loadOrders(), loadStats()]);
  subscribeRealtime();
}

$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('#loginBtn'), err = $('#authErr');
  err.hidden = true;
  btn.disabled = true;
  btn.innerHTML = '<span>جارٍ التحقق…</span>';

  const { email, password } = Object.fromEntries(new FormData(e.target));
  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.innerHTML = '<span>تسجيل الدخول</span>';

  if (error) {
    err.textContent = error.message === 'Invalid login credentials'
      ? 'البريد أو كلمة المرور غير صحيحة'
      : error.message;
    err.hidden = false;
    return;
  }

  session = data.session;
  const ok = await verifyAdmin();
  if (!ok) {
    err.textContent = 'هذا الحساب ليس لديه صلاحيات الأدمن';
    err.hidden = false;
    return;
  }
  toast('✓ مرحبًا بك', 'ok');
  await showDashboard();
});

$('#logoutBtn').addEventListener('click', async () => {
  if (!confirm('تسجيل الخروج؟')) return;
  await sb.auth.signOut();
  session = null;
  location.reload();
});

$$('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.side-link').forEach(b => b.classList.toggle('on', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === btn.dataset.panel));
  });
});

$('#themeToggle').addEventListener('click', toggleTheme);

async function loadStats() {
  const { data, error } = await sb.from('admin_stats').select('*').single();
  if (error) { console.error('stats:', error); return; }

  $('#stProducts').textContent = data.total_products ?? 0;
  $('#stOrders').textContent = data.total_orders ?? 0;
  $('#stPending').textContent = data.pending_orders ?? 0;
  $('#stRevenue').textContent = fmt(data.total_revenue);
  $('#stStock').textContent = data.total_stock ?? 0;
  $('#stSold').textContent = data.total_sold ?? 0;

  const alerts = [];
  if (data.out_of_stock > 0) alerts.push(`<span class="trend danger">⚠️ ${data.out_of_stock} منتج نفد</span>`);
  if (data.low_stock > 0) alerts.push(`<span class="trend warn">⚡ ${data.low_stock} مخزون منخفض</span>`);
  if (data.pending_orders > 0) alerts.push(`<span class="trend warn">🔔 ${data.pending_orders} طلب جديد</span>`);
  const alertsBox = $('#alerts');
  if (alertsBox) alertsBox.innerHTML = alerts.join(' ') || '<span class="muted">لا تنبيهات</span>';

  const recent = orders.slice(0, 5);
  $('#recentOrders').innerHTML = recent.length ? `
    <table>
      <thead><tr><th>#</th><th>العميل</th><th>المدينة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr></thead>
      <tbody>${recent.map(o => `
        <tr>
          <td><code>${esc(o.id)}</code></td>
          <td><b>${esc(o.customer_name)}</b></td>
          <td>${esc(o.city)}</td>
          <td><b>${fmt(o.total_amount)}</b></td>
          <td><span class="badge ${esc(o.status)}">${statusLabel(o.status)}</span></td>
          <td><small class="muted">${dt(o.created_at)}</small></td>
        </tr>`).join('')}
      </tbody>
    </table>` : '<p class="muted" style="padding:20px">لا توجد طلبات بعد</p>';
}

function statusLabel(s) {
  return {
    pending: 'قيد الانتظار', confirmed: 'مؤكد', shipped: 'تم الشحن',
    delivered: 'تم التسليم', cancelled: 'ملغى'
  }[s] || s;
}

async function loadProducts() {
  const { data, error } = await sb.from('products').select('*').order('id', { ascending: false });
  if (error) { console.error('products:', error); toast('خطأ في تحميل المنتجات', 'err'); return; }
  products = data || [];
  renderProducts();
  const cnt = $('#prodCount'); if (cnt) cnt.textContent = products.length;
}

function renderProducts() {
  const q = ($('#prodSearch')?.value || '').toLowerCase().trim();
  const list = q
    ? products.filter(p => tr(p.name).toLowerCase().includes(q) || String(p.id).includes(q) || p.cat.includes(q))
    : products;

  const box = $('#productsList');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<p class="muted" style="padding:20px">لا توجد منتجات مطابقة</p>';
    return;
  }

  box.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th></th><th>الاسم</th><th>الفئة</th>
        <th>السعر</th><th>المخزون</th><th>المبيعات</th><th>التقييم</th><th></th>
      </tr></thead>
      <tbody>${list.map(p => {
        const out = p.stock <= 0;
        const low = p.stock > 0 && p.stock <= 5;
        return `
        <tr>
          <td><code>${p.id}</code></td>
          <td>${p.img
            ? `<img class="cell-thumb" src="${esc(p.img)}" alt="" loading="lazy">`
            : `<div class="cell-thumb">${esc(p.emoji || '🛍️')}</div>`}
          </td>
          <td><b>${esc(tr(p.name))}</b></td>
          <td>${esc(p.cat)}</td>
          <td>
            <b>${fmt(p.price)}</b>
            ${p.old > p.price ? `<br><small class="muted" style="text-decoration:line-through">${fmt(p.old)}</small>` : ''}
          </td>
          <td>${out
            ? '<span class="badge out">نفد</span>'
            : low
              ? `<span class="badge pending">${p.stock}</span>`
              : p.stock}
          </td>
          <td>${p.sold || 0}</td>
          <td>⭐ ${Number(p.rating || 0).toFixed(1)}</td>
          <td>
            <button class="btn danger sm" data-del="${p.id}" title="حذف">🗑️</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

$('#prodSearch')?.addEventListener('input', () => renderProducts());

$('#productsList').addEventListener('click', async e => {
  const btn = e.target.closest('[data-del]'); if (!btn) return;
  const id = btn.dataset.del;
  const p = products.find(x => String(x.id) === String(id));
  if (!confirm(`حذف "${tr(p?.name) || '#' + id}"؟`)) return;

  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) return toast('خطأ: ' + error.message, 'err');

  toast('✓ تم الحذف', 'ok');
  await Promise.all([loadProducts(), loadStats()]);
});

async function loadOrders() {
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
  if (error) { console.error('orders:', error); toast('خطأ في تحميل الطلبات', 'err'); return; }
  orders = data || [];
  renderOrders();
  const cnt = $('#ordCount'); if (cnt) cnt.textContent = orders.length;
}

function renderOrders() {
  const filter = $('#orderFilter')?.value || '';
  const list = filter ? orders.filter(o => o.status === filter) : orders;

  const box = $('#ordersList');
  if (!box) return;
  if (!list.length) {
    box.innerHTML = '<p class="muted" style="padding:20px">لا توجد طلبات</p>';
    return;
  }

  box.innerHTML = list.map(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    return `
    <div class="order-card" data-order="${esc(o.id)}">
      <div class="row1">
        <div>
          <div class="oid">#${esc(o.id)}</div>
          <div class="who">${esc(o.customer_name)}</div>
          <div class="meta">📞 ${esc(o.phone)} • 📍 ${esc(o.city)}</div>
        </div>
        <div style="text-align:end">
          <div style="font-size:1.15rem;font-weight:800">${fmt(o.total_amount)}</div>
          <select class="status-select" data-status="${esc(o.id)}" onclick="event.stopPropagation()">
            ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
              `<option value="${s}" ${o.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="order-detail" hidden>
        <div><b>العنوان:</b> ${esc(o.address)}</div>
        ${o.notes ? `<div><b>ملاحظات:</b> ${esc(o.notes)}</div>` : ''}
        <div><b>التاريخ:</b> ${dt(o.created_at)}</div>
        ${items.length ? `
          <div><b>المنتجات:</b></div>
          ${items.map(i => `<div class="item"><span>${esc(i.name || i.id)} × ${i.qty}</span><b>${fmt((i.price || 0) * (i.qty || 1))}</b></div>`).join('')}
        ` : ''}
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          ${o.phone ? `<a class="btn ghost sm" href="https://wa.me/${String(o.phone).replace(/\D/g,'')}" target="_blank" rel="noopener">💬 واتساب</a>` : ''}
          <button class="btn danger sm" data-delorder="${esc(o.id)}">🗑️ حذف</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

$('#ordersList').addEventListener('click', async e => {
  const del = e.target.closest('[data-delorder]');
  if (del) {
    e.stopPropagation();
    const id = del.dataset.delorder;
    if (!confirm(`حذف الطلب #${id}؟`)) return;
    const { error } = await sb.from('orders').delete().eq('id', id);
    if (error) return toast('خطأ: ' + error.message, 'err');
    toast('✓ تم الحذف', 'ok');
    await Promise.all([loadOrders(), loadStats()]);
    return;
  }

  const card = e.target.closest('.order-card');
  if (!card) return;
  const detail = card.querySelector('.order-detail');
  if (detail) detail.hidden = !detail.hidden;
});

$('#ordersList').addEventListener('change', async e => {
  const sel = e.target.closest('[data-status]'); if (!sel) return;
  const id = sel.dataset.status;
  const status = sel.value;

  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if (error) return toast('خطأ: ' + error.message, 'err');

  const idx = orders.findIndex(o => o.id === id);
  if (idx >= 0) orders[idx].status = status;

  toast('✓ تم تحديث الحالة', 'ok');
  await loadStats();
});

$('#orderFilter')?.addEventListener('change', renderOrders);

$('#addProductForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('#addErr'); err.hidden = true;
  const fd = Object.fromEntries(new FormData(e.target));

  const names = { ar: fd.n_ar.trim(), fr: (fd.n_fr || '').trim(), en: (fd.n_en || '').trim() };
  const first = names.ar || names.fr || names.en;
  if (!first) { err.textContent = 'الاسم العربي مطلوب'; err.hidden = false; return; }
  Object.keys(names).forEach(k => { if (!names[k]) names[k] = first; });

  const d = (fd.desc || '').trim();
  const payload = {
    cat: fd.cat,
    emoji: fd.emoji || '🛍️',
    hue: Math.floor(Math.random() * 360),
    price: Number(fd.price),
    old: Number(fd.old) || 0,
    rating: 4.5,
    stock: Number(fd.stock),
    sold: 0,
    img: (fd.img || '').trim(),
    name: names,
    description: { ar: d, fr: d, en: d }
  };

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'جارٍ الحفظ…';

  const { error } = await sb.from('products').insert([payload]);

  btn.disabled = false; btn.textContent = '💾 حفظ المنتج';

  if (error) { err.textContent = error.message; err.hidden = false; return; }

  toast('✓ تم إضافة المنتج', 'ok');
  e.target.reset();
  await Promise.all([loadProducts(), loadStats()]);
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$('#exportProducts').addEventListener('click', () => {
  download(`lumora-products-${Date.now()}.json`, JSON.stringify(products, null, 2), 'application/json');
  toast('✓ تم التصدير', 'ok');
});

$('#importProducts').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr) || !arr.length) throw new Error('الملف يجب أن يحتوي على مصفوفة منتجات');

      const clean = arr.map(p => ({
        cat: p.cat || 'tech',
        emoji: p.emoji || '🛍️',
        hue: p.hue || 260,
        price: Number(p.price) || 0,
        old: Number(p.old) || 0,
        rating: Number(p.rating) || 4.5,
        stock: Number(p.stock) || 0,
        sold: Number(p.sold) || 0,
        img: p.img || '',
        name: typeof p.name === 'object' ? p.name : { ar: String(p.name || '') },
        description: typeof p.desc === 'object' ? p.desc : { ar: String(p.desc || '') }
      }));

      const { error } = await sb.from('products').insert(clean);
      if (error) throw error;

      toast(`✓ تم استيراد ${clean.length} منتج`, 'ok');
      await Promise.all([loadProducts(), loadStats()]);
    } catch (err) {
      toast('خطأ: ' + err.message, 'err');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

$('#exportOrdersCsv').addEventListener('click', () => {
  const head = ['id','customer_name','phone','city','address','notes','total_amount','status','created_at'];
  const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const csv = [head.join(','), ...orders.map(o => head.map(h => cell(o[h])).join(','))].join('\n');
  download(`lumora-orders-${Date.now()}.csv`, '\uFEFF' + csv, 'text/csv;charset=utf-8');
  toast('✓ تم تصدير الطلبات', 'ok');
});

function subscribeRealtime() {
  if (!sb) return;
  sb.channel('orders-live')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      const o = payload.new;
      toast(`🔔 طلب جديد: #${o.id} — ${fmt(o.total_amount)}`, 'ok');
      loadOrders().then(loadStats);
    })
    .subscribe();
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.activeElement?.matches('input[type=search]')) {
    document.activeElement.value = '';
    document.activeElement.dispatchEvent(new Event('input'));
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    const s = $('#prodSearch'); if (s) { s.focus(); s.select(); }
  }
});

boot();
})();
