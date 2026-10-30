import { createClient } from '@supabase/supabase-js';

// Website chỉ gọi 2 hàm công khai trên máy chủ (public_shop, place_web_order), không đăng nhập.
// Tạo client khi chạy trên trình duyệt (lúc dựng sẵn trang HTML khi build thì không cần).
let client = null;
export function siteClient() {
  client ??= createClient(
    import.meta.env.VITE_SUPABASE_URL || 'https://hgkqcswzggsbpusrhpue.supabase.co',
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON',
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return client;
}

export const store = {
  get(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // trình duyệt chặn lưu: không sao
    }
  },
};
