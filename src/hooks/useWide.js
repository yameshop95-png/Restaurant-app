import { useEffect, useState } from 'react';

// true khi màn hình đủ rộng (iPad ngang, máy tính) để chia đôi danh sách và chi tiết
export default function useWide(query = '(min-width: 1280px)') {
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
