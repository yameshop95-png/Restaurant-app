import { useEffect } from 'react';

// Cho máy để app mở cả ngày (iPad ở quán):
// - keepAwake: giữ màn hình luôn sáng (Screen Wake Lock). Trình duyệt tự nhả khi chuyển tab / tắt màn hình,
//   nên xin lại mỗi khi app hiện lại. Trình duyệt không hỗ trợ thì bỏ qua.
// - Mỗi đêm khoảng 3:30 sáng, nếu không ai chạm vào app trong 10 phút, tải lại trang để nhận bản app mới nhất.
const IDLE_MS = 10 * 60 * 1000;

export default function useAlwaysOn(keepAwake) {
  useEffect(() => {
    if (!keepAwake || !('wakeLock' in navigator)) return undefined;
    let lock = null;
    let alive = true;
    const request = async () => {
      if (!alive || document.visibilityState !== 'visible' || lock) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => {
          lock = null;
        });
      } catch {
        // Bị từ chối (pin yếu, chế độ tiết kiệm pin...): thử lại lần sau khi app hiện lại
      }
    };
    request();
    const onVisible = () => request();
    document.addEventListener('visibilitychange', onVisible);
    // Một số trình duyệt chỉ cho xin sau khi người dùng chạm vào trang
    window.addEventListener('pointerdown', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pointerdown', onVisible);
      lock?.release().catch(() => {});
    };
  }, [keepAwake]);

  useEffect(() => {
    let lastTouch = Date.now();
    const mark = () => {
      lastTouch = Date.now();
    };
    for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, mark, { passive: true });
    const timer = setInterval(() => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      // 3:30 – 4:30 sáng, không ai dùng 10 phút, có mạng: tải lại một lần
      if (minutes < 210 || minutes > 270 || Date.now() - lastTouch < IDLE_MS || !navigator.onLine) return;
      const key = 'restaurant-app.nightly-reload';
      const today = now.toDateString();
      try {
        if (localStorage.getItem(key) === today) return;
        localStorage.setItem(key, today);
      } catch {
        return;
      }
      window.location.reload();
    }, 60 * 1000);
    return () => {
      clearInterval(timer);
      for (const ev of ['pointerdown', 'keydown']) window.removeEventListener(ev, mark);
    };
  }, []);
}
