// Link công khai gửi cho khách — LUÔN là domain chính thức, không lấy theo
// origin của app nhân viên: app chạy ở domain vercel.app nên
// `${window.location.origin}/order` cho ra link cũ mỗi khi nhân viên mở app
// ở địa chỉ đó (đúng lỗi Paul gặp ở Cài đặt → Website đặt món, 25/11/2026).
// Giá trị phải khớp SITE_URL của website (src/site/lib.js — xem PR #61:
// canonical/og/sitemap cũng lấy từ đó).
export const CUSTOMER_SITE_URL = 'https://www.wodovn.xyz';
export const CUSTOMER_ORDER_LINK = `${CUSTOMER_SITE_URL}/order`;
