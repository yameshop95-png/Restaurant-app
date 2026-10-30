import { createClient } from '@supabase/supabase-js';

// Database dùng chung của quán (Supabase). Khoá "publishable" được phép để trong app:
// quyền xem / sửa dữ liệu do database kiểm tra theo mã PIN đã đăng nhập.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://hgkqcswzggsbpusrhpue.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'restaurant-app.auth' },
});

// Lỗi mạng (mất sóng, máy chủ không trả lời) thì thử lại được; lỗi có mã từ database (sai quyền...) thì không.
export const isNetworkError = (error) => !error?.code || /fetch|network|timeout|load failed/i.test(error.message ?? '');
