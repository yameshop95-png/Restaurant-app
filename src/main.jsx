import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import './staff-motion.css';

// iOS chỉ hiện :active trên phần tử không phải nút sau khi đã có một listener chạm.
window.addEventListener('touchstart', () => {}, { passive: true });

// Giữ ô đang bấm thêm một nhịp sau khi thả, để vệt cam kịp hiện trên cú chạm nhanh.
const pressTarget = (event) => {
  const node = event.target;
  if (!(node instanceof Element)) return null;
  const el = node.closest('.staff-press');
  if (!el || el.matches(':disabled')) return null;
  return el;
};
let pressedEl = null;
const releasePress = (el) => {
  window.clearTimeout(el._staffPressTimer);
  el._staffPressTimer = window.setTimeout(() => el.classList.remove('is-pressed'), 220);
};
window.addEventListener(
  'pointerdown',
  (event) => {
    const el = pressTarget(event);
    if (!el) return;
    if (pressedEl && pressedEl !== el) {
      window.clearTimeout(pressedEl._staffPressTimer);
      pressedEl.classList.remove('is-pressed');
    }
    pressedEl = el;
    el.classList.add('is-pressed');
    window.clearTimeout(el._staffPressTimer);
  },
  { passive: true },
);
window.addEventListener(
  'pointerup',
  () => {
    if (!pressedEl) return;
    releasePress(pressedEl);
    pressedEl = null;
  },
  { passive: true },
);
window.addEventListener(
  'pointercancel',
  () => {
    if (!pressedEl) return;
    window.clearTimeout(pressedEl._staffPressTimer);
    pressedEl.classList.remove('is-pressed');
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
