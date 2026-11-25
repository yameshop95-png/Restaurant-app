// Test PR #82 — lib/currentRun + weeklyRevenue.
// "now" chính: Thứ Năm 26/11/2026 20:00, đợt giao thứ Bảy 28/11/2026.
// Chạy qua run.mjs (npm run test:currentrun) với TZ=Australia/Melbourne.
process.env.TZ = 'Australia/Melbourne';

import { currentRun, runSaturdayOf, weeklyRevenue } from '../../src/lib/currentRun.js';
import { isCookingOrder, isInboxOrder } from '../../src/lib/batches.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const near = (a, b) => a != null && Math.abs(a - b) < 0.001;

// at(month, day, hour, min) — năm 2026, giờ Melbourne
const at = (m, d, h = 9, min = 0) => new Date(2026, m - 1, d, h, min).toISOString();
const WOD = '114 High St, Wodonga VIC 3690';
const ALB = '500 Dean St, Albury NSW 2640';
const LAV = '12 Wagga Rd, Lavington NSW 2640';
let seq = 0;
const mk = (createdAt, deliverAt, extra = {}) => ({
  id: `o${++seq}`,
  status: 'shipped',
  type: 'pickup',
  paid: false,
  shippingFee: 0,
  discount: 0,
  customer: { name: 'Khách', phone: '', address: '' },
  items: [{ name: 'Giò Lụa', qty: 1, price: 10 }],
  createdAt,
  deliverAt,
  ...extra,
});

// --- Đợt hiện tại: 10 đơn (c1..c9 + c11), 1 huỷ, 1 đợt sau ---
const cur = [
  mk(at(11, 23), at(11, 28), { status: 'pending', source: 'web', type: 'delivery', customer: { name: 'A', phone: '', address: WOD }, items: [{ name: 'Giò Lụa', qty: 2, price: 13 }] }), // c1 inbox
  mk(at(11, 24), at(11, 28), { status: 'pending', source: 'web', confirmedAt: at(11, 24, 10), paid: true, type: 'delivery', customer: { name: 'B', phone: '', address: ALB }, items: [{ name: 'giò lụa 500g', qty: 3, price: 13 }] }), // c2 cooking
  mk(at(11, 25), at(11, 28), { status: 'pending', items: [{ name: 'Bánh cuốn', qty: 1, price: 16 }] }), // c3 cooking (tại quán)
  mk(at(11, 26, 8), at(11, 28), { status: 'done', type: 'delivery', customer: { name: 'D', phone: '', address: WOD }, items: [{ name: 'Bánh cuốn', qty: 2, price: 16 }] }), // c4 done
  mk(at(11, 26, 9), at(11, 28), { status: 'done', paid: true, items: [{ name: 'Chả Bì', qty: 1, price: 13 }] }), // c5 đến lấy done+paid → Đã giao
  mk(at(11, 25, 12), at(11, 28), { status: 'done', items: [{ name: 'Chả Bì', qty: 1, price: 13 }] }), // c6 done
  mk(at(11, 26, 10), at(11, 28), { status: 'delivering', type: 'delivery', items: [{ name: 'Giò Lụa', qty: 1, price: 13 }] }), // c7 địa chỉ trống → chưa rõ vùng
  mk(at(11, 24, 15), at(11, 28), { status: 'shipped', paid: true, type: 'delivery', customer: { name: 'H', phone: '', address: LAV }, items: [{ name: 'Bánh cuốn', qty: 1, price: 16 }] }), // c8
  mk(at(11, 26, 11), at(11, 28), { status: 'failed', type: 'delivery', customer: { name: 'I', phone: '', address: WOD }, items: [{ name: 'Chả Bì', qty: 2, price: 13 }] }), // c9
  mk(at(11, 26, 12), at(11, 28), { status: 'cancelled', type: 'delivery', customer: { name: 'X', phone: '', address: WOD } }), // c10 huỷ — loại
  mk(at(11, 20), at(11, 28), { status: 'pending', items: [{ name: 'Giò Lụa', qty: 1, price: 13 }] }), // c11 tạo tuần trước, giao đợt này
  mk(at(11, 25), at(12, 5), { status: 'pending' }), // c12 đợt sau — không tính
];

// --- 4 đợt trước: số đơn đã nhận tới cùng thời điểm (T5 20:00) = 12, 10, 11, 13 ---
const prev = [];
const prevRun = (satM, satD, byCutoff, after, createdSpec) => {
  for (let i = 0; i < byCutoff + after; i++) {
    const [cm, cd, ch] = createdSpec(i < byCutoff ? 'by' : 'after');
    prev.push(mk(at(cm, cd, ch), at(satM, satD), {}));
  }
};
prevRun(11, 21, 12, 3, (w) => (w === 'by' ? [11, 18, 10] : [11, 20, 10])); // 12 tạo T4 18/11, 3 tạo T6 20/11
prevRun(11, 14, 10, 2, (w) => (w === 'by' ? [11, 10, 10] : [11, 13, 10])); // 10 tạo T3 10/11
prevRun(11, 7, 11, 0, () => [11, 2, 10]); // 11 tạo T2 2/11
prevRun(10, 31, 13, 0, () => [10, 28, 10]); // 13 tạo T4 28/10

const orders = [...cur, ...prev];
const now = new Date(2026, 10, 26, 20, 0);
const forecast = {
  ready: true,
  items: [
    { key: 'gio lua', name: 'Giò Lụa', expected: 10 },
    { key: 'banh cuon', name: 'Bánh cuốn', expected: 3 },
    { key: 'banh gio', name: 'Bánh Giò', expected: 5 },
  ],
};
const r = currentRun(orders, now, { forecast, homeSide: 'vic' });

check('Đợt là thứ Bảy 28/11', r.saturday.getDate() === 28 && r.saturday.getMonth() === 10);
check('received = 10 (loại huỷ + đợt sau)', r.received === 10);
check('pace: TB 4 đợt trước = 11,5', r.pace && near(r.pace.avg, 11.5));
check('pace: chênh −1,5 đơn (< 3) → ẩn %', r.pace && r.pace.pct === null);
check('cumulative: nhãn T2..T5', r.cumulative.map((c) => c.label).join(',') === 'T2,T3,T4,T5');
check('cumulative: T5 đợt này = 10', r.cumulative[3].current === 10);
check('cumulative: T5 TB 4 đợt = 11,5', near(r.cumulative[3].avg, 11.5));
const runOnly = cur.filter((o) => o.status !== 'cancelled' && o.deliverAt === at(11, 28));
check('progress khớp isInboxOrder/isCookingOrder trên đúng đơn của đợt',
  r.progress.inbox === runOnly.filter(isInboxOrder).length && r.progress.cooking === runOnly.filter(isCookingOrder).length);
check('progress: 1 / 3 / 2 / 1 / 2 / 1',
  r.progress.inbox === 1 && r.progress.cooking === 3 && r.progress.done === 2 &&
  r.progress.delivering === 1 && r.progress.shipped === 2 && r.progress.failed === 1);
// Công thức phân hoạch: mỗi đơn chưa huỷ của đợt nằm đúng 1 ô → tổng 6 ô = received.
// Đơn đến lấy done + đã thu tiền tính vào "Đã giao"; done chưa thu vẫn ở "Nấu xong".
check('progress: tổng 6 ô = received',
  Object.values(r.progress).reduce((a, b) => a + b, 0) === r.received);
check('money: dự kiến 207 · đã thu 68 · còn 139',
  r.money.expected === 207 && r.money.collected === 68 && r.money.outstanding === 139);
check('mix: đến lấy 4 · giao 6 (Wodonga 3 · Albury–Lavington 2 · chưa rõ 1)',
  r.mix.pickup === 4 && r.mix.delivery === 6 && r.mix.wodonga === 3 && r.mix.albury === 2 && r.mix.unknown === 1);

const rows = Object.fromEntries(r.dishRows.map((d) => [d.key, d]));
check('Thẻ B: Giò Lụa gộp cả "giò lụa 500g" = 7, dự báo 10, còn 3',
  rows['gio lua'].ordered === 7 && rows['gio lua'].forecast === 10 && rows['gio lua'].remaining === 3);
check('Thẻ B: Bánh cuốn đặt 4 > dự báo 3 → còn dự kiến 0 (không âm)',
  rows['banh cuon'].ordered === 4 && rows['banh cuon'].remaining === 0);
check('Thẻ B: Chả Bì có đơn nhưng chưa có dự báo → forecast null, xếp cuối',
  rows['cha bi'].forecast === null && r.dishRows[r.dishRows.length - 1].key === 'cha bi');
check('Thẻ B: sắp theo dự báo giảm dần', r.dishRows[0].key === 'gio lua' && r.dishRows[1].key === 'banh gio');

// Kịch bản 2: thêm 5 đơn → received 15, chênh +3,5 → hiện %
const extra = Array.from({ length: 5 }, () => mk(at(11, 26, 15), at(11, 28), { status: 'pending' }));
const r2 = currentRun([...orders, ...extra], now, { forecast, homeSide: 'vic' });
check('pace kịch bản 2: received 15 → % hiện ≈ +30,4%', r2.pace && near(r2.pace.pct, 3.5 / 11.5));

// Ít hơn 2 đợt trước → không so sánh
const r3 = currentRun(cur, now, { forecast, homeSide: 'vic' });
check('Không có đợt trước nào → pace null', r3.pace === null);

// Quy tắc Chủ nhật: 29/11 là Chủ nhật → đợt là thứ Bảy 5/12
const sun = new Date(2026, 10, 29, 10, 0);
check('Chủ nhật 29/11 → đợt thứ Bảy 5/12', runSaturdayOf(sun).getDate() === 5 && runSaturdayOf(sun).getMonth() === 11);
const rSun = currentRun(orders, sun, { forecast: null, homeSide: 'vic' });
check('Sáng Chủ nhật: đợt mới chỉ có đơn giao 5/12 (1 đơn)', rSun.received === 1);

// weeklyRevenue: 8 cột kết thúc ở thứ Bảy 28/11 (thứ Bảy cuối của tháng 11)
const wr = weeklyRevenue(orders, new Date(2026, 10, 26), now);
check('weeklyRevenue: 8 cột, cột cuối 28/11', wr.length === 8 && wr[7].label === '28/11');
check('weeklyRevenue: cột 28/11 doanh thu 207 · 10 đơn · là đợt hiện tại',
  wr[7].revenue === 207 && wr[7].orders === 10 && wr[7].isCurrent === true);
check('weeklyRevenue: cột 21/11 doanh thu 150 · 15 đơn', wr[6].revenue === 150 && wr[6].orders === 15);

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
