// Sắp xếp thứ tự giao các đơn ship. Ưu tiên lần lượt:
//   1. Giờ giao sớm: chia theo khung giờ (mặc định 30 phút); đơn đã trễ giờ gom vào khung đầu tiên.
//   2. Theo vùng: trong một khung giờ, giao hết một vùng (suburb) rồi mới sang vùng khác.
//   3. Gần trước xa sau: luôn chọn điểm gần vị trí hiện tại nhất (tính từ GPS, rồi từ điểm vừa giao).
//
// Từ 24/11 lộ trình mặc định xếp THEO KHU VỰC (planRouteByArea bên dưới); cách xếp theo
// khung giờ ở đây vẫn giữ làm lựa chọn "Theo giờ" và cho đợt nấu (batches.js).
import { distanceKm } from './geo';
import { DEFAULT_ZONES, matchZone } from './shippingZones';

export const SLOT_OPTIONS = [15, 30, 60];

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (t) => `${pad(t.getHours())}:${pad(t.getMinutes())}`;

function slotOf(order, now, slotMinutes) {
  const t = new Date(order.deliverAt).getTime();
  if (t < now.getTime()) return { key: -Infinity, label: 'Đã trễ giờ' };
  const slotMs = slotMinutes * 60000;
  // Chia khung tính từ nửa đêm theo giờ máy, để khung 60 phút luôn bắt đầu ở phút :00
  const midnight = new Date(t).setHours(0, 0, 0, 0);
  const start = midnight + Math.floor((t - midnight) / slotMs) * slotMs;
  const range = `${hhmm(new Date(start))} – ${hhmm(new Date(start + slotMs))}`;
  // Đơn hẹn ngày khác hôm nay (vd đơn ngày mai đã mang đi sớm): ghi thêm ngày vào
  // nhãn khung để khỏi lẫn với khung cùng giờ của hôm nay. Người gọi gom đợt
  // (batches.js) truyền now = đầu ngày giao và chỉ đơn trong ngày đó nên nhãn
  // của đợt không đổi.
  if (new Date(t).toDateString() !== now.toDateString()) {
    const d = new Date(t);
    const wd = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getDay()];
    return { key: start, label: `${range} · ${wd} ${d.getDate()}/${d.getMonth() + 1}` };
  }
  return { key: start, label: range };
}

// geo: Map orderId -> { lat, lng, zone } | null (không tìm thấy trên bản đồ)
export function planRoute(orders, geo, start, now = new Date(), slotMinutes = 30) {
  const slots = new Map();
  for (const o of [...orders].sort((a, b) => a.deliverAt.localeCompare(b.deliverAt))) {
    const s = slotOf(o, now, slotMinutes);
    if (!slots.has(s.key)) slots.set(s.key, { label: s.label, overdue: s.key === -Infinity, orders: [] });
    slots.get(s.key).orders.push(o);
  }

  let pos = start;
  let index = 0;
  let totalKm = 0;
  const result = [];

  for (const slot of [...slots.entries()].sort(([a], [b]) => a - b).map(([, s]) => s)) {
    const located = slot.orders.filter((o) => geo.get(o.id));
    const unlocated = slot.orders.filter((o) => !geo.get(o.id));
    const stops = [];

    const visit = (o) => {
      const g = geo.get(o.id);
      const km = pos ? distanceKm(pos, g) : null;
      if (km != null) totalKm += km;
      stops.push({ order: o, geo: g, distanceKm: km, index: ++index });
      located.splice(located.indexOf(o), 1);
      pos = g;
    };
    // Chưa có điểm xuất phát: bắt đầu từ đơn có giờ giao sớm nhất
    const nearest = (list) =>
      pos ? list.reduce((best, o) => (distanceKm(pos, geo.get(o.id)) < distanceKm(pos, geo.get(best.id)) ? o : best)) : list[0];

    while (located.length) {
      const first = nearest(located);
      const zone = geo.get(first.id).zone;
      visit(first);
      // Giao hết các đơn cùng vùng (gần trước xa sau) rồi mới sang vùng khác
      let sameZone = zone ? located.filter((o) => geo.get(o.id).zone === zone) : [];
      while (sameZone.length) {
        visit(nearest(sameZone));
        sameZone = located.filter((o) => geo.get(o.id).zone === zone);
      }
    }
    for (const o of unlocated) stops.push({ order: o, geo: null, distanceKm: null, index: ++index });

    result.push({ label: slot.label, overdue: slot.overdue, stops });
  }
  return { slots: result, totalKm };
}

// ───────────── Xếp theo khu vực (bên sông) ─────────────
// Albury–Wodonga là hai thành phố hai bên sông Murray, chạy qua lại cầu tốn rất nhiều
// km (vd 7 điểm mà 48 km vì xếp theo khung giờ cứ qua sông rồi về). Cách xếp mới
// (ý Paul 24/11):
//   1. Giao hết bên quán (Wodonga, VIC) trước, gần trước xa sau.
//   2. Từ ~10:00 mới qua sông giao Albury – Lavington – Thurgoona (NSW).
//   3. Đơn bên kia sông hẹn TRƯỚC 10:00 là đơn gấp: chạy qua một chuyến riêng, chèn vào
//      lúc muộn nhất mà vẫn kịp giờ hẹn (ước tính giờ tới theo estimate bên dưới);
//      nếu giao xong bên quán vẫn kịp thì chúng chỉ đơn giản đứng đầu phần bên kia sông.
export const CROSS_HOUR = 10;
const GRACE_MIN = 10; // trễ dưới 10 phút so với giờ hẹn vẫn tính là kịp

const SIDE_NAME = { vic: 'Wodonga', nsw: 'Albury – Lavington' };

// Bên sông của một địa chỉ: 'vic' (Wodonga) | 'nsw' (Albury, Lavington, Thurgoona) | null
export function sideOf(address, g = null) {
  const z = matchZone(address ?? '', DEFAULT_ZONES);
  if (z) return z.id === 'wodonga' ? 'vic' : 'nsw';
  const text = `${address ?? ''} ${g?.zone ?? ''}`;
  const codes = text.match(/\b[23]\d{3}\b/g);
  if (codes) return codes[codes.length - 1][0] === '3' ? 'vic' : 'nsw';
  if (/\b(vic|victoria)\b/i.test(text)) return 'vic';
  if (/\b(nsw|new south wales)\b/i.test(text)) return 'nsw';
  // Không có chữ nào: đoán theo toạ độ (sông chảy ngang phía bắc Wodonga, ~vĩ độ -36.095)
  if (g && g.lng > 146.7 && g.lng < 147.2 && g.lat < -35.9 && g.lat > -36.3) return g.lat < -36.095 ? 'vic' : 'nsw';
  return null;
}

const legMinutes = (km) => (km * ROAD_FACTOR * 60) / AVG_SPEED_KMH;

// Đi lần lượt list, luôn chọn điểm gần nhất, bắt đầu từ pos.
// Trả { seq: [{order, geo, km}], end, km }
function tour(list, geo, pos) {
  const left = [...list];
  const seq = [];
  let km = 0;
  const near = (cands) =>
    pos ? cands.reduce((b, o) => (distanceKm(pos, geo.get(o.id)) < distanceKm(pos, geo.get(b.id)) ? o : b)) : cands[0];
  const go = (o) => {
    const g = geo.get(o.id);
    const d = pos ? distanceKm(pos, g) : null;
    if (d != null) km += d;
    seq.push({ order: o, geo: g, km: d });
    left.splice(left.indexOf(o), 1);
    pos = g;
  };
  // Trong cùng một bên sông chỉ cần gần trước xa sau: gom theo suburb ở đây lại hay
  // làm đi vòng (thử trên mẫu: dài hơn ~15%)
  while (left.length) go(near(left));
  return { seq, end: pos, km };
}

const crossTimeOf = (iso) => new Date(iso).setHours(CROSS_HOUR, 0, 0, 0);
const byTime = (a, b) => (a.deliverAt ?? '').localeCompare(b.deliverAt ?? '');

// options: { homeSide: 'vic' | 'nsw' (bên có quán, mặc định Wodonga) }
// Trả cùng dạng với planRoute: { slots: [{ label, overdue, stops }], totalKm }
export function planRouteByArea(orders, geo, start, now = new Date(), { homeSide = 'vic' } = {}) {
  const sideCache = new Map(orders.map((o) => [o.id, sideOf(o.customer?.address, geo.get(o.id))]));
  const isHome = (o) => (sideCache.get(o.id) ?? homeSide) === homeSide;
  const located = (o) => !!geo.get(o.id);

  const sorted = [...orders].sort(byTime);
  const home = sorted.filter(isHome);
  const away = sorted.filter((o) => !isHome(o));
  const urgent = away.filter((o) => o.deliverAt && new Date(o.deliverAt).getTime() < crossTimeOf(o.deliverAt));
  const later = away.filter((o) => !urgent.includes(o));

  const homeTour = tour(home.filter(located), geo, start);
  const urgentLoc = urgent.filter(located);

  const homeName = SIDE_NAME[homeSide];
  const awayName = SIDE_NAME[homeSide === 'vic' ? 'nsw' : 'vic'];
  const cross = `${pad(CROSS_HOUR)}:00`;
  const unloc = (list) => list.filter((o) => !located(o));
  const n = homeTour.seq.length;

  // Phương án k: giao k điểm bên quán, qua sông giao đơn gấp, về giao nốt bên quán, rồi
  // giao phần còn lại bên kia sông. k = n: giao hết bên quán rồi mới qua sông (đơn gấp
  // đứng đầu phần bên kia). Trả { sections, km, ok } — ok: mọi đơn gấp kịp giờ.
  const build = (k) => {
    const sections = [];
    const add = (label, overdue, seq, extra = []) => {
      if (seq.length || extra.length) sections.push({ label, overdue, items: [...seq, ...extra.map((o) => ({ order: o, geo: null, km: null }))] });
    };
    const first = homeTour.seq.slice(0, k);
    let km = first.reduce((x, st) => x + (st.km ?? 0), 0);
    let t = now.getTime();
    const walk = (seq) => {
      let late = false;
      for (const st of seq) {
        t += (st.km != null ? legMinutes(st.km) : 0) * 60000;
        if (urgent.includes(st.order) && t > new Date(st.order.deliverAt).getTime() + GRACE_MIN * 60000) late = true;
        t += MINUTES_PER_STOP * 60000;
      }
      return late;
    };
    walk(first);
    const ex = tour(urgentLoc, geo, k ? first[k - 1].geo : start);
    let late = false;
    if (k < n) {
      late = walk(ex.seq);
      const rest = tour(homeTour.seq.slice(k).map((st) => st.order), geo, ex.end);
      const b = tour(later.filter(located), geo, rest.end);
      km += ex.km + rest.km + b.km;
      add(`Bên ${homeName}`, false, first);
      add(`${awayName} – đơn gấp (hẹn trước ${cross})`, true, ex.seq, unloc(urgent));
      add(k ? `Bên ${homeName} (tiếp)` : `Bên ${homeName}`, false, rest.seq, unloc(home));
      add(`${awayName} · từ ~${cross}`, false, b.seq, unloc(later));
    } else {
      late = walk(ex.seq);
      const b = tour(later.filter(located), geo, ex.end);
      km += ex.km + b.km;
      add(`Bên ${homeName}`, false, first, unloc(home));
      add(`${awayName} · từ ~${cross}`, false, [...ex.seq, ...b.seq], [...unloc(urgent), ...unloc(later)]);
    }
    return { sections, km, ok: !late };
  };

  // Không có đơn gấp, hoặc giao hết bên quán vẫn kịp: giữ nguyên thứ tự khu vực.
  // Không thì thử mọi chỗ chèn chuyến gấp, lấy phương án kịp giờ mà ít km nhất
  // (không phương án nào kịp thì đi đơn gấp ngay từ đầu).
  let best = build(n);
  if (urgentLoc.length && !best.ok) {
    best = null;
    for (let k = n - 1; k >= 0; k -= 1) {
      const p = build(k);
      if (p.ok && (!best || p.km < best.km - 0.05)) best = p;
    }
    best ??= build(0);
  }
  const { sections, km: totalKm } = best;

  let index = 0;
  const slots = sections.map((s) => ({
    label: s.label,
    overdue: s.overdue,
    stops: s.items.map((it) => ({ order: it.order, geo: it.geo, distanceKm: it.km, index: ++index })),
  }));
  return { slots, totalKm };
}

// Ước tính thời gian giao xong cả chuyến: đường thật ≈ 1,4 × đường chim bay, chạy trung bình 40 km/h
// trong khu Albury–Wodonga, cộng ~4 phút mỗi điểm (đỗ xe, gọi khách, đưa hàng, thu tiền).
export const ROAD_FACTOR = 1.4;
export const AVG_SPEED_KMH = 40;
export const MINUTES_PER_STOP = 4;
export function estimateRunMinutes(totalKm, stops) {
  const drive = ((totalKm * ROAD_FACTOR) / AVG_SPEED_KMH) * 60;
  return { drive: Math.round(drive), stopsTime: stops * MINUTES_PER_STOP, total: Math.round(drive + stops * MINUTES_PER_STOP) };
}
export const formatMinutes = (m) => (m >= 60 ? `${Math.floor(m / 60)} giờ ${String(m % 60).padStart(2, '0')} phút` : `${m} phút`);
