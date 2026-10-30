import { useCallback, useEffect, useState } from 'react';
import { isNetworkError, supabase } from '../lib/supabase';

// Đăng nhập bằng mã PIN 4 số. Mỗi máy có một phiên ẩn danh của Supabase (không cần email);
// nhập đúng PIN thì máy chủ gắn phiên đó với tài khoản chủ quán / nhân viên.
// status: 'loading' | 'signedOut' | 'signedIn' | 'offline'
const LOGIN_ERRORS = {
  wrong: (r) => `Sai mã PIN. Còn ${r.left} lần thử trước khi máy bị khoá 5 phút.`,
  locked: (r) => {
    const t = new Date(r.until);
    return `Nhập sai nhiều lần, máy này bị khoá tới ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}.`;
  },
  busy: () =>
    'Có quá nhiều lần nhập sai trong quán, tạm dừng đăng nhập mới 10 phút. Máy đang đăng nhập vẫn dùng bình thường.',
  no_session: () => 'Chưa kết nối được máy chủ, thử lại nhé.',
};

const friendly = (error) =>
  isNetworkError(error)
    ? 'Không có mạng hoặc máy chủ không trả lời. Kiểm tra wifi / 4G rồi thử lại.'
    : /anonymous/i.test(error.message ?? '')
      ? 'Máy chủ chưa bật đăng nhập không cần email. Chủ quán vào Supabase → Authentication → Sign In / Providers, bật "Allow anonymous sign-ins".'
      : error.message;

export default function useAuth() {
  const [state, setState] = useState({ status: 'loading' });

  // Hỏi máy chủ máy này đang đăng nhập bằng ai. Bị đổi PIN / xoá tài khoản thì về màn hình nhập PIN.
  const check = useCallback(async () => {
    const { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) return setState({ status: 'signedOut' });
    const { data, error } = await supabase.rpc('my_account');
    if (error) {
      // Đang dùng mà rớt mạng: giữ nguyên, lần kiểm tra sau sẽ cập nhật
      setState((s) => (s.status === 'signedIn' ? s : { status: 'offline', error: friendly(error) }));
      return;
    }
    setState(data ? { status: 'signedIn', account: data } : { status: 'signedOut' });
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(check, 2 * 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [check]);

  // Trả về null khi đúng, hoặc câu báo lỗi
  const login = async (pin) => {
    let { data: { session } = {} } = await supabase.auth.getSession();
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) return friendly(error);
      session = data.session;
    }
    const { data, error } = await supabase.rpc('pin_login', { pin });
    if (error) return friendly(error);
    if (data?.error) return (LOGIN_ERRORS[data.error] ?? (() => 'Không đăng nhập được'))(data);
    setState({ status: 'signedIn', account: data });
    return null;
  };

  const logout = async () => {
    await supabase.rpc('pin_logout');
    setState({ status: 'signedOut' });
  };

  return { ...state, login, logout, retry: check };
}
