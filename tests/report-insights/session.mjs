// Test phần dữ liệu của bốn tính năng Báo cáo mới:
//   1. Tỉ lệ đơn huỷ (lib/reportInsights periodInsights.cancellation) trên kỳ đang chọn.
//   2. Khách mới / khách quay lại (periodInsights.customers) — khoá định danh là
//      customerKey của app (SĐT chỉ lấy chữ số; không có SĐT thì tên đã chuẩn hoá).
//   3. Mục tiêu lãi TỰ ĐỘNG (lib/autoTarget): công thức walk-forward đã chốt —
//      baseline = TB tối đa 4 tuần đã kết thúc trước đó, hệ số = tuần gần nhất /
//      baseline kẹp [0,8 – 1,2], làm tròn $10. Kèm kiểm tích hợp: chuỗi lãi ròng từ
//      profitReport đưa qua attachAutoTargets cho đúng mục tiêu tính tay.
//   4. Nhịp tuần trong tháng (weekOfMonthRhythm): vị trí tuần theo weekOfMonth của
//      lib/forecast, chỉ tuần đã kết thúc trong 6 tháng gần nhất, đơn huỷ loại ra,
//      và trạng thái "chưa đủ dữ liệu" khi lịch sử dưới ~3 tháng.
// Dữ liệu giả, "now" cố định Thứ Tư 18/11/2026 12:00 (tuần này: Thứ Hai 16/11 – 23/11).
// Chạy qua run.mjs (npm run test:insights).
import { profitReport } from '../../src/lib/inventory.js';
import { periodRange, shiftPeriod } from '../../src/lib/report.js';
import { attachAutoTargets, weeklyAutoTarget } from '../../src/lib/autoTarget.js';
import { orderCustomerKey, periodInsights, weekOfMonthRhythm } from '../../src/lib/reportInsights.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const near = (a, b) => a != null && b != null && Math.abs(a - b) < 0.001;

const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const order = (createdAt, extra = {}) => ({
  createdAt,
  status: 'done',
  items: [{ name: 'Phở Bò', qty: 1, price: 20 }],
  ...extra,
});
const now = new Date(2026, 10, 18, 12, 0);
const weekRange = periodRange('week', now);

// ---------- 1 + 2. Tỉ lệ huỷ & khách mới / quay lại (tuần 16/11 – 23/11) ----------
// Khách A: mua trước kỳ (SĐT viết có khoảng trắng), mua lại trong kỳ (SĐT viết liền) →
//   cùng một khách theo chữ số SĐT → QUAY LẠI. Có thêm 1 đơn huỷ trong kỳ (không đổi
//   phân loại, chỉ tính vào tỉ lệ huỷ).
// Khách B: lần đầu mua trong kỳ (2 đơn) → MỚI, đếm 1 khách.
// Khách C: không SĐT, nhận diện theo tên; đã mua trước kỳ → QUAY LẠI.
// Khách D: chỉ có đúng 1 đơn huỷ trong kỳ → không được tính là khách.
// Khách E: trước kỳ chỉ có đơn HUỶ, trong kỳ có đơn thật → đơn huỷ không tạo lịch sử
//   nên E là khách MỚI.
// 2 đơn không định danh (không có trường customer / khách trống cả tên lẫn SĐT).
const orders12 = [
  // Trước kỳ
  order(at(2026, 10, 10, 10), { customer: { name: 'Anh A', phone: '0400 111 222' } }),
  order(at(2026, 10, 5, 10), { customer: { name: 'Chị Lan', phone: '' } }),
  order(at(2026, 10, 9, 10), { customer: { name: 'Em E', phone: '0400555666' }, status: 'cancelled' }),
  // Trong kỳ (9 đơn: 7 đơn thật + 2 đơn huỷ)
  order(at(2026, 10, 17, 10), { customer: { name: 'Anh A', phone: '0400111222' } }),
  order(at(2026, 10, 18, 9), { customer: { name: 'Bạn B', phone: '0400 333 444' } }),
  order(at(2026, 10, 19, 9), { customer: { name: 'Bạn B', phone: '0400 333 444' } }),
  order(at(2026, 10, 17, 11), { customer: { name: 'Chị Lan', phone: '' } }),
  order(at(2026, 10, 18, 12), { customer: null }),
  order(at(2026, 10, 19, 12), { customer: { name: '', phone: '' } }),
  order(at(2026, 10, 20, 12), { customer: { name: 'Anh A', phone: '0400111222' }, status: 'cancelled' }),
  order(at(2026, 10, 21, 12), { customer: { name: 'Bạn D', phone: '0400777888' }, status: 'cancelled' }),
  order(at(2026, 10, 18, 15), { customer: { name: 'Em E', phone: '0400555666' } }),
];

const ins = periodInsights(orders12, weekRange);
check('tỉ lệ huỷ: tổng đơn trong kỳ = 9 (gồm cả đơn huỷ)', ins.cancellation.totalOrders === 9);
check('tỉ lệ huỷ: số đơn huỷ = 2', ins.cancellation.cancelledOrders === 2);
check('tỉ lệ huỷ: tỉ lệ = 2/9', near(ins.cancellation.cancelRate, 2 / 9));

check('khách: tổng khách có đơn trong kỳ = 4 (A, B, C, E — D chỉ có đơn huỷ nên không tính)', ins.customers.total === 4);
check('khách: khách mới = 2 (B lần đầu trong kỳ, E vì đơn trước kỳ của E đã huỷ)', ins.customers.newCount === 2);
check('khách: khách quay lại = 2 (A theo SĐT dù viết khác định dạng, C theo tên)', ins.customers.returningCount === 2);
check('khách: % khách quay lại = 50%', near(ins.customers.returningRate, 0.5));
check('khách: 2 đơn không định danh bị loại khỏi thống kê khách', ins.customers.anonymousOrders === 2);

check('orderCustomerKey: đơn không có khách → null', orderCustomerKey({ customer: null }) === null);
check('orderCustomerKey: khách trống cả tên lẫn SĐT → null', orderCustomerKey({ customer: { name: '', phone: '' } }) === null);
check(
  'orderCustomerKey: SĐT có khoảng trắng và viết liền cho cùng một khoá',
  orderCustomerKey({ customer: { name: 'A', phone: '0400 111 222' } }) ===
    orderCustomerKey({ customer: { name: 'A', phone: '0400111222' } }),
);

// Kỳ trống: không chia 0, tỉ lệ = null để giao diện hiện "—"
const emptyIns = periodInsights(orders12, periodRange('week', new Date(2025, 0, 6)));
check(
  'kỳ trống: tổng 0 đơn, tỉ lệ huỷ null, 0 khách, % quay lại null',
  emptyIns.cancellation.totalOrders === 0 &&
    emptyIns.cancellation.cancelRate === null &&
    emptyIns.customers.total === 0 &&
    emptyIns.customers.returningRate === null,
);

// ---------- 3. Mục tiêu lãi tự động ----------
check('mục tiêu: 4 tuần trước đều $500, tuần gần nhất $500 → $500', weeklyAutoTarget([500, 500, 500, 500]) === 500);
check('mục tiêu: tuần gần nhất tăng lên $600 → $600', weeklyAutoTarget([500, 500, 500, 600]) === 600);
check('mục tiêu: tuần gần nhất giảm còn $400 → $400', weeklyAutoTarget([500, 500, 500, 400]) === 400);
check('mục tiêu: tuần gần nhất vọt quá cao bị kẹp 1,2 (baseline $200 → $240)', weeklyAutoTarget([100, 100, 100, 500]) === 240);
check('mục tiêu: tuần gần nhất tụt quá thấp bị kẹp 0,8 (baseline $400 → $320)', weeklyAutoTarget([500, 500, 500, 100]) === 320);
check('mục tiêu: ít hơn 4 tuần lịch sử vẫn tính (2 tuần $300/$500 → baseline $400 × 1,2 kẹp = $480)', weeklyAutoTarget([300, 500]) === 480);
check('mục tiêu: làm tròn đến $10 gần nhất (1 tuần $505 → $510)', weeklyAutoTarget([505]) === 510);
check('mục tiêu: không có lịch sử → null', weeklyAutoTarget([]) === null);
check('mục tiêu: baseline = 0 → null', weeklyAutoTarget([0, 0]) === null);
check('mục tiêu: baseline âm → null', weeklyAutoTarget([-100, 50]) === null);
check('mục tiêu: chỉ lấy 4 tuần gần nhất (tuần $9999 xa hơn bị bỏ)', weeklyAutoTarget([9999, 500, 500, 500, 500]) === 500);

// Walk-forward trên chuỗi: mục tiêu của một tuần không được dùng lãi của chính tuần đó.
const series = [500, 500, 500, 500, 600, 400];
const targets = attachAutoTargets(series.map((profit) => ({ profit })));
check(
  'walk-forward: chuỗi [500,500,500,500,600,400] → mục tiêu [null,500,500,500,500,600]',
  targets[0] === null && targets[1] === 500 && targets[2] === 500 && targets[3] === 500 && targets[4] === 500 && targets[5] === 600,
);

// Tích hợp: chuỗi lãi ròng từ profitReport (món không công thức → giá vốn 0, không chi
// phí khác nên lãi ròng = doanh thu) qua attachAutoTargets.
const menu3 = [{ id: 'dish1', name: 'Phở Bò', price: 20 }];
const mkOrder = (createdAt, qty) => ({ createdAt, status: 'done', items: [{ name: 'Món Lẻ', qty, price: 20 }] });
const orders3 = [
  mkOrder(at(2026, 10, 3, 10), 20), // tuần 2/11: doanh thu $400
  mkOrder(at(2026, 10, 10, 10), 30), // tuần 9/11: doanh thu $600
  mkOrder(at(2026, 10, 17, 10), 5), // tuần này: doanh thu $100
];
const run3 = (range) =>
  profitReport({ range, orders: orders3, menu: menu3, recipes: [], ingredients: [], purchases: [], expenses: [], batches: [] });
// i chạy 2 → 0 tức là tuần cũ nhất trước: chuỗi đã xếp cũ → mới, đúng thứ tự attachAutoTargets cần.
const netSeries = [2, 1, 0].map((i) => run3(periodRange('week', shiftPeriod('week', now, -i))));
check(
  'tích hợp: chuỗi lãi ròng 3 tuần từ profitReport = [$400, $600, $100]',
  near(netSeries[0].profit, 400) && near(netSeries[1].profit, 600) && near(netSeries[2].profit, 100),
);
const targets3 = attachAutoTargets(netSeries);
check(
  'tích hợp: mục tiêu = [null, $400, $600] (tuần này: baseline $500 × hệ số 1,2 đúng biên kẹp)',
  targets3[0] === null && targets3[1] === 400 && targets3[2] === 600,
);

// ---------- 4. Nhịp tuần trong tháng ----------
// 15 tuần đã kết thúc, Thứ Hai từ 3/8/2026 đến 9/11/2026. Vị trí theo weekOfMonth
// (ngày thứ Năm quyết định): vị trí 1 xuất hiện 4 lần, 2 → 4 lần, 3 → 3 lần, 4 → 3 lần,
// 5 → 1 lần. Số đơn mỗi tuần theo vị trí: 1 → 10, 2 → 8, 3 → 4, 4 → 6, 5 → 5.
// Tổng 107 đơn, TB một tuần = 107/15.
const mondays = [
  [2026, 7, 3], [2026, 7, 10], [2026, 7, 17], [2026, 7, 24], [2026, 7, 31],
  [2026, 8, 7], [2026, 8, 14], [2026, 8, 21], [2026, 8, 28],
  [2026, 9, 5], [2026, 9, 12], [2026, 9, 19], [2026, 9, 26],
  [2026, 10, 2], [2026, 10, 9],
];
const countByPosition = { 1: 10, 2: 8, 3: 4, 4: 6, 5: 5 };
const positionOf = [1, 2, 3, 4, 1, 2, 3, 4, 1, 2, 3, 4, 5, 1, 2];
const orders4 = [];
mondays.forEach(([y, m, d], wi) => {
  const count = countByPosition[positionOf[wi]];
  for (let k = 0; k < count; k += 1) orders4.push(order(at(y, m, d, 10, k), { customer: null, items: [] }));
});
// Nhiễu phải bị loại: 3 đơn huỷ ở tuần vị trí 3 (14/9) và 20 đơn ở tuần ĐANG chạy (16/11)
for (let k = 0; k < 3; k += 1) orders4.push(order(at(2026, 8, 14, 12, k), { status: 'cancelled', items: [] }));
for (let k = 0; k < 20; k += 1) orders4.push(order(at(2026, 10, 16, 10, k), { items: [] }));

const rhythm = weekOfMonthRhythm(orders4, now);
check('nhịp tuần: đủ dữ liệu (15 tuần ≥ 12)', rhythm.enough === true && rhythm.weeksConsidered === 15);
check('nhịp tuần: tổng đơn = 107 (đơn huỷ và tuần đang chạy bị loại)', rhythm.totalOrders === 107);
check('nhịp tuần: TB một tuần thường = 107/15', near(rhythm.overallAvg, 107 / 15));
const pos = (p) => rhythm.positions.find((x) => x.position === p);
check(
  'nhịp tuần: số lần xuất hiện theo vị trí = [4, 4, 3, 3, 1]',
  pos(1).occurrences === 4 && pos(2).occurrences === 4 && pos(3).occurrences === 3 && pos(4).occurrences === 3 && pos(5).occurrences === 1,
);
check(
  'nhịp tuần: đơn TB mỗi lần xuất hiện = [10, 8, 4, 6, 5]',
  near(pos(1).avgOrders, 10) && near(pos(2).avgOrders, 8) && near(pos(3).avgOrders, 4) && near(pos(4).avgOrders, 6) && near(pos(5).avgOrders, 5),
);
check(
  'nhịp tuần: % chênh đúng (tuần 1 ≈ +40,2%, tuần 3 ≈ −43,9%)',
  near(pos(1).diff, 10 / (107 / 15) - 1) && near(pos(3).diff, 4 / (107 / 15) - 1),
);
check('nhịp tuần: đông nhất = tuần 1, vắng nhất = tuần 3', rhythm.busiest?.position === 1 && rhythm.quietest?.position === 3);

// Ít dữ liệu: chỉ 3 tuần đã kết thúc có đơn → chưa đủ để kết luận
const fewOrders = [];
[2, 9].forEach((d) => fewOrders.push(order(at(2026, 10, d, 10), { items: [] })));
fewOrders.push(order(at(2026, 9, 26, 10), { items: [] }));
const few = weekOfMonthRhythm(fewOrders, now);
check('nhịp tuần: mới 3 tuần dữ liệu → trạng thái chưa đủ dữ liệu', few.enough === false && few.weeksConsidered === 3);
check('nhịp tuần: không có đơn nào → chưa đủ dữ liệu, 0 tuần', weekOfMonthRhythm([], now).enough === false && weekOfMonthRhythm([], now).weeksConsidered === 0);

console.log(failures ? `\nKẾT QUẢ: ${failures} khẳng định THẤT BẠI` : '\nKẾT QUẢ: TẤT CẢ TEST ĐỀU PASS');
process.exit(failures ? 1 : 0);
