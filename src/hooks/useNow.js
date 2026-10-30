import { useEffect, useState } from 'react';

// "Bây giờ", tự cập nhật mỗi `intervalMs` để cảnh báo giờ giao tự đổi màu.
export default function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
