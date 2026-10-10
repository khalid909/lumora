/* ============================================================
   Lumora Admin Panel — Supabase Auth + RLS
   ============================================================ */
(() => {
'use strict';

/* ========== إعدادات ========== */
const SUPABASE_URL = 'https://mpoqvpqeysgoqjtcwtfk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wb3F2cHFleXNnb3FqdGN3dGZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE0ODE1NTUsImV4cCI6MjEwNzA1NzU1NX0.i0YEZkxAmy4wEnX0QP8Hm2erm1bxPFmO6sp78clevb0';
const CURRENCY = 'USD';

/* ========== Helpers ========== */
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

/* ========== Supabase ========== */
let sb = null;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('Supabase library not loaded');
  }
} catch (e) { console.error('Supabase init failed:', e); }

/* ========== State ========== */
let session = null;
let products = [];
let orders = [];

/* ========== Theme ========== */
const savedTheme = localStorage.getItem('lumora_admin_theme') ||
  (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.dataset.theme = savedTheme;

function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('lumora_admin_theme', next);
}

/* ========== Auth ========== */
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

/* Login */
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

/* Logout */
$('#logoutBtn').addEventListener('click', async () => {
  if (!confirm('تسجيل الخروج؟')) return;
  await sb.auth.signOut();
  session = null;
  location.reload();
});

/* ========== Navigation ========== */
$$('.side-link').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.side-link').forEach(b => b.classList.toggle('on', b === btn));
    $$('.panel').forEach(p => p.classList.toggle('on', p.dataset.panel === btn.dataset.panel));
  });
});

$('#themeToggle').addEventListener('click', toggleTheme);

/* ========== STATS ========== */
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
  if (data.low_stock > 0) alerts.push(`<span class="trend warn">⚡ ${data.low_stock}
