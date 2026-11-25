// Số liệu vận hành cho tab Theo kỳ của Báo cáo (PR #83, docs/bao-cao-plan.md):
// Đơn theo vùng, Giao hàng, Công nợ, Xử lý đơn web. Hàm thuần — component chỉ
// hiển thị và lo phần tương tác (gọi điện, đánh dấu đã thu). Mọi số theo ngày bán
// (saleDate), đơn huỷ bị loại (quy ước chung ở mục 0 của plan).
import { suburbOptions } from '../site/suburbs.js';
import { customerKey } from './duplicates.js';
import { storedGeoOf } from './orderGeo.js';
import { estimateRunMinutes, planRouteByArea } from './route.js';
import { saleDate } from './saleDate.js';
import { DEFAULT_ZONES, matchZone } from './shippingZones.js';
import { orderTotal, startOfWeek } from './stats.js';
import { normalizeText } from './text.js';

const DAY = 86400000;
export const UNKNOWN_REGION = 'Chưa rõ vùng';
export const DEFAULT_FUEL_PER_KM = 0.25;

const inPeriod = (orders, range) =>
  orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const t = saleDate(o).getTime();
    return t >= range.start.getTime() && t < range.end.getTime();
  });

// --- Thẻ F: Đơn theo vùng -----------------------------------------------------
// Thứ tự xác định vùng (đúng plan, KHÔNG đảo): (1) tên khu đọc từ địa chỉ khách
// gõ, khớp danh sách khu của website (site/suburbs); (2) vùng lưu kèm toạ độ trên
// đơn (storedGeoOf) sau khi bỏ postcode; (3) "Chưa rõ vùng". Tên khu của
// OpenStreetMap thường khác tên khách chọn nên geo chỉ là nguồn dự phòng.
export function regionReport(orders, range, zones = DEFAULT_ZONES) {
  const period = inPeriod(orders, range);
  const delivery = period.filter((o) => o.type === 'delivery');
  const suburbs = suburbOptions(zones)
    .map((s) => ({
      display: s.label.replace(/\s+(VIC|NSW)\s+\d{4}$/i, '').trim(),
      key: normalizeText(s.label.replace(/\s+(VIC|NSW)\s+\d{4}$/i, '')).trim(),
    }))
    .filter((s) => s.key)
    .sort((a, b) => b.key.length - a.key.length); // tên dài khớp trước (South Albury trước Albury)

  const resolve = (o) => {
    const addr = normalizeText(o.customer?.address ?? '');
    if (addr) {
      for (const s of suburbs) {
        if (addr.includes(s.key)) return s.display;
      }
    }
    const zone = storedGeoOf(o)?.zone;
    if (zone) {
      const cleaned = normalizeText(zone).replace(/\b\d{4}\b/g, '').replace(/\b(vic|nsw|victoria|new south wales)\b/g, '').trim();
      if (cleaned) {
        const hit = suburbs.find((s) => s.key === cleaned || cleaned.includes(s.key));
        if (hit) return hit.display;
        return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
      }
    }
    return UNKNOWN_REGION;
  };

  const groups = new Map();
  for (const o of delivery) {
    const name = resolve(o);
    const g = groups.get(name) ?? { name, revenue: 0, orders: 0 };
    g.revenue += orderTotal(o);
    g.orders += 1;
    groups.set(name, g);
  }
  const totalRevenue = delivery.reduce((s, o) => s + orderTotal(o), 0);
  const rows = [...groups.values()]
    .map((g) => ({ ...g, share: totalRevenue ? g.revenue / totalRevenue : 0 }))
    .sort((a, b) => {
      if (a.name === UNKNOWN_REGION) return 1;
      if (b.name === UNKNOWN_REGION) return -1;
      return b.revenue - a.revenue;
    });
  const unknownOrders = groups.get(UNKNOWN_REGION)?.orders ?? 0;
  return {
    rows,
    deliveryOrders: delivery.length,
    pickupOrders: period.length - delivery.length,
    totalRevenue,
    withZone: delivery.length - unknownOrders,
    unknownOrders,
    warn: delivery.length > 0 && unknownOrders / delivery.length > 0.2,
  };
}

// --- Thẻ C: Giao hàng ----------------------------------------------------------
// Gom đơn giao theo từng đợt thứ Bảy trong kỳ, chạy planRouteByArea bằng toạ độ
// đã có sẵn (nơi gọi truyền vào: storedGeoOf trước, cachedGeocode sau — không tra
// mạng ở đây) và cộng dồn điểm dừng / km / thời gian ước tính.
export function deliveryReport(orders, range, { geo, start, homeSide = 'vic', fuelPerKm = DEFAULT_FUEL_PER_KM, zones = DEFAULT_ZONES, now = new Date() } = {}) {
  const period = inPeriod(orders, range);
  const delivery = period.filter((o) => o.type === 'delivery');

  const runs = new Map();
  for (const o of delivery) {
    const sat = new Date(startOfWeek(saleDate(o)).getTime() + 5 * DAY).getTime();
    if (!runs.has(sat)) runs.set(sat, []);
    runs.get(sat).push(o);
  }

  let stops = 0;
  let km = 0;
  let minutes = 0;
  const zoneKm = new Map();
  for (const runOrders of runs.values()) {
    const plan = planRouteByArea(runOrders, geo, start, now, { homeSide });
    stops += plan.slots.reduce((n, s) => n + (s.items?.length ?? s.stops?.length ?? 0), 0);
    km += plan.totalKm;
    minutes += estimateRunMinutes(plan.totalKm, plan.slots.reduce((n, s) => n + (s.items?.length ?? s.stops?.length ?? 0), 0)).total;
    for (const slot of plan.slots) {
      for (const item of slot.items ?? slot.stops ?? []) {
        if (item.km == null) continue;
        const z = matchZone(item.order.customer?.address ?? '', zones);
        const label = z ? z.name : UNKNOWN_REGION;
        zoneKm.set(label, (zoneKm.get(label) ?? 0) + item.km);
      }
    }
  }

  // Đúng giờ: giao xong (shippedAt) không muộn hơn giờ hẹn + 30 phút
  let timed = 0;
  let onTimeCount = 0;
  for (const o of delivery) {
    if (!o.shippedAt || !o.deliverAt) continue;
    timed += 1;
    if (new Date(o.shippedAt).getTime() <= new Date(o.deliverAt).getTime() + 30 * 60000) onTimeCount += 1;
  }

  const shippingByZone = new Map();
  for (const o of delivery) {
    const z = matchZone(o.customer?.address ?? '', zones);
    const label = z ? z.name : UNKNOWN_REGION;
    shippingByZone.set(label, (shippingByZone.get(label) ?? 0) + (Number(o.shippingFee) || 0));
  }
  const zoneLabels = new Set([...shippingByZone.keys(), ...zoneKm.keys()]);
  const byZone = [...zoneLabels]
    .map((label) => {
      const zkm = zoneKm.get(label) ?? 0;
      return { zone: label, shipping: shippingByZone.get(label) ?? 0, km: zkm, fuel: zkm * fuelPerKm };
    })
    .sort((a, b) => b.shipping - a.shipping);

  return {
    runs: runs.size,
    stops,
    km,
    minutes,
    onTime: { rate: timed ? onTimeCount / timed : null, n: timed, late: timed - onTimeCount },
    failedNow: delivery.filter((o) => o.status === 'failed').length,
    shippingCollected: delivery.reduce((s, o) => s + (Number(o.shippingFee) || 0), 0),
    fuelCost: km * fuelPerKm,
    byZone,
  };
}

// --- Thẻ D: Công nợ -------------------------------------------------------------
// Không phụ thuộc kỳ: mọi đơn chưa thu, chưa huỷ, ngày bán đã qua hơn 7 ngày.
// Gộp theo khoá khách của lib/duplicates (SĐT ≥ 8 số, không thì tên bỏ dấu) —
// hai số điện thoại viết khác nhau (có/không khoảng trắng) vẫn là một khách.
export function debtReport(orders, now = new Date()) {
  const cutoff = now.getTime() - 7 * DAY;
  const groups = new Map();
  for (const o of orders) {
    if (o.paid || o.status === 'cancelled') continue;
    const sold = saleDate(o);
    if (sold.getTime() >= cutoff) continue;
    const key = customerKey(o) || `order:${o.id}`;
    const g = groups.get(key) ?? {
      key,
      name: o.customer?.name ?? '',
      phone: o.customer?.phone ?? '',
      total: 0,
      count: 0,
      oldest: sold,
      orderIds: [],
      latest: sold,
    };
    g.total += orderTotal(o);
    g.count += 1;
    g.orderIds.push(o.id);
    if (sold < g.oldest) g.oldest = sold;
    if (sold > g.latest) {
      g.latest = sold;
      g.name = o.customer?.name ?? g.name;
      g.phone = o.customer?.phone ?? g.phone;
    }
    groups.set(key, g);
  }
  const list = [...groups.values()]
    .map((g) => ({ ...g, ageDays: Math.floor((now.getTime() - g.oldest.getTime()) / DAY) }))
    .sort((a, b) => b.total - a.total);
  return { groups: list, totalDebt: list.reduce((s, g) => s + g.total, 0) };
}

// --- Thẻ E: Xử lý đơn web -------------------------------------------------------
// Thời gian xác nhận = confirmedAt − createdAt của đơn web trong kỳ; đơn thiếu
// một trong hai mốc thì bỏ qua và báo rõ số lượng bỏ qua.
export function webReport(orders, range) {
  const period = inPeriod(orders, range);
  const web = period.filter((o) => o.source === 'web');
  const durations = [];
  const slow = [];
  let skipped = 0;
  for (const o of web) {
    if (!o.createdAt || !o.confirmedAt) {
      skipped += 1;
      continue;
    }
    const ms = new Date(o.confirmedAt).getTime() - new Date(o.createdAt).getTime();
    if (ms < 0) {
      skipped += 1;
      continue;
    }
    durations.push(ms);
    if (ms > 2 * 3600000) slow.push({ number: o.number ?? o.id, hours: ms / 3600000 });
  }
  durations.sort((a, b) => a - b);
  const mean = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const median = durations.length
    ? durations.length % 2
      ? durations[durations.length >> 1]
      : (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
    : null;
  slow.sort((a, b) => b.hours - a.hours);
  return {
    web: web.length,
    manual: period.length - web.length,
    meanMs: mean,
    medianMs: median,
    n: durations.length,
    skipped,
    slow,
  };
}
