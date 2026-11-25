// Test PR #80 — dishKey dùng chung + quy ước "ngày bán" theo tuần giao:
//   1. dishKey: "Giò Lụa" / "giò lụa 500g" / "GIÒ LỤA 1kg" cùng một khoá;
//      "Bánh chưng mặn" → 'banh chung'; "Bánh chưng ngọt" là khoá KHÁC.
//   2. dishLabel: lấy tên thực đơn khi khớp khoá, không thì tên dự phòng.
//   3. Tuần giao: đơn tạo thứ Hai giao thứ Bảy + đơn tạo tối thứ Sáu giao thứ Bảy
//      → cùng tuần; đơn tạo tuần trước giao thứ Bảy này → tính tuần này; đơn tạo
//      tuần này giao thứ Bảy sau → CHƯA tính; đơn huỷ loại khắp nơi.
//   4. Nhất quán 3 nơi: summarize().weekItems (Home), buildReport('week') (Báo cáo)
//      và tuần hiện tại của weeklySeries (dự báo) cho cùng tổng số lượng từng món.
// "now" cố định: Thứ Bảy 28/11/2026 12:00 giờ Melbourne (đợt giao 28/11).
// Chạy qua run.mjs (npm run test:dishkey) với TZ=Australia/Melbourne.
process.env.TZ = 'Australia/Melbourne';

import { dishKey, dishLabel } from '../../src/lib/dishKey.js';
import { saleDate } from '../../src/lib/saleDate.js';
import { summarize } from '../../src/lib/stats.js';
import { buildReport } from '../../src/lib/report.js';
import { weeklySeries } from '../../src/lib/forecast.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};

// --- 1+2: dishKey / dishLabel ---
check('"Giò Lụa" = "giò lụa 500g" = "GIÒ LỤA 1kg"',
  dishKey('Giò Lụa') === dishKey('giò lụa 500g') && dishKey('Giò Lụa') === dishKey('GIÒ LỤA 1kg'));
check('"Bánh chưng mặn" → banh chung', dishKey('Bánh chưng mặn') === 'banh chung');
check('"Bánh chưng ngọt" khác banh chung', dishKey('Bánh chưng ngọt') !== 'banh chung' && dishKey('Bánh chưng ngọt') === 'banh chung ngot');
check('"Tàu Hũ" → tau hu singapore (bí danh)', dishKey('Tàu Hũ') === 'tau hu singapore');
const menu = [{ name: 'Giò Lụa' }, { name: 'Bánh Chưng' }, { name: 'Tàu Hũ Singapore' }];
check('dishLabel lấy tên thực đơn', dishLabel('tau hu singapore', menu, 'Tàu Hũ') === 'Tàu Hũ Singapore');
check('dishLabel không có trong thực đơn → dự phòng', dishLabel('banh chung ngot', menu, 'Bánh chưng ngọt') === 'Bánh chưng ngọt');
check('saleDate không có deliverAt → createdAt',
  saleDate({ createdAt: '2026-11-25T01:00:00.000Z' }).toISOString() === '2026-11-25T01:00:00.000Z');

// --- 3+4: bộ đơn mẫu quanh đợt giao thứ Bảy 28/11/2026 ---
const at = (d, h = 0, min = 0) => new Date(2026, 10, d, h, min).toISOString(); // tháng 11/2026, giờ địa phương
const mk = (id, createdAt, deliverAt, status, items) => ({
  id, status, paid: false, shippingFee: 0, discount: 0,
  customer: { name: 'Khách', phone: '', address: '' }, items, createdAt, deliverAt,
});
const orders = [
  mk('A', at(23, 9), at(28, 9), 'done', [{ name: 'Giò Lụa', qty: 2, price: 13 }]), // tạo T2, giao T7
  mk('B', at(27, 21, 30), at(28, 10), 'pending', [
    { name: 'giò lụa 500g', qty: 3, price: 13 },
    { name: 'Bánh chưng mặn', qty: 1, price: 15 },
  ]), // tạo tối T6, giao T7
  mk('C', at(20, 10), at(28, 8), 'done', [{ name: 'GIÒ LỤA 1kg', qty: 1, price: 26 }]), // tạo tuần trước, giao T7 này
  mk('D', at(25, 10), at(30 + 5, 9), 'pending', [{ name: 'Giò Lụa', qty: 10, price: 13 }]), // giao 5/12 — đợt sau (at() tháng 11: ngày 35 → 5/12)
  mk('E', at(26, 10), at(28, 9, 30), 'cancelled', [{ name: 'Bánh Cuốn', qty: 7, price: 16 }]), // huỷ — loại
  mk('F', at(24, 10), at(28, 9, 30), 'done', [{ name: 'Bánh chưng ngọt', qty: 2, price: 15 }]),
];
const now = new Date(2026, 10, 28, 12, 0);

const s = summarize(orders, now, menu);
check('summarize: tuần giao có 4 đơn (A, B, C, F)', s.weekOrderCount === 4);
check('summarize: doanh thu tuần $136', s.weekRevenue === 136);
const sQty = Object.fromEntries(s.weekItems.map((i) => [i.name, i.qty]));
check('summarize: Giò Lụa gộp 3 cách ghi = 6 phần', sQty['Giò Lụa'] === 6);
check('summarize: Bánh Chưng (mặn) hiện tên thực đơn, 1 phần', sQty['Bánh Chưng'] === 1);
check('summarize: Bánh chưng ngọt tách riêng, 2 phần', sQty['Bánh chưng ngọt'] === 2);
check('summarize: xếp theo doanh thu (Giò Lụa $91 đứng đầu)', s.weekItems[0].name === 'Giò Lụa' && s.weekItems[0].revenue === 91);
check('summarize: đơn huỷ + đơn đợt sau không lọt', s.weekItems.every((i) => i.name !== 'Bánh Cuốn') && sQty['Giò Lụa'] === 6);

// --- A1 (issue #89): món doanh thu cao nhất KHÔNG phải món nhiều phần nhất ---
// Thanh "Món bán trong tuần" ở Home chia theo số phần lớn nhất thật; bản cũ lấy
// weekItems[0].qty (món doanh thu cao nhất) làm mẫu số → thanh dài quá 100%.
import { readFileSync } from 'node:fs';
const a1Orders = [
  mk('G', at(24, 9), at(28, 9), 'done', [{ name: 'Lạp Xưởng', qty: 4, price: 20 }]), // $80 · 4 phần
  mk('H', at(24, 10), at(28, 9), 'done', [{ name: 'Bánh Giò', qty: 10, price: 6 }]), // $60 · 10 phần
];
const sA1 = summarize(a1Orders, now, menu);
const maxQtyA1 = Math.max(0, ...sA1.weekItems.map((i) => i.qty));
check('A1: món đầu bảng là Lạp Xưởng (doanh thu) nhưng chỉ 4 phần', sA1.weekItems[0].name === 'Lạp Xưởng' && sA1.weekItems[0].qty === 4);
check('A1: maxQty thật = 10 và mọi tỉ lệ qty/maxQty ≤ 1', maxQtyA1 === 10 && sA1.weekItems.every((i) => i.qty / maxQtyA1 <= 1));
check('A1: HomePage tính maxQty bằng Math.max trên weekItems',
  readFileSync('src/pages/HomePage.jsx', 'utf8').includes('Math.max(0, ...stats.weekItems.map((i) => i.qty))'));

const r = buildReport(orders, 'week', now, menu);
const rQty = Object.fromEntries(r.dishes.map((d) => [d.name, d.qty]));
check('buildReport: doanh thu tuần $136, 4 đơn', r.revenue === 136 && r.orderCount === 4);
check('buildReport khớp summarize từng món',
  rQty['Giò Lụa'] === 6 && rQty['Bánh Chưng'] === 1 && rQty['Bánh chưng ngọt'] === 2);

const ws = weeklySeries(orders, now);
const cur = ws.weeks.find((w) => w.current);
check('weeklySeries: tuần hiện tại là tuần giao 23/11', !!cur);
check('weeklySeries khớp hai nơi trên (theo khoá dishKey)',
  cur && cur.qty.get('gio lua') === 6 && cur.qty.get('banh chung') === 1 && cur.qty.get('banh chung ngot') === 2);

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
