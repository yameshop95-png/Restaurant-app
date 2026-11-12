// Báo tình trạng của khách đang xem website cho quán (tab "Customer Active" trong app nhân viên).
// Mỗi lần mở website là một phiên (sessionStorage); phiên gửi tình trạng lên máy chủ qua hàm track_session:
// đang xem menu / có món trong giỏ / đang ở trang đặt món / đã đặt, kèm tên, số điện thoại, email nếu khách đã gõ.
// Theo dõi lỗi thì bỏ qua êm: không bao giờ làm hỏng việc đặt món.
import { siteClient } from './client';

const SID_KEY = 'site.sid';
const HEARTBEAT_MS = 20000; // báo "vẫn đang ở đây" mỗi 20 giây
const ACTIVE_WINDOW_MS = 10 * 60 * 1000; // quá 10 phút không chạm gì thì ngừng báo (tab mở bỏ quên)
const DEBOUNCE_MS = 700;

const state = {
  stage: 'browsing',
  cart_count: 0,
  cart_total: 0,
  items: '',
  name: '',
  phone: '',
  email: '',
  lang: '',
  path: '',
  order_number: null,
};

let sid = null;
let started = false;
let disabled = false;
let ordered = false;
let lastActive = 0;
let timer = null;
let heartbeat = null;

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ??
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

// Máy dò (Googlebot, kiểm thử tự động...) không tính là khách
const looksLikeBot = () =>
  typeof navigator === 'undefined' ||
  navigator.webdriver === true ||
  /bot|crawl|spider|slurp|headless|lighthouse|prerender|facebookexternalhit/i.test(navigator.userAgent || '');

function sessionId() {
  if (sid) return sid;
  try {
    sid = sessionStorage.getItem(SID_KEY);
    if (!sid) {
      sid = uuid();
      sessionStorage.setItem(SID_KEY, sid);
    }
  } catch {
    sid = uuid(); // trình duyệt chặn sessionStorage: dùng mã tạm cho lần mở này
  }
  return sid;
}

function flush() {
  timer = null;
  if (disabled) return;
  const payload = { sid: sessionId(), ...state };
  try {
    siteClient()
      .rpc('track_session', { payload })
      .then(({ error }) => {
        // Hàm chưa được cài trên máy chủ (chưa chạy file SQL): thôi không gọi nữa trong lần mở này
        if (error && /track_session|PGRST202|42883|404/.test(`${error.code} ${error.message}`)) disabled = true;
      })
      .catch(() => {});
  } catch {
    // bỏ qua
  }
}

function schedule(immediate = false) {
  if (disabled || !started) return;
  clearTimeout(timer);
  timer = setTimeout(flush, immediate ? 0 : DEBOUNCE_MS);
}

function markActive() {
  lastActive = Date.now();
}

export function startTracking() {
  if (started || disabled || looksLikeBot()) return;
  started = true;
  markActive();
  for (const ev of ['pointerdown', 'keydown', 'scroll', 'touchstart']) {
    window.addEventListener(ev, markActive, { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      markActive();
      schedule(true);
    }
  });
  heartbeat = setInterval(() => {
    if (document.visibilityState !== 'visible' || Date.now() - lastActive > ACTIVE_WINDOW_MS) return;
    flush();
  }, HEARTBEAT_MS);
  schedule(true);
}

export function stopTracking() {
  clearInterval(heartbeat);
  clearTimeout(timer);
  started = false;
}

// Bước hiện tại của khách theo trang đang xem và giỏ hàng
export function trackView({ routeName, count, total, items, lang, path }) {
  if (!started) return;
  let stage = 'browsing';
  if (count > 0) stage = routeName === 'checkout' ? 'checkout' : 'cart';
  else if (ordered) stage = 'ordered'; // đặt xong, giỏ trống: vẫn là khách đã đặt
  Object.assign(state, { stage, cart_count: count, cart_total: total, items, lang, path });
  schedule();
}

// Khách gõ tên / số điện thoại / email ở trang đặt món. Chỉ lưu số điện thoại đủ dài và email đúng dạng.
export function trackContact({ name = '', phone = '', email = '' }) {
  if (!started) return;
  const digits = phone.replace(/\D/g, '');
  Object.assign(state, {
    name: name.trim(),
    phone: digits.length >= 8 ? phone.trim() : '',
    email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) ? email.trim() : '',
  });
  schedule();
}

// Đặt món thành công
export function trackOrdered(orderNumber) {
  if (!started) return;
  ordered = true;
  Object.assign(state, {
    stage: 'ordered',
    cart_count: 0,
    cart_total: 0,
    items: '',
    order_number: orderNumber ?? null,
  });
  schedule(true);
}
