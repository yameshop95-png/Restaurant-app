import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const REFRESH_MS = 10000;

// Số liệu khách trên website (hàm customer_activity trên máy chủ). Tự tải lại mỗi 10 giây khi màn hình đang mở.
// error.missing = true: máy chủ chưa cài hàm (chưa chạy sql/customer_activity.sql).
export default function useCustomerActivity() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const { data: res, error: err } = await supabase.rpc('customer_activity');
    busy.current = false;
    if (err) {
      const missing = /customer_activity|PGRST202|42883/.test(`${err.code} ${err.message}`);
      setError({ missing, message: err.message });
      return;
    }
    setError(null);
    setData(res);
    setUpdatedAt(new Date());
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => document.visibilityState === 'visible' && load(), REFRESH_MS);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  // Đánh dấu đã xử lý / xoá thông tin một khách bỏ dở, rồi tải lại
  const handleSession = useCallback(
    async (sid, action) => {
      // Bỏ ngay khỏi danh sách trên màn hình cho nhanh
      setData((d) => (d ? { ...d, abandoned: d.abandoned.filter((a) => a.sid !== sid) } : d));
      const { error: err } = await supabase.rpc('handle_web_session', { p_sid: sid, p_action: action });
      if (err) setError({ missing: false, message: err.message });
      load();
    },
    [load],
  );

  return { data, error, updatedAt, handleSession, reload: load };
}
