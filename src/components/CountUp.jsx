import { useEffect, useRef, useState } from 'react';

const reducedNow = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Đếm nhẹ tới số cuối. Chuỗi hiển thị luôn đi qua `format` (formatMoney / số nguyên), không đổi cách viết tiền.
export const formatCount = (n) => String(Math.round(Number(n) || 0));

export default function CountUp({ value, format, className }) {
  const target = Number.isFinite(Number(value)) ? Number(value) : 0;
  const [reduced, setReduced] = useState(reducedNow);
  const fromRef = useRef(0);
  const first = useRef(true);
  const [shown, setShown] = useState(() => (reducedNow() ? target : 0));

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      fromRef.current = target;
      setShown(target);
      return undefined;
    }
    const from = first.current ? 0 : fromRef.current;
    first.current = false;
    if (from === target) {
      fromRef.current = target;
      setShown(target);
      return undefined;
    }
    const start = performance.now();
    const duration = 720;
    let raf = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      const next = t === 1 ? target : from + (target - from) * eased;
      fromRef.current = next;
      setShown(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);

  return (
    <span className={className}>
      <span className="sr-only">{format(target)}</span>
      <span aria-hidden="true" className="staff-count">
        {format(shown)}
      </span>
    </span>
  );
}
