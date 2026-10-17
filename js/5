// تهيئة عميل Supabase
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentVendor = null;

// التحقق من تسجيل دخول التاجر وجلب بياناته
async function initVendorDashboard() {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        window.location.href = 'login.html';
        return;
    }

    // جلب معلومات المتجر
    const { data: vendor, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('id', user.id)
        .single();

    if (vendor) {
        currentVendor = vendor;
        document.getElementById('storeTitle').innerText = vendor.store_name;
    }

    loadDashboardStats(user.id);
    loadRecentOrders(user.id);
}

// حساب المبيعات والطلبات والمنتجات
async function loadDashboardStats(vendorId) {
    // جلب الطلبات
    const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status')
        .eq('vendor_id', vendorId);

    if (orders) {
        document.getElementById('totalOrders').innerText = orders.length;
        const totalRev = orders.reduce((sum, ord) => sum + Number(ord.total_amount || 0), 0);
        document.getElementById('totalSales').innerText = `${totalRev.toLocaleString()} د.ج`;
    }

    // جلب المنتجات
    const { count } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('vendor_id', vendorId);

    document.getElementById('activeProducts').innerText = count || 0;
}

// عرض أحدث الطلبات
async function loadRecentOrders(vendorId) {
    const { data: orders } = await supabase
        .from('orders')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false })
        .limit(5);

    const container = document.getElementById('latestOrdersList');
    if (!orders || orders.length === 0) {
        container.innerHTML = '<p style="color:#64748b; text-align:center; padding:15px;">لا توجد طلبات بعد.</p>';
        return;
    }

    container.innerHTML = orders.map(order => `
        <div class="data-row">
            <div>
                <strong>#${order.id.slice(0, 8)} - ${order.customer_name}</strong>
                <div style="font-size:0.8rem; color:#64748b;">${order.wilaya} | ${order.customer_phone}</div>
            </div>
            <div>
                <strong>${order.total_amount} د.ج</strong>
                <span class="status-pill status-${order.status}">${order.status}</span>
            </div>
        </div>
    `).join('');
}

// التنقل بين الأقسام
function switchSection(section) {
    ['dashboard', 'products', 'orders'].forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.style.display = (s === section) ? 'block' : 'none';
    });
}

// تسجيل الخروج
document.getElementById('logoutBtn').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
});

// بدء التشغيل
document.addEventListener('DOMContentLoaded', initVendorDashboard);
