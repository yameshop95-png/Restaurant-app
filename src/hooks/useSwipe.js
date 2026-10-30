import { useRef } from 'react';

// Vuốt ngang trên điện thoại: vuốt sang trái gọi onNext, sang phải gọi onPrev.
// Bỏ qua khi đang cuộn dọc, vuốt quá chậm, hoặc chạm vào ô nhập / bảng nổi (sheet) / thanh cuộn ngang.
const MIN_DISTANCE = 60;
const MAX_DURATION = 700;

const ignored = (el) => el?.closest?.('input, textarea, select, .fixed, [data-no-swipe]');

export default function useSwipe({ onNext, onPrev }) {
  const start = useRef(null);
  return {
    onTouchStart: (e) => {
      if (e.touches.length !== 1 || ignored(e.target)) {
        start.current = null;
        return;
      }
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY, at: Date.now() };
    },
    onTouchEnd: (e) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - s.x;
      const dy = t.clientY - s.y;
      if (Date.now() - s.at > MAX_DURATION || Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onNext?.();
      else onPrev?.();
    },
  };
}
