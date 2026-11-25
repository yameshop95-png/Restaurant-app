// Số liệu vận hành cho tab Theo kỳ của Báo cáo (PR #83, docs/bao-cao-plan.md):
// Đơn theo vùng, Giao hàng, Công nợ, Xử lý đơn web. Hàm thuần — component chỉ
// hiển thị và lo phần tương tác (gọi điện, đánh dấu đã thu). Mọi số theo ngày bán
// (saleDate), đơn huỷ bị loại (quy ước chung ở mục 0 của plan).
import { suburbOptions } from '../site/suburbs.js';
import { customerKey } from './duplicates.js';
import { storedGeoOf } from './orderGeo.js';
import { estimateRunMinutes, planRouteByArea, ROAD_FACTOR } from './route.js';
import { saleDate } from './saleDate.js';
import { DEFAULT_ZONES, STREET, matchZone } from './shippingZones.js';
import { orderTotal, startOfWeek } from './stats.js';
import { normalizeText } from './text.js';

const DAY = 86400000;
export const UNKNOWN_REGION = 'Chưa rõ vùng';

// Giá dầu mỗi km từ cài đặt quán (A7, issue #89): xe dầu của quán 6,9 L/100 km.
// Có 1 trong 2 trường mới → dùng công thức (trường còn thiếu lấy mặc định);
// chưa có trường mới mà máy đã lưu fuelCostPerKm cũ → dùng giá trị cũ.
export const FUEL_DEFAULTS = { litresPer100km: 6.9, pricePerLitre: 2.5 };
export function fuelCostPerKmOf(settings) {
  if (settings?.fuelLitresPer100km != null || settings?.fuelPricePerLitre != null) {
    const litres = Number(settings.fuelLitresPer100km) > 0 ? Number(settings.fuelLitresPer100km) : FUEL_DEFAULTS.litresPer100km;
    const price = Number(settings.fuelPricePerLitre) > 0 ? Number(settings.fuelPricePerLitre) : FUEL_DEFAULTS.pricePerLitre;
    return (litres / 100) * price;
  }
  const legacy = Number(settings?.fuelCostPerKm);
  if (legacy > 0) return legacy;
  return (FUEL_DEFAULTS.litresPer100km / 100) * FUEL_DEFAULTS.pricePerLitre;
}

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

  // Khớp theo TỪ (không includes thô) và bỏ các chỗ là tên đường ("Wodonga Pl"),
  // cùng quy tắc STREET của shippingZones. Ưu tiên đoạn sau dấu phẩy cuối vì đó
  // mới là khu thật: "3 Wodonga Pl, Albury NSW 2640" là Albury (B2, issue #89).
  const normAddr = (a) => ` ${normalizeText(a ?? '').replace(/[^a-z0-9]+/g, ' ')} `;
  const findSuburb = (text) => {
    for (const s of suburbs) {
      let at = text.indexOf(` ${s.key} `);
      while (at >= 0 && STREET.test(text.slice(at + s.key.length + 2))) at = text.indexOf(` ${s.key} `, at + 1);
      if (at >= 0) return s.display;
    }
    return null;
  };
  const resolve = (o) => {
    const rawAddr = o.customer?.address ?? '';
    if (rawAddr) {
      const segments = rawAddr.split(',');
      const hit = findSuburb(normAddr(segments[segments.length - 1])) ?? findSuburb(normAddr(rawAddr));
      if (hit) return hit;
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
export function deliveryReport(orders, range, { geo, start, homeSide = 'vic', costPerKm = null, zones = DEFAULT_ZONES, now = new Date() } = {}) {
  const period = inPeriod(orders, range);
  const delivery = period.filter((o) => o.type === 'delivery');

  const runs = new Map();
  for (const o of delivery) {
    const sat = new Date(startOfWeek(saleDate(o)).getTime() + 5 * DAY).getTime();
    if (!runs.has(sat)) runs.set(sat, []);
    runs.get(sat).push(o);
  }

  // planRouteByArea trả slot.stops, mỗi điểm có distanceKm là km CHIM BAY của
  // chặng tới điểm đó. Km hiển thị và tiền dầu tính theo km ĐƯỜNG THẬT = chim bay
  // × ROAD_FACTOR (A3 + A4, issue #89); phút giữ nguyên vì estimateRunMinutes
  // đã tự nhân hệ số đường thật.
  const perKm = costPerKm ?? fuelCostPerKmOf(null);
  let stops = 0;
  let crowKm = 0;
  let minutes = 0;
  const zoneKm = new Map();
  for (const runOrders of runs.values()) {
    const plan = planRouteByArea(runOrders, geo, start, now, { homeSide });
    const runStops = plan.slots.reduce((n, s) => n + s.stops.length, 0);
    stops += runStops;
    crowKm += plan.totalKm;
    minutes += estimateRunMinutes(plan.totalKm, runStops).total;
    for (const slot of plan.slots) {
      for (const stop of slot.stops) {
        if (stop.distanceKm == null) continue;
        const z = matchZone(stop.order.customer?.address ?? '', zones);
        const label = z ? z.name : UNKNOWN_REGION;
        zoneKm.set(label, (zoneKm.get(label) ?? 0) + stop.distanceKm);
      }
    }
  }
  const km = crowKm * ROAD_FACTOR;

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
      const zkm = (zoneKm.get(label) ?? 0) * ROAD_FACTOR;
      return { zone: label, shipping: shippingByZone.get(label) ?? 0, km: zkm, fuel: zkm * perKm };
    })
    .sort((a, b) => b.shipping - a.shipping);
  // Độ phủ toạ độ (B5): đơn giao không có toạ độ đóng góp 0 km — phải nói rõ
  const withGeo = delivery.filter((o) => geo?.get(o.id)).length;

  return {
    runs: runs.size,
    stops,
    km,
    minutes,
    onTime: { rate: timed ? onTimeCount / timed : null, n: timed, late: timed - onTimeCount },
    failedNow: delivery.filter((o) => o.status === 'failed').length,
    shippingCollected: delivery.reduce((s, o) => s + (Number(o.shippingFee) || 0), 0),
    fuelCost: km * perKm,
    geoCoverage: { withGeo, total: delivery.length, low: delivery.length > 0 && withGeo / delivery.length < 0.8 },
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

// Thời gian chờ hiệu dụng của đơn web: confirmedAt − createdAt nhưng TRỪ phần
// nằm trong khung đêm 22:00–07:00 — đơn đặt 23:00, xác nhận 07:20 sáng hôm sau
// là chờ 20 phút, không phải 8 giờ 20 (B6, issue #89).
export function effectiveWaitMs(createdAt, confirmedAt) {
  const start = new Date(createdAt).getTime();
  const end = new Date(confirmedAt).getTime();
  if (!(end > start)) return 0;
  let night = 0;
  const firstMidnight = new Date(start);
  firstMidnight.setHours(0, 0, 0, 0);
  for (let t = firstMidnight.getTime() - DAY; t < end; t += DAY) {
    const wStart = t + 22 * 3600000;
    const wEnd = t + DAY + 7 * 3600000;
    const overlap = Math.min(end, wEnd) - Math.max(start, wStart);
    if (overlap > 0) night += overlap;
  }
  return end - start - night;
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
    if (new Date(o.confirmedAt).getTime() < new Date(o.createdAt).getTime()) {
      skipped += 1;
      continue;
    }
    const ms = effectiveWaitMs(o.createdAt, o.confirmedAt);
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
