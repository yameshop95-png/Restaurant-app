// Test đường số đơn và đường doanh thu của biểu đồ "Lợi nhuận theo tuần"
// (components/WeeklyProfitChart.jsx). Biểu đồ không tự đếm hay tự tính: nó lấy `orders` và
// `revenue` từ profitReport (lib/inventory) chạy trên đúng các mốc tuần
// periodRange('week', shiftPeriod('week', now, -i)) (lib/report) — tuần bắt đầu
// Thứ Hai 00:00, dài 7 ngày. Test này kiểm chứng trên dữ liệu giả:
//   1. Các mốc tuần đúng quy ước Thứ Hai 00:00 và nối tiếp nhau không hở.
//   2. profitReport đếm đúng quy tắc của nó: đơn CHƯA huỷ, tạo trong [start, end) của tuần —
//      khớp với đếm tay theo cùng quy tắc trên cùng mốc tuần (đơn đúng 00:00 Thứ Hai tính vào
//      tuần mới, đơn huỷ không tính, đơn ngoài khoảng tuần không tính).
//   3. `revenue` của profitReport = tổng tiền (món + phí ship − giảm giá) của đúng tập đơn
//      đó — khớp đếm tay và giá trị kỳ vọng, kể cả đơn giá khác nhau và đơn có phí ship;
//      đơn huỷ giá cao không lọt vào doanh thu.
// Nhờ vậy đường số đơn, đường doanh thu và cột lợi nhuận luôn cùng một tập đơn, so sánh
// được với nhau (tuần nhiều đơn mà doanh thu thấp = đơn nhỏ, và ngược lại).
// Chạy qua run.mjs (npm run test:weekly).
import { profitReport } from '../../src/lib/inventory.js';
import { periodRange, shiftPeriod } from '../../src/lib/report.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};

const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const order = (createdAt, status = 'done', price = 20, extra = {}) => ({
  createdAt,
  status,
  items: [{ name: 'Món giả', qty: 1, price }],
  ...extra,
});
// Đếm tay doanh thu theo đúng định nghĩa tiền đơn: món + phí ship − giảm giá.
const manualTotal = (o) =>
  (o.items ?? []).reduce((s, it) => s + it.price * it.qty, 0) + (o.shippingFee || 0) - (o.discount || 0);

// "now" cố định: Thứ Tư 18/11/2026, 12:00 (giờ máy). Tuần hiện tại: Thứ Hai 16/11 – Thứ Hai 23/11.
const now = new Date(2026, 10, 18, 12, 0);
const orders = [
  order(at(2026, 10, 16, 0, 0)), // đúng 00:00 Thứ Hai — biên dưới của tuần này ($20)
  order(at(2026, 10, 18, 10, 0), 'pending', 35), // giữa tuần này, đơn to hơn ($35)
  order(at(2026, 10, 22, 23, 59), 'shipped', 20, { shippingFee: 5 }), // tối Chủ nhật tuần này ($20 + $5 ship)
  order(at(2026, 10, 19, 9, 0), 'cancelled', 99), // tuần này nhưng đã huỷ → không tính (giá cao để bắt lỗi)
  order(at(2026, 10, 10, 12, 0)), // tuần trước ($20)
  order(at(2026, 10, 15, 18, 0)), // chiều Chủ nhật tuần trước ($20)
  order(at(2026, 9, 27, 8, 0)), // 3 tuần trước ($20)
  order(at(2026, 9, 20, 8, 0)), // trước khoảng 4 tuần → không tính
  order(at(2026, 10, 25, 8, 0)), // tuần sau → không tính
];
const expected = [3, 2, 0, 1]; // tuần này, -1, -2, -3
const expectedRevenue = [80, 40, 0, 20]; // 20+35+25 (có ship), 20+20, 0, 20

let prevStart = null;
let total = 0;
let totalRevenue = 0;
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

  const r = profitReport({ range, orders, menu: [], recipes: [], ingredients: [], purchases: [], expenses: [], batches: [] });
  const inWeek = orders.filter((o) => {
    const t = new Date(o.createdAt);
    return o.status !== 'cancelled' && t >= range.start && t < range.end;
  });
  const manual = inWeek.length;
  check(`tuần -${i}: profitReport đếm ${r.orders} đơn = đếm tay ${manual} = kỳ vọng ${expected[i]}`, r.orders === manual && r.orders === expected[i]);
  total += r.orders;

  const manualRevenue = inWeek.reduce((s, o) => s + manualTotal(o), 0);
  check(
    `tuần -${i}: doanh thu profitReport $${r.revenue} = đếm tay $${manualRevenue} = kỳ vọng $${expectedRevenue[i]}`,
    r.revenue === manualRevenue && r.revenue === expectedRevenue[i],
  );
  totalRevenue += r.revenue;
}
check(`tổng 4 tuần = 6 đơn (loại 1 đơn huỷ, 1 đơn trước khoảng, 1 đơn tuần sau)`, total === 6);
check(`tổng doanh thu 4 tuần = $140 (đơn huỷ $99 không lọt vào)`, totalRevenue === 140);

console.log(failures ? `\nKẾT QUẢ: ${failures} khẳng định THẤT BẠI` : '\nKẾT QUẢ: TẤT CẢ TEST ĐỀU PASS');
process.exit(failures ? 1 : 0);
