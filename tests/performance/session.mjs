// Test phần dữ liệu của thẻ "Báo cáo Hiệu suất Tuần" (components/WeeklyPerformanceCard.jsx).
// Thẻ không tự tính: nó lấy mọi số từ profitReport (lib/inventory) chạy trên các mốc tuần
// periodRange('week', shiftPeriod('week', now, -i)) (lib/report) — tuần Thứ Hai 00:00 →
// Thứ Hai tuần sau. Lượt mở rộng của profitReport thêm hai thứ cho thẻ:
//   - `channels`: tách doanh thu / giá vốn / lãi gộp theo kênh bán. Kênh đọc từ trường
//     `source` của đơn: place_web_order ghi source: 'web' cho đơn khách đặt qua website;
//     đơn nhân viên tạo trong app không có `source` → kênh tại quán ('shop').
//     Lãi gộp kênh = doanh thu kênh − giá vốn kênh (giá vốn tính được cho từng đơn).
//     Chi phí khác là chi phí chung của kỳ, không gán cho kênh nào.
//   - `highValueOrders`: số đơn có tổng tiền (món + phí ship − giảm giá) >= HIGH_VALUE_ORDER_MIN.
// Test khẳng định trên dữ liệu giả (now cố định Thứ Tư 18/11/2026; món Phở Bò $20/phần,
// giá vốn $5/phần từ nguyên liệu $10/kg × 0,5 kg/phần):
//   1. Mốc tuần đúng quy ước Thứ Hai 00:00, dài 7 ngày, nối tiếp nhau không hở.
//   2. Các trường cũ của profitReport (revenue / cogs / otherCosts / profit / orders)
//      giữ đúng giá trị kỳ vọng như trước khi mở rộng.
//   3. Cộng hai kênh từng tuần = tổng toàn tuần (đơn, doanh thu); cộng lãi gộp hai kênh
//      = doanh thu − giá vốn của tuần, và trừ chi phí khác thì = lãi ròng `profit`.
//      Tách kênh của profitReport khớp với tách tay theo `source` trên cùng tập đơn.
//   4. Đơn cao giá đếm đúng ngưỡng $50: đơn đúng $50 được tính, đơn $49,99 không,
//      đơn huỷ $99 bị loại, đơn ngoài khoảng tuần không tính.
// Chạy qua run.mjs (npm run test:performance).
import { profitReport, HIGH_VALUE_ORDER_MIN } from '../../src/lib/inventory.js';
import { periodRange, shiftPeriod } from '../../src/lib/report.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const near = (a, b) => Math.abs(a - b) < 0.001;

const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const pho = (qty, price = 20) => [{ name: 'Phở Bò', qty, price }];
const order = (createdAt, extra = {}) => ({ createdAt, status: 'done', items: pho(1), ...extra });
// Đếm tay tiền đơn theo đúng định nghĩa orderTotal: món + phí ship − giảm giá.
const manualTotal = (o) =>
  (o.items ?? []).reduce((s, it) => s + it.price * it.qty, 0) + (o.shippingFee || 0) - (o.discount || 0);

const menu = [{ id: 'dish1', name: 'Phở Bò', price: 20 }];
const recipes = [{ id: 'dish1', lines: [{ ingredientId: 'ing1', qty: 0.5, unit: 'kg' }], extra: 0 }];
const ingredients = [{ id: 'ing1', name: 'Thịt bò', unit: 'kg' }];
const purchases = [{ ingredientId: 'ing1', qty: 10, total: 100, date: '2026-10-20' }]; // TB $10/kg
const expenses = [{ date: '2026-11-18', amount: 30, category: 'Điện nước' }]; // chi phí chung của tuần này

// "now" cố định: Thứ Tư 18/11/2026, 12:00 (giờ máy). Tuần hiện tại: Thứ Hai 16/11 – Thứ Hai 23/11.
const now = new Date(2026, 10, 18, 12, 0);
const orders = [
  // Tuần này (16/11 – 23/11)
  order(at(2026, 10, 16, 10), { source: 'web', items: pho(2) }), // web $40, giá vốn $10
  order(at(2026, 10, 18, 9), { source: 'web', items: pho(3) }), // web $60 → đơn cao giá, giá vốn $15
  order(at(2026, 10, 17, 12), { items: pho(1) }), // tại quán $20, giá vốn $5
  order(at(2026, 10, 19, 12), { items: pho(2), shippingFee: 10 }), // tại quán $40 + ship $10 = đúng $50 → đơn cao giá (ca biên), giá vốn $10
  order(at(2026, 10, 20, 12), { items: [{ name: 'Món Lẻ', qty: 1, price: 49.99 }] }), // tại quán $49,99 → KHÔNG phải đơn cao giá (ca biên), món không công thức nên giá vốn 0
  order(at(2026, 10, 21, 12), { source: 'web', status: 'cancelled', items: pho(1, 99) }), // đơn huỷ $99 → loại khỏi mọi chỉ số
  // Tuần trước (9/11 – 16/11)
  order(at(2026, 10, 10, 12), { source: 'web', items: pho(1) }), // web $20, giá vốn $5
  order(at(2026, 10, 15, 18), { items: pho(4) }), // tại quán $80 → đơn cao giá, giá vốn $20
  // 3 tuần trước (26/10 – 2/11)
  order(at(2026, 9, 27, 8), { items: pho(2) }), // tại quán $40, giá vốn $10
  // Ngoài khoảng 4 tuần đang xét
  order(at(2026, 9, 20, 8), { source: 'web', items: pho(1) }), // 4 tuần trước → không tính
  order(at(2026, 10, 25, 8), { source: 'web', items: pho(1) }), // tuần sau → không tính
];

// Kỳ vọng từng tuần (index 0 = tuần này): các trường cũ giữ nguyên cách tính như trước.
const expected = [
  { orders: 5, revenue: 219.99, cogs: 40, otherCosts: 30, profit: 149.99, high: 2, web: { orders: 2, revenue: 100, cogs: 25, profit: 75 }, shop: { orders: 3, revenue: 119.99, cogs: 15, profit: 104.99 } },
  { orders: 2, revenue: 100, cogs: 25, otherCosts: 0, profit: 75, high: 1, web: { orders: 1, revenue: 20, cogs: 5, profit: 15 }, shop: { orders: 1, revenue: 80, cogs: 20, profit: 60 } },
  { orders: 0, revenue: 0, cogs: 0, otherCosts: 0, profit: 0, high: 0, web: { orders: 0, revenue: 0, cogs: 0, profit: 0 }, shop: { orders: 0, revenue: 0, cogs: 0, profit: 0 } },
  { orders: 1, revenue: 40, cogs: 10, otherCosts: 0, profit: 30, high: 0, web: { orders: 0, revenue: 0, cogs: 0, profit: 0 }, shop: { orders: 1, revenue: 40, cogs: 10, profit: 30 } },
];

check(`ngưỡng đơn cao giá HIGH_VALUE_ORDER_MIN = $50`, HIGH_VALUE_ORDER_MIN === 50);

let prevStart = null;
for (let i = 0; i < 4; i += 1) {
  const range = periodRange('week', shiftPeriod('week', now, -i));
  check(
    `tuần -${i}: bắt đầu Thứ Hai 00:00, dài đúng 7 ngày`,
    range.start.getDay() === 1 &&
      range.start.getHours() === 0 &&
      range.start.getMinutes() === 0 &&
      range.end - range.start === 7 * 86400000,
  );
  if (prevStart) check(`tuần -${i}: nối tiếp tuần -${i - 1} không hở`, range.end.getTime() === prevStart.getTime());
  prevStart = range.start;

  const r = profitReport({ range, orders, menu, recipes, ingredients, purchases, expenses, batches: [] });
  const exp = expected[i];
  const web = r.channels.find((c) => c.key === 'web');
  const shop = r.channels.find((c) => c.key === 'shop');

  check(`tuần -${i}: trường cũ orders = ${exp.orders}`, r.orders === exp.orders);
  check(`tuần -${i}: trường cũ revenue ≈ $${exp.revenue}`, near(r.revenue, exp.revenue));
  check(`tuần -${i}: trường cũ cogs ≈ $${exp.cogs}`, near(r.cogs, exp.cogs));
  check(`tuần -${i}: trường cũ otherCosts ≈ $${exp.otherCosts}`, near(r.otherCosts, exp.otherCosts));
  check(`tuần -${i}: trường cũ profit ≈ $${exp.profit}`, near(r.profit, exp.profit));

  check(`tuần -${i}: kênh web đúng kỳ vọng (đơn/doanh thu/giá vốn/lãi gộp)`,
    web.orders === exp.web.orders && near(web.revenue, exp.web.revenue) && near(web.cogs, exp.web.cogs) && near(web.profit, exp.web.profit));
  check(`tuần -${i}: kênh tại quán đúng kỳ vọng (đơn/doanh thu/giá vốn/lãi gộp)`,
    shop.orders === exp.shop.orders && near(shop.revenue, exp.shop.revenue) && near(shop.cogs, exp.shop.cogs) && near(shop.profit, exp.shop.profit));
  check(`tuần -${i}: hai kênh cộng lại = tổng tuần (số đơn và doanh thu)`,
    web.orders + shop.orders === r.orders && near(web.revenue + shop.revenue, r.revenue));
  check(`tuần -${i}: lãi gộp hai kênh = doanh thu − giá vốn; trừ chi phí khác = lãi ròng`,
    near(web.profit + shop.profit, r.revenue - r.cogs) && near(web.profit + shop.profit - r.otherCosts, r.profit));

  // Tách tay theo `source` trên đúng tập đơn của tuần (chưa huỷ, tạo trong [start, end))
  const inWeek = orders.filter((o) => {
    const t = new Date(o.createdAt);
    return o.status !== 'cancelled' && t >= range.start && t < range.end;
  });
  const manualWeb = inWeek.filter((o) => o.source === 'web').reduce((s, o) => s + manualTotal(o), 0);
  const manualShop = inWeek.filter((o) => o.source !== 'web').reduce((s, o) => s + manualTotal(o), 0);
  check(`tuần -${i}: doanh thu theo kênh khớp tách tay theo source ($${manualWeb}/$${manualShop})`,
    near(web.revenue, manualWeb) && near(shop.revenue, manualShop));

  const manualHigh = inWeek.filter((o) => manualTotal(o) >= HIGH_VALUE_ORDER_MIN).length;
  check(`tuần -${i}: đơn cao giá = ${exp.high} (khớp đếm tay ${manualHigh})`,
    r.highValueOrders === exp.high && r.highValueOrders === manualHigh);
}

// Các ca biên của ngưỡng $50 nằm ở tuần này: đơn $60 (tính), đơn đúng $50 (tính),
// đơn $49,99 (không tính), đơn huỷ $99 (loại) → tổng đúng 2.
const thisWeek = profitReport({
  range: periodRange('week', now),
  orders,
  menu,
  recipes,
  ingredients,
  purchases,
  expenses,
  batches: [],
});
check(
  `ca biên ngưỡng $50: tuần này có đúng 2 đơn cao giá ($60 và $50; $49,99 và đơn huỷ $99 bị loại)`,
  thisWeek.highValueOrders === 2,
);
check(`đơn huỷ $99 không lọt vào doanh thu tuần này ($${thisWeek.revenue} = $219,99)`, near(thisWeek.revenue, 219.99));

console.log(failures ? `\nKẾT QUẢ: ${failures} khẳng định THẤT BẠI` : '\nKẾT QUẢ: TẤT CẢ TEST ĐỀU PASS');
process.exit(failures ? 1 : 0);
