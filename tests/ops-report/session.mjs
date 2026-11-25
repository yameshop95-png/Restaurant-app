// Test PR #83 — lib/opsReport: Đơn theo vùng (F), Giao hàng (C), Công nợ (D),
// Xử lý đơn web (E). Kỳ chính: tháng 11/2026. Chạy qua run.mjs (npm run test:opsreport).
process.env.TZ = 'Australia/Melbourne';

import { debtReport, deliveryReport, effectiveWaitMs, fuelCostPerKmOf, regionReport, webReport } from '../../src/lib/opsReport.js';
import { planRouteByArea } from '../../src/lib/route.js';
import { storedGeoOf } from '../../src/lib/orderGeo.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const near = (a, b) => a != null && Math.abs(a - b) < 0.001;

const at = (m, d, h = 9, min = 0) => new Date(2026, m - 1, d, h, min).toISOString();
const NOV = { start: new Date(2026, 10, 1), end: new Date(2026, 11, 1) };
let seq = 0;
const mk = (extra = {}) => ({
  id: `o${++seq}`,
  status: 'shipped',
  type: 'delivery',
  paid: true,
  shippingFee: 0,
  discount: 0,
  customer: { name: 'Khách', phone: '', address: '' },
  items: [{ name: 'Giò Lụa', qty: 1, price: 10 }],
  createdAt: at(11, 2),
  deliverAt: at(11, 7),
  ...extra,
});

// ---------- Thẻ F: Đơn theo vùng ----------
const regionOrders = [
  mk({ customer: { name: 'A', phone: '', address: '12 Kiewa St, South Albury NSW 2640' }, items: [{ name: 'X', qty: 1, price: 40 }] }),
  mk({ customer: { name: 'B', phone: '', address: 'Somewhere' }, geo: { lat: -36.12, lng: 146.88, zone: 'Wodonga 3690', for: 'Somewhere' }, items: [{ name: 'X', qty: 1, price: 30 }] }),
  mk({ customer: { name: 'C', phone: '', address: 'Nowhere Rd' }, items: [{ name: 'X', qty: 1, price: 20 }] }),
  mk({ customer: { name: 'D', phone: '', address: '1 Main St, Wodonga VIC 3690' }, items: [{ name: 'X', qty: 1, price: 50 }] }),
  mk({ type: 'pickup', items: [{ name: 'X', qty: 1, price: 99 }] }),
  mk({ status: 'cancelled', customer: { name: 'E', phone: '', address: 'Wodonga VIC 3690' } }),
];
const rr = regionReport(regionOrders, NOV);
const byName = Object.fromEntries(rr.rows.map((r) => [r.name, r]));
check('Vùng: "South Albury" thắng "Albury" (tên dài khớp trước)', byName['South Albury']?.orders === 1 && byName['South Albury']?.revenue === 40);
check('Vùng: không có tên khu trong địa chỉ → dùng geo.zone bỏ postcode (Wodonga)', byName['Wodonga']?.orders === 2 && byName['Wodonga']?.revenue === 80);
check('Vùng: không địa chỉ, không geo → Chưa rõ vùng, xếp cuối', rr.rows[rr.rows.length - 1].name === 'Chưa rõ vùng' && byName['Chưa rõ vùng']?.orders === 1);
check('Vùng: tổng các hàng = tổng đơn giao (4), đến lấy tách riêng (1)',
  rr.rows.reduce((s, r) => s + r.orders, 0) === rr.deliveryOrders && rr.deliveryOrders === 4 && rr.pickupOrders === 1);
check('Vùng: tỉ lệ chưa rõ 25% > 20% → cảnh báo bật', rr.warn === true && rr.withZone === 3);
// B2 (issue #89): tên đường trùng tên khu — khu thật nằm sau dấu phẩy cuối
const rrB2 = regionReport([
  mk({ customer: { name: 'P', phone: '', address: '3 Wodonga Pl, Albury NSW 2640' } }),
  mk({ customer: { name: 'Q', phone: '', address: '8 Albury St, Wodonga VIC 3690' } }),
], NOV);
const b2Names = Object.fromEntries(rrB2.rows.map((r) => [r.name, r.orders]));
check('B2: "3 Wodonga Pl, Albury" → Albury (không phải Wodonga)', b2Names['Albury'] === 1 && !b2Names['Wodonga Pl']);
check('B2: "8 Albury St, Wodonga" → Wodonga (không phải Albury)', b2Names['Wodonga'] === 1 && b2Names['Albury'] === 1);
const rr2 = regionReport([...regionOrders, mk({ customer: { name: 'F', phone: '', address: 'Wodonga VIC 3690' } }), mk({ customer: { name: 'G', phone: '', address: 'Albury NSW 2640' } })], NOV);
check('Vùng: tỉ lệ chưa rõ 1/6 ≈ 16,7% → không cảnh báo', rr2.warn === false);

// ---------- Thẻ C: Giao hàng ----------
const SHOP = { lat: -36.121, lng: 146.878 };
const geoOf = (o, lat, lng) => ({ ...o, geo: { lat, lng, zone: 'Wodonga VIC 3690', for: o.customer.address } });
const delOrders = [
  geoOf(mk({ customer: { name: 'A', phone: '', address: 'Wodonga VIC 3690' }, deliverAt: at(11, 14, 9), shippedAt: at(11, 14, 9, 20), shippingFee: 2 }), -36.1215, 146.885),
  geoOf(mk({ customer: { name: 'B', phone: '', address: 'Albury NSW 2640' }, deliverAt: at(11, 14, 10), shippedAt: at(11, 14, 10, 31), shippingFee: 5 }), -36.13, 146.9),
  geoOf(mk({ customer: { name: 'C', phone: '', address: 'Wodonga VIC 3690' }, deliverAt: at(11, 14, 11), shippedAt: at(11, 14, 11, 30), shippingFee: 2 }), -36.115, 146.87),
  mk({ customer: { name: 'D', phone: '', address: 'Lavington NSW 2640' }, deliverAt: at(11, 21, 9), status: 'failed', shippingFee: 7 }),
];
const geoMap = new Map(delOrders.map((o) => [o.id, storedGeoOf(o)]).filter(([, g]) => g));
const dr = deliveryReport(delOrders, NOV, { geo: geoMap, start: SHOP, homeSide: 'vic', costPerKm: 0.5, now: new Date(2026, 10, 14, 7) });
check('Giao hàng: 2 đợt trong kỳ', dr.runs === 2);
check('Giao hàng: có km > 0 và thời gian ước tính > 0', dr.km > 0 && dr.minutes > 0 && dr.stops >= 3);
check('Giao hàng: đúng giờ 2/3 (biên +30 phút vẫn đúng giờ, +31 phút là trễ)', dr.onTime.n === 3 && near(dr.onTime.rate, 2 / 3) && dr.onTime.late === 1);
check('Giao hàng: đơn đang failed = 1', dr.failedNow === 1);
check('Giao hàng: phí ship đã thu = 16', dr.shippingCollected === 16);
check('Giao hàng: chi phí xăng = km × 0,5', near(dr.fuelCost, dr.km * 0.5));
// A3 (issue #89): km theo vùng đọc từ slot.stops/distanceKm — không còn $0
check('A3: vùng của 2 đơn có toạ độ có km > 0 và tiền dầu > 0 (đơn Lavington không toạ độ thì km = 0)',
  dr.byZone.filter((z) => z.shipping === 4 || z.shipping === 5).every((z) => z.km > 0 && z.fuel > 0) &&
  dr.byZone.find((z) => z.shipping === 7).km === 0);
check('A3: tổng km các vùng = km của thẻ', near(dr.byZone.reduce((sum, z) => sum + z.km, 0), dr.km));
// A4 (issue #89): km thẻ = km chim bay của planRouteByArea × 1,4
const plan14 = planRouteByArea(delOrders.filter((o) => o.deliverAt === at(11, 14, 9) || o.deliverAt === at(11, 14, 10) || o.deliverAt === at(11, 14, 11)), geoMap, SHOP, new Date(2026, 10, 14, 7), { homeSide: 'vic' });
check('A4: km thẻ = tổng km chim bay × 1,4', near(dr.km, plan14.totalKm * 1.4));
// B5 (issue #89): độ phủ toạ độ 3/4 = 75% < 80% → báo thiếu
check('B5: độ phủ toạ độ 3/4, dưới 80% → low = true', dr.geoCoverage.withGeo === 3 && dr.geoCoverage.total === 4 && dr.geoCoverage.low === true);
// A7 (issue #89): giá dầu/km từ cài đặt xe diesel
check('A7: mặc định 6,9 L/100 km × $2,50 = $0,1725/km', near(fuelCostPerKmOf({}), 0.1725));
check('A7: có fuelCostPerKm cũ mà chưa có trường mới → dùng giá trị cũ', near(fuelCostPerKmOf({ fuelCostPerKm: 0.3 }), 0.3));
check('A7: đã sửa 1 ô mới → dùng công thức mới (6,9 × $2,00)', near(fuelCostPerKmOf({ fuelCostPerKm: 0.3, fuelPricePerLitre: 2.0 }), 0.138));
const drDefault = deliveryReport(delOrders, NOV, { geo: geoMap, start: SHOP, homeSide: 'vic', now: new Date(2026, 10, 14, 7) });
check('A7: 100 km đường thật ở giá mặc định → $17,25 (tỉ lệ trên km thật của thẻ)', near(drDefault.fuelCost, drDefault.km * 0.1725));
check('Giao hàng: tách theo vùng phí có đủ 3 mức 4 / 5 / 7',
  JSON.stringify(dr.byZone.map((z) => z.shipping).sort((a, b) => a - b)) === JSON.stringify([4, 5, 7]));

// ---------- Thẻ D: Công nợ ----------
const NOW = new Date(2026, 10, 26, 12);
const debtOrders = [
  mk({ id: 'debt-a1', paid: false, deliverAt: at(11, 10), createdAt: at(11, 8), customer: { name: 'Khách A', phone: '0400 111 222', address: '' }, items: [{ name: 'X', qty: 1, price: 30 }] }),
  mk({ id: 'debt-a2', paid: false, deliverAt: at(11, 12), createdAt: at(11, 10), customer: { name: 'Khách A', phone: '0400111222', address: '' }, items: [{ name: 'X', qty: 1, price: 20 }] }),
  mk({ id: 'debt-b1', paid: false, deliverAt: at(11, 1), createdAt: at(10, 30), customer: { name: 'Chị Ba', phone: '', address: '' }, items: [{ name: 'X', qty: 1, price: 45 }] }),
  mk({ id: 'debt-new', paid: false, deliverAt: at(11, 24), createdAt: at(11, 23), customer: { name: 'Khách Mới', phone: '0400999888', address: '' } }),
  mk({ id: 'debt-paid', paid: true, deliverAt: at(11, 1), createdAt: at(10, 30), customer: { name: 'Khách A', phone: '0400111222', address: '' } }),
  mk({ id: 'debt-cancel', paid: false, status: 'cancelled', deliverAt: at(11, 1), createdAt: at(10, 30), customer: { name: 'Khách A', phone: '0400111222', address: '' } }),
];
const debt = debtReport(debtOrders, NOW);
check('Công nợ: 2 nhóm nợ, tổng 95', debt.groups.length === 2 && debt.totalDebt === 95);
check('Công nợ: SĐT có/không khoảng trắng gộp một khách (50 · 2 đơn · cũ nhất 16 ngày)',
  debt.groups[0].total === 50 && debt.groups[0].count === 2 && debt.groups[0].ageDays === 16);
check('Công nợ: nút "Đã thu" sẽ đánh dấu đúng 2 đơn của khách A',
  JSON.stringify([...debt.groups[0].orderIds].sort()) === JSON.stringify(['debt-a1', 'debt-a2']));
check('Công nợ: đơn mới 2 ngày / đã thu / đã huỷ đều không vào', debt.groups.every((g) => g.name !== 'Khách Mới'));

// ---------- Thẻ E: Xử lý đơn web ----------
const webOrders = [
  mk({ source: 'web', createdAt: at(11, 4, 9, 0), confirmedAt: at(11, 4, 9, 30), deliverAt: at(11, 7), number: 101 }),
  mk({ source: 'web', createdAt: at(11, 4, 9, 0), confirmedAt: at(11, 4, 12, 0), deliverAt: at(11, 7), number: 102 }),
  mk({ source: 'web', createdAt: at(11, 5, 9, 0), confirmedAt: at(11, 5, 10, 0), deliverAt: at(11, 7), number: 103 }),
  mk({ source: 'web', createdAt: at(11, 5, 9, 0), deliverAt: at(11, 7), number: 104 }),
  mk({ createdAt: at(11, 5, 9, 0), deliverAt: at(11, 7), number: 105 }),
];
const wr = webReport(webOrders, NOV);
check('Web: 4 đơn web / 1 đơn tay', wr.web === 4 && wr.manual === 1);
check('Web: TB xác nhận 1,5 giờ · trung vị 1 giờ · n = 3', near(wr.meanMs, 1.5 * 3600000) && near(wr.medianMs, 3600000) && wr.n === 3);
check('Web: đơn thiếu confirmedAt bị bỏ qua và đếm riêng (1)', wr.skipped === 1);
check('Web: 1 đơn xác nhận chậm > 2 giờ, ghi số đơn 102', wr.slow.length === 1 && wr.slow[0].number === 102 && near(wr.slow[0].hours, 3));

// B6 (issue #89): đặt 23:00, xác nhận 07:20 → chờ hiệu dụng 20 phút
check('B6: effectiveWaitMs trừ giờ đêm 22:00–07:00', effectiveWaitMs(at(11, 5, 23, 0), at(11, 6, 7, 20)) === 20 * 60000);
const wrNight = webReport([mk({ source: 'web', createdAt: at(11, 5, 23, 0), confirmedAt: at(11, 6, 7, 20), deliverAt: at(11, 7), number: 106 })], NOV);
check('B6: đơn qua đêm không bị tính là chậm > 2 giờ', wrNight.meanMs === 20 * 60000 && wrNight.slow.length === 0);

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
