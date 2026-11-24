import { useEffect, useState } from 'react';

// true khi màn hình đủ rộng để chia đôi danh sách và chi tiết. Mốc 1024 khớp breakpoint
// lg của app (có sidebar, tắt thanh dưới): iPad Pro 10.5" nằm ngang (1112px) cũng chia đôi
// được — ý Paul 25/11, trước đây mốc 1280 nên iPad của anh chỉ có ở PC/MacBook mới thấy.
export default function useWide(query = '(min-width: 1024px)') {
  const get = () => typeof window !== 'undefined' && window.matchMedia(query).matches;
  const [wide, setWide] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return wide;
}
