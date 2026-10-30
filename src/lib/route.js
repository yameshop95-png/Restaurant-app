// Sắp xếp thứ tự giao các đơn ship. Ưu tiên lần lượt:
//   1. Giờ giao sớm: chia theo khung giờ (mặc định 30 phút); đơn đã trễ giờ gom vào khung đầu tiên.
//   2. Theo vùng: trong một khung giờ, giao hết một vùng (suburb) rồi mới sang vùng khác.
//   3. Gần trước xa sau: luôn chọn điểm gần vị trí hiện tại nhất (tính từ GPS, rồi từ điểm vừa giao).
import { distanceKm } from './geo';

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
  return { key: start, label: `${hhmm(new Date(start))} – ${hhmm(new Date(start + slotMs))}` };
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
