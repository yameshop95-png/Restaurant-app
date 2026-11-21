// Test hai sửa lỗi nghiêm trọng từ mô phỏng 100 đơn (2026-11-21):
//  1) Chia đoạn link lộ trình (routeSegments trong lib/geo.js) — link đầy đủ không
//     còn bị cắt ở 10 điểm; tin nhắn gửi shipper (routeText) có đủ link cho mọi điểm.
//  2) Tiến độ chuyến chỉ đếm đơn giao xong HÔM NAY (isShippedToday trong
//     lib/orderStatus.js, dựa vào mốc shippedAt) — lịch sử không làm sai số liệu.
// Chạy qua run.mjs (npm run test:routelinks).
import { directionsUrl, routeSegments, MAX_ROUTE_STOPS } from '../../src/lib/geo.js';
import { isShippedToday, needsCustomerMessage } from '../../src/lib/orderStatus.js';
import { planRoute } from '../../src/lib/route.js';
import { routeText } from '../../src/lib/shareOrder.js';
import { orderTotal } from '../../src/lib/stats.js';

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}`);
  }
}

// Ngày/giờ theo giờ máy rồi mới đổi sang ISO, để test ổn định ở mọi múi giờ
const at = (y, m, d, h = 0, min = 0) => new Date(y, m, d, h, min).toISOString();
const START = { lat: -36.121, lng: 146.888 }; // điểm xuất phát (quán)
const pt = (i) => ({ lat: -36.1 - i * 0.01, lng: 146.9 + i * 0.01 });
const fmt = (p) => `${p.lat},${p.lng}`;
const pts = (n) => Array.from({ length: n }, (_, i) => pt(i));

// Thứ tự điểm mà một link chỉ đường sẽ đi qua: origin → waypoints → destination
function visitOrder(url, app) {
  const sp = new URL(url).searchParams;
  if (app === 'apple') {
    return [sp.get('source'), ...sp.getAll('waypoint'), sp.get('destination')].filter(Boolean);
  }
  return [sp.get('origin'), ...(sp.get('waypoints')?.split('|') ?? []), sp.get('destination')].filter(Boolean);
}

// Ghép thứ tự đi qua của mọi đoạn: đoạn sau bắt đầu tại điểm cuối đoạn trước
// (điểm nối) nên khi ghép bỏ điểm đầu trùng của các đoạn sau.
function mergedVisit(segments, app) {
  const out = [];
  segments.forEach((seg, i) => {
    const visit = visitOrder(directionsUrl(seg.origin, seg.points, app), app);
    out.push(...(i === 0 ? visit : visit.slice(1)));
  });
  return out;
}

// 1) routeSegments: số đoạn và kích thước theo trần MAX_ROUTE_STOPS = 10
{
  check('MAX_ROUTE_STOPS = 10', MAX_ROUTE_STOPS === 10);
  check('0 điểm → 0 đoạn', routeSegments(START, []).length === 0);
  check('5 điểm → 1 đoạn', routeSegments(START, pts(5)).length === 1);
  check('10 điểm → 1 đoạn', routeSegments(START, pts(10)).length === 1);
  check('11 điểm → 2 đoạn', routeSegments(START, pts(11)).length === 2);
  const s16 = routeSegments(START, pts(16));
  check('16 điểm → 2 đoạn (10 + 6)', s16.length === 2 && s16[0].points.length === 10 && s16[1].points.length === 6);
  const s21 = routeSegments(START, pts(21));
  check('21 điểm → 3 đoạn (10 + 10 + 1)', s21.length === 3 && s21[2].points.length === 1);
  const sCustom = routeSegments(START, pts(7), 3);
  check('trần tuỳ chọn 3: 7 điểm → 3 đoạn (3 + 3 + 1)', sCustom.length === 3 && sCustom[1].points.length === 3);
}

// 2) routeSegments: điểm nối và bao phủ — hợp các đoạn = đúng danh sách gốc, theo thứ tự
{
  const points = pts(16);
  const segs = routeSegments(START, points);
  check('đoạn 1 bắt đầu từ điểm xuất phát', segs[0].origin === START);
  check('đoạn 2 bắt đầu tại điểm cuối đoạn 1 (điểm nối)', segs[1].origin === points[9]);
  const union = segs.flatMap((s) => s.points);
  check('hợp các đoạn đủ 16 điểm, không thừa thiếu', union.length === 16);
  check('hợp các đoạn giữ nguyên thứ tự gốc', union.every((p, i) => p === points[i]));
  const one = routeSegments(START, pts(10));
  check('1 đoạn thì link y như directionsUrl cũ', directionsUrl(one[0].origin, one[0].points, 'google') === directionsUrl(START, points.slice(0, 10), 'google'));
}

// 3) Link từng đoạn (cả Google lẫn Apple): đi qua đủ 16 điểm theo đúng thứ tự
for (const app of ['google', 'apple']) {
  const points = pts(16);
  const segs = routeSegments(START, points);
  const visit = mergedVisit(segs, app);
  const expect = [fmt(START), ...points.map(fmt)];
  check(`${app}: link các đoạn đi qua đủ 16 điểm + điểm xuất phát`, visit.length === expect.length);
  check(`${app}: thứ tự đi qua khớp thứ tự lộ trình`, visit.every((v, i) => v === expect[i]));
}

// 4) routeText: chuyến 16 điểm có 2 link đoạn phủ đủ điểm; chuyến ngắn giữ 1 link như cũ
{
  const mkStop = (i) => ({
    order: {
      number: 100 + i,
      type: 'delivery',
      status: 'delivering',
      deliverAt: at(2026, 10, 21, 8, 0),
      paid: false,
      items: [{ name: 'Bánh cuốn 1kg', price: 16, qty: 1 }],
      shippingFee: 0,
      discount: 0,
      customer: { name: `Khách ${i}`, phone: '0400000000', address: `${i} High Street, Wodonga` },
    },
    geo: pt(i),
    index: i + 1,
  });
  const plan16 = { slots: [{ label: '08:00 – 08:30', stops: Array.from({ length: 16 }, (_, i) => mkStop(i)) }] };
  const text16 = routeText(plan16, START, 'Quán', 'google');
  check('routeText 16 điểm: có link đoạn 1 (điểm 1–10)', text16.includes('Chỉ đường đoạn 1 (điểm 1–10):'));
  check('routeText 16 điểm: có link đoạn 2 (điểm 10–16)', text16.includes('Chỉ đường đoạn 2 (điểm 10–16):'));
  const urls = [...text16.matchAll(/https:\/\/\S+/g)].map((m) => m[0]);
  const visit = [];
  urls.forEach((u, i) => {
    const v = visitOrder(u, 'google');
    visit.push(...(i === 0 ? v : v.slice(1)));
  });
  check('routeText 16 điểm: các link phủ đủ 16 điểm theo thứ tự', visit.length === 17 && visit.every((v, i) => v === [fmt(START), ...pts(16).map(fmt)][i]));

  const plan8 = { slots: [{ label: '08:00 – 08:30', stops: Array.from({ length: 8 }, (_, i) => mkStop(i)) }] };
  const text8 = routeText(plan8, START, 'Quán', 'apple');
  check('routeText 8 điểm: vẫn một dòng "Chỉ đường:" như cũ', text8.includes('Chỉ đường: https://maps.apple.com/'));
  check('routeText 8 điểm: không có chữ "đoạn"', !text8.includes('đoạn'));
}

// 5) isShippedToday: biên ngày theo mốc shippedAt (now = Thứ Bảy 21/11/2026, 12:00)
{
  const now = new Date(2026, 10, 21, 12, 0);
  const shipped = (shippedAt) => ({ status: 'shipped', shippedAt });
  check('giao xong 00:00 hôm nay → tính', isShippedToday(shipped(at(2026, 10, 21, 0, 0)), now));
  check('giao xong 23:59 hôm nay → tính', isShippedToday(shipped(at(2026, 10, 21, 23, 59)), now));
  check('giao xong 23:59 hôm qua → không tính', !isShippedToday(shipped(at(2026, 10, 20, 23, 59)), now));
  check('giao xong ngày mai → không tính', !isShippedToday(shipped(at(2026, 10, 22, 0, 1)), now));
  check('đơn ship cũ không có shippedAt → không tính (lịch sử)', !isShippedToday({ status: 'shipped' }, now));
  check('chưa ship dù có shippedAt hôm nay → không tính', !isShippedToday({ status: 'delivering', shippedAt: at(2026, 10, 21, 9) }, now));
}

// 6) Kịch bản đối soát như mô phỏng: 12 đơn lịch sử tuần trước + Đợt 1 giao hôm nay
{
  const now = new Date(2026, 10, 21, 12, 0);
  const history = Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`,
    type: 'delivery',
    status: 'shipped', // ship từ tuần trước, dữ liệu cũ không có shippedAt
    deliverAt: at(2026, 10, 14, 8, 0),
    paid: i % 2 === 0,
    items: [{ name: 'Bánh cuốn 1kg', price: 16, qty: 1 }],
    shippingFee: 0,
    discount: 0,
  }));
  const runSet = (list) => list.filter((o) => o.type === 'delivery' && isShippedToday(o, now));
  check('lúc xuất phát: tiến độ 0 (không dính 12 đơn lịch sử)', runSet(history).length === 0);

  // Đợt 1: 15 đơn giao xong hôm nay — 5 đơn đã thu (mỗi đơn $20), 10 đơn chưa thu (mỗi đơn $20)
  const batch = Array.from({ length: 15 }, (_, i) => ({
    id: `b${i}`,
    type: 'delivery',
    status: 'shipped',
    shippedAt: at(2026, 10, 21, 8, i),
    deliverAt: at(2026, 10, 21, 8, 0),
    paid: i < 5,
    items: [{ name: 'Xôi khúc', price: 10, qty: 2 }],
    shippingFee: 0,
    discount: 0,
  }));
  const stale = { id: 'stale', type: 'delivery', status: 'delivering', deliverAt: at(2026, 10, 20, 10, 0) };
  const all = [...history, ...batch, stale];
  const done = runSet(all);
  check('sau Đợt 1: tiến độ đúng 15 đơn của hôm nay', done.length === 15);
  const paidSum = done.filter((o) => o.paid).reduce((s, o) => s + orderTotal(o), 0);
  const unpaidSum = done.filter((o) => !o.paid).reduce((s, o) => s + orderTotal(o), 0);
  check('sau Đợt 1: Đã thu đúng $100 (5 × $20)', paidSum === 100);
  check('sau Đợt 1: Chưa thu đúng $200 (10 × $20)', unpaidSum === 200);
  check('đơn tồn đang giao không lọt vào nhóm đã giao', !done.some((o) => o.id === 'stale'));
}

// 6) needsCustomerMessage: chip "Chưa nhắn khách" — đơn web đã xác nhận mà chưa
//    máy nào nhắn tin xác nhận (tách xác nhận khỏi nhắn tin cho PC không có SMS)
{
  const base = { source: 'web', status: 'pending', confirmedAt: '2026-11-21T01:00:00.000Z' };
  check('chip: web + chờ + đã xác nhận + chưa nhắn → hiện', needsCustomerMessage(base) === true);
  check('chip: đã nhắn (có messagedAt) → ẩn', needsCustomerMessage({ ...base, messagedAt: '2026-11-21T01:05:00.000Z' }) === false);
  check('chip: chưa xác nhận → ẩn', needsCustomerMessage({ source: 'web', status: 'pending' }) === false);
  check('chip: đơn nhân viên nhập → ẩn', needsCustomerMessage({ status: 'pending', confirmedAt: base.confirmedAt }) === false);
  check('chip: đơn đã xong (done) → ẩn', needsCustomerMessage({ ...base, status: 'done' }) === false);
  check('chip: đơn đã huỷ → ẩn', needsCustomerMessage({ ...base, status: 'cancelled' }) === false);
}

// 7) planRoute: đơn hẹn NGÀY MAI vẫn nằm trong lộ trình (lộ trình hiện mọi đơn
//    đang giao), khung giờ ghi thêm ngày; đơn hôm nay giữ nhãn thường; đơn quá
//    giờ vào khung "Đã trễ giờ" xếp đầu
{
  const now = new Date(2026, 10, 21, 12, 0); // Thứ Bảy 21/11/2026, 12:00 giờ máy
  const iso = (d, h, m = 0) => new Date(2026, 10, d, h, m).toISOString();
  const orders = [
    { id: 'today', deliverAt: iso(21, 13) },
    { id: 'tmr', deliverAt: iso(22, 8) },
    { id: 'late', deliverAt: iso(20, 8) },
  ];
  const geo = new Map([
    ['today', { lat: -36.12, lng: 146.88, zone: 'Wodonga' }],
    ['tmr', { lat: -36.08, lng: 146.91, zone: 'Albury' }],
    ['late', null],
  ]);
  const plan = planRoute(orders, geo, null, now, 30);
  const allStops = plan.slots.flatMap((s) => s.stops);
  const labelOf = (id) => plan.slots.find((s) => s.stops.some((x) => x.order.id === id))?.label;
  check('lộ trình: đủ 3 đơn (hôm nay + ngày mai + trễ)', allStops.length === 3);
  check('lộ trình: đơn ngày mai có mặt', allStops.some((s) => s.order.id === 'tmr'));
  check('lộ trình: khung hôm nay không ghi ngày', labelOf('today') === '13:00 – 13:30');
  check('lộ trình: khung ngày mai ghi thêm "CN 22/11"', labelOf('tmr') === '08:00 – 08:30 · CN 22/11');
  check('lộ trình: đơn quá giờ vào khung Đã trễ giờ', labelOf('late') === 'Đã trễ giờ');
  check(
    'lộ trình: khung trễ xếp đầu, khung ngày mai xếp cuối',
    plan.slots[0].label === 'Đã trễ giờ' && plan.slots[plan.slots.length - 1].label.includes('22/11')
  );
}

console.log(`\nKẾT QUẢ: ${passed} đạt, ${failed} trượt`);
if (failed > 0) process.exit(1);
