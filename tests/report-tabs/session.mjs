// Test PR #81 — Báo cáo chia 3 tab con:
//   - Thanh tab có đủ 3 nhãn ở mọi tab.
//   - Theo kỳ (mặc định): đủ các thẻ của plan — chọn kỳ (Tuần/Tháng/Năm), Tổng quan
//     (có dòng tỉ lệ huỷ), Báo cáo Hiệu suất Tuần, Doanh thu theo ngày, Dự báo
//     DOANH THU (tên mới), Tổng món đã bán, Nhịp tuần, Thời điểm trong tháng,
//     Nhận xét nhanh, Dữ liệu phân tích theo tháng (xuất dữ liệu, cuối tab).
//     Thẻ của tab khác không lọt sang.
//   - Đợt này: thẻ giữ chỗ "Số liệu đợt thứ Bảy — đang làm".
//   - Khách & món: dòng "Kỳ: Tháng …" + đủ 4 thẻ (Khách hàng trong kỳ, Khách theo
//     ngôn ngữ, Món hay mua kèm, Phân tích bằng AI).
//   - Hàng món trong bảng Tổng món đã bán có hàng phụ sm:hidden (cấu trúc 2 hàng
//     cho điện thoại) và tên món chỉ cắt ở sm trở lên (sm:truncate).
// Chạy qua run.mjs (npm run test:reporttabs).
import React from 'react';
import { renderToString } from 'react-dom/server';
import ReportPage from '../../src/pages/ReportPage.jsx';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const render = (props) =>
  renderToString(React.createElement(ReportPage, props)).replace(/<!-- -->/g, '').replace(/&amp;/g, '&');

const MENU = ['Bánh cuốn', 'Giò Lụa', 'Chả Bì', 'Bánh Tét Chuối', 'Tàu Hũ Singapore'].map((name, i) => ({ name, price: 10 + i }));
const at = (d, h = 9) => new Date(2026, 10, d, h).toISOString();
const mk = (id, created, deliver, items) => ({
  id, status: 'done', paid: true, shippingFee: 0, discount: 0,
  customer: { name: 'Khách A', phone: '0400000000', address: 'Wodonga VIC 3690' },
  items, createdAt: created, deliverAt: deliver, source: 'web', lang: 'vi',
});
const ORDERS = [
  mk('o1', at(5), at(7), [{ name: 'Bánh cuốn', qty: 3, price: 16 }, { name: 'Giò Lụa', qty: 2, price: 13 }]),
  mk('o2', at(12), at(14), [{ name: 'Bánh Tét Chuối', qty: 1, price: 15 }, { name: 'Tàu Hũ Singapore', qty: 4, price: 6 }]),
  mk('o3', at(19), at(21), [{ name: 'Chả Bì', qty: 2, price: 13 }]),
];
const base = { orders: ORDERS, menu: MENU, settings: {}, onUpdateSettings: () => {} };

// --- Theo kỳ (từ PR #82 mặc định là Đợt này nên truyền initialTab tường minh) ---
const ky = render({ ...base, initialTab: 'theo-ky' });
for (const label of ['Đợt này', 'Theo kỳ', 'Khách & món']) {
  check(`Thanh tab có "${label}"`, ky.includes(label));
}
for (const marker of [
  'Tuần', 'Tháng', 'Năm', // bộ chọn kỳ
  'tỉ lệ huỷ', // Tổng quan
  'Báo cáo Hiệu suất Tuần',
  'Doanh thu theo tuần giao', // PR #82: kỳ Tháng thay biểu đồ theo ngày bằng cột tuần giao
  'Dự báo doanh thu',
  'Tổng món đã bán',
  'Đơn theo vùng', // PR #83: sau Tổng món đã bán
  'Giao hàng',
  'Công nợ',
  'Xử lý đơn web',
  'Nhịp tuần',
  'Thời điểm trong tháng',
  'Nhận xét nhanh',
  'Dữ liệu phân tích theo tháng',
]) {
  check(`Theo kỳ có "${marker}"`, ky.includes(marker));
}
check('Theo kỳ: không còn "Doanh thu theo ngày" ở kỳ Tháng', !ky.includes('Doanh thu theo ngày'));
check('Theo kỳ: thẻ xuất dữ liệu nằm SAU Nhận xét nhanh',
  ky.indexOf('Dữ liệu phân tích theo tháng') > ky.indexOf('Nhận xét nhanh'));
check('Theo kỳ (PR #83): thứ tự Đơn theo vùng → Dự báo doanh thu → Giao hàng → Công nợ → Xử lý đơn web → Nhịp tuần',
  ky.indexOf('Đơn theo vùng') > ky.indexOf('Tổng món đã bán') &&
  ky.indexOf('Dự báo doanh thu') > ky.indexOf('Đơn theo vùng') &&
  ky.indexOf('Giao hàng') > ky.indexOf('Dự báo doanh thu') &&
  ky.indexOf('Công nợ') > ky.indexOf('Giao hàng') &&
  ky.indexOf('Xử lý đơn web') > ky.indexOf('Công nợ') &&
  ky.indexOf('Nhịp tuần') > ky.indexOf('Xử lý đơn web'));
for (const absent of ['Khách hàng trong kỳ', 'Khách theo ngôn ngữ', 'Món hay mua kèm', 'Phân tích bằng AI', 'Số liệu đợt thứ Bảy — đang làm']) {
  check(`Theo kỳ không lọt "${absent}"`, !ky.includes(absent));
}
check('Bảng món: có hàng phụ cho điện thoại (sm:hidden)', ky.includes('sm:hidden'));
check('Bảng món: tên món chỉ cắt chữ từ sm (sm:truncate)', ky.includes('sm:truncate'));
check('Bảng món: món dài nhất hiện đủ trong HTML', ky.includes('Tàu Hũ Singapore'));

// --- Đợt này (mặc định từ PR #82) ---
// CurrentRunSection nạp bằng React.lazy nên SSR chỉ render được khung chờ —
// kiểm khung chờ hiện và thẻ của tab khác không lọt sang. Nội dung thẻ A/B do
// test current-run kiểm ở tầng lib + Claude render thật bằng Playwright.
const dot = render(base);
check('Đợt này (mặc định): hiện khung chờ nạp thẻ đợt này', dot.includes('Đang tải biểu đồ…'));
check('Đợt này: không có thẻ Theo kỳ', !dot.includes('Tổng món đã bán') && !dot.includes('Báo cáo Hiệu suất Tuần'));
check('Đợt này: không có thẻ Khách & món', !dot.includes('Khách hàng trong kỳ'));

// --- Khách & món ---
const km = render({ ...base, initialTab: 'khach-mon' });
check('Khách & món: có dòng kỳ đang chọn', /Kỳ: Tháng/.test(km));
for (const marker of ['Khách hàng trong kỳ', 'Khách theo ngôn ngữ', 'Món hay mua kèm', 'Phân tích bằng AI']) {
  check(`Khách & món có "${marker}"`, km.includes(marker));
}
check('Khách & món: không có thẻ Theo kỳ', !km.includes('Tổng món đã bán') && !km.includes('Dự báo doanh thu'));

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
