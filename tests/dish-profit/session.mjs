// Test phần dữ liệu của hai tính năng Báo cáo mới:
//   A. Thẻ "Top món theo lãi gộp" (components/DishProfitCard.jsx): thẻ lấy thẳng mảng
//      `dishes` của profitReport (lib/inventory) chạy trên kỳ đang chọn của trang Báo cáo
//      (range của buildReport: tuần / tháng / năm) — mỗi món có qty / revenue / cost /
//      profit (= doanh thu dòng − giá vốn dòng, tức LÃI GỘP của món), đã xếp giảm dần
//      theo profit. Tỉ lệ lãi % của thẻ = profit / revenue của món.
//   B. Mục tiêu lãi tuần trong thẻ "Báo cáo Hiệu suất Tuần" (components/WeeklyPerformanceCard.jsx):
//      đường đứt nét + dấu ◆ dùng chuỗi LÃI RÒNG theo tuần = trường `profit` của profitReport
//      chạy trên các mốc tuần periodRange('week', shiftPeriod('week', now, -i)) — cùng
//      chuỗi số thẻ đã dùng cho tooltip — và so với settings.profitTarget.
// Test khẳng định trên dữ liệu giả (now cố định Thứ Tư 18/11/2026):
//   - Phở Bò $20/phần, giá vốn $5/phần (nguyên liệu $10/kg × 0,5 kg/phần).
//   - Bánh Mì $12/phần, giá vốn $2/phần (nguyên liệu $4/kg × 0,5 kg/phần).
//   - "Món Lẻ" không có công thức → giá vốn 0, lãi gộp = doanh thu (hasRecipe = false).
//   1. Tổng hợp theo món đúng từng dòng (số phần / doanh thu / giá vốn / lãi gộp), xếp
//      giảm dần theo LÃI GỘP (không phải theo tỉ lệ lãi %), tỉ lệ lãi % đúng.
//   2. Cộng lãi gộp các món = lãi gộp toàn kỳ (doanh thu − giá vốn) trên cùng fixture;
//      đơn huỷ bị loại khỏi mọi con số.
//   3. Đổi kỳ (tháng) thì tổng hợp theo món đổi theo đúng kỳ đó.
//   4. Chuỗi lãi ròng theo tuần khớp trường `profit` tính tay (doanh thu − giá vốn −
//      chi phí khác), và phép so với mục tiêu $100 cho kết quả đạt / chưa đạt đúng.
// Chạy qua run.mjs (npm run test:dishprofit).
import { profitReport } from '../../src/lib/inventory.js';
import { periodRange, shiftPeriod } from '../../src/lib/report.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const near = (a, b) => Math.abs(a - b) < 0.001;

const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const order = (createdAt, items, extra = {}) => ({ createdAt, status: 'done', items, ...extra });

const menu = [
  { id: 'dish1', name: 'Phở Bò', price: 20 },
  { id: 'dish2', name: 'Bánh Mì', price: 12 },
];
const recipes = [
  { id: 'dish1', lines: [{ ingredientId: 'ing1', qty: 0.5, unit: 'kg' }], extra: 0 },
  { id: 'dish2', lines: [{ ingredientId: 'ing2', qty: 0.5, unit: 'kg' }], extra: 0 },
];
const ingredients = [
  { id: 'ing1', name: 'Thịt bò', unit: 'kg' },
  { id: 'ing2', name: 'Bột mì', unit: 'kg' },
];
const purchases = [
  { ingredientId: 'ing1', qty: 10, total: 100, date: '2026-10-20' }, // TB $10/kg → Phở vốn $5/phần
  { ingredientId: 'ing2', qty: 10, total: 40, date: '2026-10-20' }, // TB $4/kg → Bánh Mì vốn $2/phần
];
const expenses = [
  { date: '2026-11-18', amount: 30, category: 'Điện nước' }, // chi phí chung tuần này
  { date: '2026-11-12', amount: 10, category: 'Điện nước' }, // chi phí chung tuần trước
];

// "now" cố định: Thứ Tư 18/11/2026, 12:00. Tuần này: Thứ Hai 16/11 – Thứ Hai 23/11.
const now = new Date(2026, 10, 18, 12, 0);
const orders = [
  // Tuần này (16/11 – 23/11)
  order(at(2026, 10, 16, 10), [{ name: 'Phở Bò', qty: 3, price: 20 }]), // tại quán: Phở doanh thu $60, vốn $15
  order(at(2026, 10, 17, 12), [
    { name: 'Phở Bò', qty: 2, price: 20 },
    { name: 'Bánh Mì', qty: 4, price: 12 },
  ], { source: 'web' }), // web: doanh thu $88, vốn $10 + $8
  order(at(2026, 10, 19, 9), [{ name: 'Bánh Mì', qty: 1, price: 12 }]), // tại quán: doanh thu $12, vốn $2
  order(at(2026, 10, 20, 12), [{ name: 'Món Lẻ', qty: 2, price: 15 }]), // món không công thức: doanh thu $30, vốn $0
  order(at(2026, 10, 21, 12), [{ name: 'Phở Bò', qty: 10, price: 99 }], { source: 'web', status: 'cancelled' }), // đơn huỷ → loại
  // Tuần trước (9/11 – 16/11)
  order(at(2026, 10, 10, 12), [{ name: 'Phở Bò', qty: 2, price: 20 }], { source: 'web' }), // web: doanh thu $40, vốn $10
  order(at(2026, 10, 14, 18), [{ name: 'Bánh Mì', qty: 5, price: 12 }]), // tại quán: doanh thu $60, vốn $10
];

const run = (range) => profitReport({ range, orders, menu, recipes, ingredients, purchases, expenses, batches: [] });
const byName = (r, name) => r.dishes.find((d) => d.name === name);
const sum = (r, f) => r.dishes.reduce((s, d) => s + f(d), 0);

// ---------- A. Tuần này: tổng hợp theo món ----------
const weekRange = periodRange('week', now);
const wk = run(weekRange);

check('tuần này: có đúng 3 món trong tổng hợp', wk.dishes.length === 3);
check(
  'tuần này: xếp giảm dần theo LÃI GỘP (Phở $75 > Bánh Mì $50 > Món Lẻ $30)',
  wk.dishes.map((d) => d.name).join('|') === 'Phở Bò|Bánh Mì|Món Lẻ',
);
const pho = byName(wk, 'Phở Bò');
check('Phở Bò: 5 phần, doanh thu $100, giá vốn $25, lãi gộp $75',
  pho.qty === 5 && near(pho.revenue, 100) && near(pho.cost, 25) && near(pho.profit, 75));
const banhMi = byName(wk, 'Bánh Mì');
check('Bánh Mì: 5 phần, doanh thu $60, giá vốn $10, lãi gộp $50',
  banhMi.qty === 5 && near(banhMi.revenue, 60) && near(banhMi.cost, 10) && near(banhMi.profit, 50));
const monLe = byName(wk, 'Món Lẻ');
check('Món Lẻ (không công thức): 2 phần, doanh thu $30, giá vốn $0, lãi gộp $30, hasRecipe = false',
  monLe.qty === 2 && near(monLe.revenue, 30) && near(monLe.cost, 0) && near(monLe.profit, 30) && monLe.hasRecipe === false);
check('Món Lẻ nằm trong danh sách noRecipe của profitReport', wk.noRecipe.includes('Món Lẻ'));

// Tỉ lệ lãi % như thẻ hiển thị = lãi gộp / doanh thu của món
check('tỉ lệ lãi: Phở 75%, Bánh Mì ≈ 83,3%, Món Lẻ 100% (vốn 0)',
  near(pho.profit / pho.revenue, 0.75) && near(banhMi.profit / banhMi.revenue, 50 / 60) && near(monLe.profit / monLe.revenue, 1));

// Cộng dồn các món phải khớp tổng toàn kỳ (fixture không phí ship / giảm giá nên
// doanh thu theo món cộng lại đúng bằng doanh thu kỳ)
check('tuần này: tổng lãi gộp các món = lãi gộp toàn kỳ (doanh thu − giá vốn = $155)',
  near(sum(wk, (d) => d.profit), wk.revenue - wk.cogs) && near(wk.revenue - wk.cogs, 155));
check('tuần này: tổng giá vốn các món = giá vốn toàn kỳ ($35), tổng doanh thu các món = doanh thu kỳ ($190)',
  near(sum(wk, (d) => d.cost), wk.cogs) && near(wk.cogs, 35) && near(sum(wk, (d) => d.revenue), wk.revenue) && near(wk.revenue, 190));

// Đơn huỷ (10 phần Phở $99) bị loại: Phở chỉ có 5 phần, doanh thu kỳ $190 chứ không phải $1.180
check('đơn huỷ bị loại khỏi tổng hợp theo món và doanh thu kỳ', pho.qty === 5 && near(wk.revenue, 190) && wk.orders === 4);

// ---------- A. Đổi kỳ: tháng 11/2026 gộp cả hai tuần ----------
const month = run(periodRange('month', now));
check('tháng 11: Phở lãi gộp $105 (7 phần), Bánh Mì $100 (10 phần), Món Lẻ $30 — Top 1 vẫn là Phở',
  near(byName(month, 'Phở Bò').profit, 105) && byName(month, 'Phở Bò').qty === 7 &&
  near(byName(month, 'Bánh Mì').profit, 100) && byName(month, 'Bánh Mì').qty === 10 &&
  near(byName(month, 'Món Lẻ').profit, 30) && month.dishes[0].name === 'Phở Bò');
check('tháng 11: tổng lãi gộp các món = doanh thu − giá vốn của tháng ($290 − $55 = $235)',
  near(sum(month, (d) => d.profit), month.revenue - month.cogs) && near(month.revenue, 290) && near(month.cogs, 55));

// ---------- B. Chuỗi lãi ròng theo tuần (số liệu cho đường mục tiêu + dấu ◆) ----------
// Cách thẻ dựng chuỗi: profitReport trên periodRange('week', shiftPeriod('week', now, -i)).
const netSeries = [0, 1].map((i) => run(periodRange('week', shiftPeriod('week', now, -i))).profit);
check('lãi ròng tuần này = $125 (doanh thu $190 − giá vốn $35 − chi phí khác $30)', near(netSeries[0], 125));
check('lãi ròng tuần trước = $70 (doanh thu $100 − giá vốn $20 − chi phí khác $10)', near(netSeries[1], 70));

// Lãi ròng = lãi gộp hai kênh − chi phí chung (đúng định nghĩa thẻ dùng trong tooltip)
for (const [i, label] of [[0, 'tuần này'], [1, 'tuần trước']]) {
  const r = run(periodRange('week', shiftPeriod('week', now, -i)));
  const gross = r.channels.reduce((s, c) => s + c.profit, 0);
  check(`${label}: lãi gộp hai kênh − chi phí khác = lãi ròng`, near(gross - r.otherCosts, r.profit));
}

// Phép so mục tiêu như thẻ thực hiện (mục tiêu $100/tuần): tuần này đạt, tuần trước thiếu $30
const TARGET = 100;
check('mục tiêu $100: tuần này đạt (lãi ròng $125 ≥ $100)', netSeries[0] >= TARGET);
check('mục tiêu $100: tuần trước chưa đạt, còn thiếu đúng $30', netSeries[1] < TARGET && near(TARGET - netSeries[1], 30));

console.log(failures ? `\nKẾT QUẢ: ${failures} khẳng định THẤT BẠI` : '\nKẾT QUẢ: TẤT CẢ TEST ĐỀU PASS');
process.exit(failures ? 1 : 0);
