// Tên miền wodovn.xyz: trang gốc luôn chuyển sang website bán hàng (/order).
// Nằm trong service worker vì trình duyệt đã từng mở wodovn.xyz sẽ có app nhân viên được lưu sẵn,
// và service worker có thể trả trang PIN từ bộ nhớ trước khi yêu cầu kịp tới máy chủ (chuyển hướng Vercel không chạy).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if (url.hostname.endsWith('wodovn.xyz') && url.pathname === '/') {
    event.respondWith(Response.redirect('https://www.wodovn.xyz/order', 307));
    event.stopImmediatePropagation();
  }
});
