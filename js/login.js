// إعدادات الاتصال بـ Supabase (ضع مفاتيحك الخاصة من لوحة Supabase)
const SUPABASE_URL = 'https://YOUR_SUPABASE_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const form = document.getElementById('vendorLoginForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const errorAlert = document.getElementById('errorAlert');

function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.style.display = 'block';
}

function clearError() {
    errorAlert.textContent = '';
    errorAlert.style.display = 'none';
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('يرجى ملء جميع الحقول المطلوبة');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'جارٍ تسجيل الدخول...';

    try {
        // 1. تسجيل الدخول عبر نظام المصادقة Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            if (authError.message.includes('Invalid login credentials')) {
                showError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
            } else {
                showError(authError.message);
            }
            submitBtn.disabled = false;
            submitBtn.textContent = 'دخول';
            return;
        }

        const userId = authData.user.id;

        // 2. التحقق من وجود حساب بائع مسجل للمستخدم
        const { data: vendor, error: vendorError } = await supabase
            .from('vendors')
            .select('id, store_name')
            .eq('id', userId)
            .maybeSingle();

        if (vendorError) {
            showError('حدث خطأ أثناء فحص بيانات المتجر، يرجى المحاولة لاحقاً.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'دخول';
            return;
        }

        if (!vendor) {
            // المستخدم مسجل كحساب عادي ولكن ليس بائعاً
            await supabase.auth.signOut();
            showError('هذا الحساب ليس مسجلاً كبائع. يرجى التقديم أولاً للانضمام كتاجر.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'دخول';
            return;
        }

        // 3. التوجيه المباشر إلى لوحة التاجر
        window.location.href = 'vendor.html';

    } catch (err) {
        console.error(err);
        showError('تعذر الاتصال بالخادم، تحقق من اتصالك بالإنترنت.');
        submitBtn.disabled = false;
        submitBtn.textContent = 'دخول';
    }
});
