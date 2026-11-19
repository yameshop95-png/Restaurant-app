import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './staff-motion.css';

// iOS chỉ hiện :active trên phần tử không phải nút sau khi đã có một listener chạm.
window.addEventListener('touchstart', () => {}, { passive: true });

// Bong bóng: bóp nhẹ rồi nảy vượt lên và về chỗ. Chạy hết sau khi thả tay,
// để một cú chạm nhanh trên điện thoại vẫn thấy đủ nhịp.
const SQUISH_MS = 90;
const POP_MS = 560;
const pressTarget = (event) => {
  const node = event.target;
  if (!(node instanceof Element)) return null;
  const el = node.closest('.staff-press');
  if (!el || el.matches(':disabled')) return null;
  return el;
};
let pressedEl = null;
const stopBubble = (el) => {
  window.clearTimeout(el._staffSquishTimer);
  window.clearTimeout(el._staffPopTimer);
  el.classList.remove('is-squish', 'is-pop');
};
const playBubble = (el) => {
  stopBubble(el);
  void el.offsetWidth;
  el.classList.add('is-squish');
  el._staffSquishTimer = window.setTimeout(() => {
    el.classList.remove('is-squish');
    el.classList.add('is-pop');
    el._staffPopTimer = window.setTimeout(() => el.classList.remove('is-pop'), POP_MS);
  }, SQUISH_MS);
};
window.addEventListener(
  'pointerdown',
  (event) => {
    const el = pressTarget(event);
    if (!el) return;
    pressedEl = el;
    playBubble(el);
  },
  { passive: true },
);
window.addEventListener(
  'pointerup',
  () => {
    pressedEl = null;
  },
  { passive: true },
);
window.addEventListener(
  'pointercancel',
  () => {
    if (!pressedEl) return;
    stopBubble(pressedEl);
    pressedEl = null;
  },
  { passive: true },
);

// Android / Chrome: giữ lại lời mời "Cài app" để hiện nút cài trong Cài đặt app
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__installPrompt = e;
  window.dispatchEvent(new Event('installpromptready'));
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
