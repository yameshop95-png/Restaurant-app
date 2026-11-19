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

// Tiếng "bíp bíp" to và dài hơn bằng Web Audio (không cần file âm thanh) + rung nếu máy hỗ trợ.
// 4 tiếng bíp 880 Hz, mỗi tiếng 0,3 giây, âm lượng 0,6 (trước đây: 2 tiếng, 0,2 giây, âm lượng 0,3).
let audioCtx;

// Trình duyệt (nhất là iPhone) chỉ cho phát âm thanh sau khi người dùng đã chạm vào trang ít nhất một lần.
// Gọi hàm này ở lần chạm đầu tiên để chuông báo đơn mới sau đó kêu được dù không ai bấm gì.
export function unlockAudio() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {
    // Không hỗ trợ âm thanh: bỏ qua
  }
  // Nạp sẵn tiếng chuông ở lần chạm đầu tiên để lúc đơn mới vào kêu ngay, không phải chờ tải.
  loadAlertAudio().catch(() => {
    // Không nạp được: lúc kêu sẽ dùng tiếng bíp dự phòng
  });
}

// Tiếng chuông báo đơn mới: file ghi âm thật thay cho tiếng bíp tổng hợp.
// "Bell Chime Alert" của plasterbrain, Freesound, giấy phép CC0 (dùng cho quán được):
// https://freesound.org/people/plasterbrain/sounds/419493/ — 0,67 giây, chuông cao ~740 Hz.
// Âm thanh nằm trong alertSoundData.js (base64) và được giải mã thành Blob URL lúc chạy;
// import() động để đoạn base64 ~157 KB chỉ tải khi cần kêu, không nặng thêm lúc mở app.
let alertAudioUrl;
let alertAudioLoad;
let alertAudio;

function loadAlertAudio() {
  if (alertAudioUrl) return Promise.resolve(alertAudioUrl);
  alertAudioLoad ??= import('./alertSoundData.js')
    .then(({ default: base64 }) => {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      alertAudioUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      return alertAudioUrl;
    })
    .catch(() => {
      alertAudioLoad = null;
      return null;
    });
  return alertAudioLoad;
}

function playAlertAudio() {
  loadAlertAudio().then((url) => {
    if (!url) {
      playFallbackBeeps();
      return;
    }
    try {
      alertAudio ??= new Audio(url);
      alertAudio.currentTime = 0;
      const played = alertAudio.play();
      if (played) played.catch(() => playFallbackBeeps());
    } catch {
      playFallbackBeeps();
    }
  });
}

// Dự phòng khi file chuông không phát được (chưa mở khoá âm thanh, file lỗi…):
// dùng lại tiếng bíp tổng hợp 4 nốt 880 Hz như trước để nhân viên vẫn nghe thấy.
function playFallbackBeeps() {
  try {
    audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    for (const start of [0, 0.35, 0.7, 1.05]) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t + start);
      gain.gain.exponentialRampToValueAtTime(0.6, t + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.28);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t + start);
      osc.stop(t + start + 0.3);
    }
  } catch {
    // Trình duyệt không cho phát âm thanh: bỏ qua
  }
}

export function alertBeep() {
  playAlertAudio();
  navigator.vibrate?.([400, 100, 400, 100, 400]);
}
