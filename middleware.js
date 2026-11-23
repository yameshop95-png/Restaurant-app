// wodovn.xyz (và www.wodovn.xyz): trang gốc hiện thẳng web bán hàng, khách không cần gõ thêm /order.
// Middleware chạy trước cả file tĩnh, nên thắng trang app nhân viên (index.html) ở "/".
// Địa chỉ vercel.app không bị ảnh hưởng: app nhân viên vẫn mở như cũ.
export const config = { matcher: '/' };

export default function middleware(request) {
  const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
  if (host === 'wodovn.xyz' || host === 'www.wodovn.xyz') {
    return new Response(null, { headers: { 'x-middleware-rewrite': '/order' } });
  }
}
