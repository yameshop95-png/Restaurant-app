// Cảnh báo giờ giao cho đơn chưa giao xong (Chờ xử lý / Hoàn thành).
export const SOON_MINUTES = 30;

const ACTIVE = new Set(['pending', 'done']);

// null: chưa cần lo · { level: 'soon', minutes } còn ≤ 30 phút · { level: 'overdue', minutes } đã trễ
export function dueInfo(order, now) {
  if (!order.deliverAt || !ACTIVE.has(order.status)) return null;
  const minutes = Math.round((new Date(order.deliverAt) - now) / 60000);
  if (minutes < 0) return { level: 'overdue', minutes: -minutes };
  if (minutes <= SOON_MINUTES) return { level: 'soon', minutes };
  return null;
}

export function formatDue({ level, minutes }) {
  const span = minutes >= 60 ? `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút` : `${minutes} phút`;
  if (level === 'overdue') return minutes === 0 ? 'Đến giờ giao' : `Trễ ${span}`;
  return minutes === 0 ? 'Đến giờ giao' : `Còn ${span}`;
}

// Đơn cần giao trong `withinMinutes` tới (kể cả đơn đã trễ), giờ giao sớm nhất trước
export function upcomingOrders(orders, now, withinMinutes = 60) {
  const limit = now.getTime() + withinMinutes * 60000;
  return orders
    .filter((o) => o.deliverAt && ACTIVE.has(o.status) && new Date(o.deliverAt).getTime() <= limit)
    .sort((a, b) => a.deliverAt.localeCompare(b.deliverAt));
}

// Tiếng "bíp bíp" ngắn bằng Web Audio (không cần file âm thanh) + rung nếu máy hỗ trợ.
let audioCtx;
export function alertBeep() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = audioCtx.currentTime;
    for (const start of [0, 0.25]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.3, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.18);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + start);
      osc.stop(t + start + 0.2);
    }
  } catch {
    // Trình duyệt không cho phát âm thanh: bỏ qua
  }
  navigator.vibrate?.([200, 100, 200]);
}
