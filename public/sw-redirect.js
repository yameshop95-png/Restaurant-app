// Tên miền wodovn.xyz: trang gốc "/" hiện thẳng web bán hàng (nội dung của /order), URL vẫn là wodovn.xyz.
// Nằm trong service worker vì trình duyệt đã từng mở wodovn.xyz sẽ có app nhân viên được lưu sẵn,
// và service worker có thể trả màn hình PIN từ bộ nhớ trước khi yêu cầu kịp tới máy chủ.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.mode !== 'navigate') return;
  const url = new URL(req.url);
  if ((url.hostname === 'wodovn.xyz' || url.hostname === 'www.wodovn.xyz') && url.pathname === '/') {
    event.respondWith(fetch(new URL('/order', url.origin).href, { credentials: 'same-origin' }));
    event.stopImmediatePropagation();
  }
});
