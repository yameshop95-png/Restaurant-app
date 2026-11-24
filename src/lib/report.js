// Tính báo cáo theo tuần / tháng / năm từ danh sách đơn. Đơn đã huỷ không tính.
// Thời điểm bán = lúc tạo đơn (giống Màn hình chính).
import { normalizeText } from '../hooks/useCustomers';
import { formatMoney, orderTotal, startOfWeek } from './stats';

export const PERIODS = { week: 'Tuần', month: 'Tháng', year: 'Năm' };
const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
const WEEKDAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const DAY = 86400000;

const weekdayIndex = (d) => (d.getDay() + 6) % 7; // 0 = Thứ Hai
// Tự định dạng: toLocaleDateString('vi-VN') chỉ có ngày + tháng ra "20-10" trên một số trình duyệt
const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

// Khoảng thời gian [start, end) chứa `anchor`
export function periodRange(kind, anchor) {
  const a = new Date(anchor);
  let start;
  let end;
  if (kind === 'week') {
    start = startOfWeek(a);
    end = new Date(start);
    end.setDate(end.getDate() + 7);
  } else if (kind === 'month') {
    start = new Date(a.getFullYear(), a.getMonth(), 1);
    end = new Date(a.getFullYear(), a.getMonth() + 1, 1);
  } else {
    start = new Date(a.getFullYear(), 0, 1);
    end = new Date(a.getFullYear() + 1, 0, 1);
  }
  const lastDay = new Date(end.getTime() - DAY);
  const label =
    kind === 'week'
      ? `Tuần ${fmt(start)} – ${fmt(lastDay)}/${lastDay.getFullYear()}`
      : kind === 'month'
        ? `Tháng ${start.getMonth() + 1}/${start.getFullYear()}`
        : `Năm ${start.getFullYear()}`;
  return { kind, start, end, label };
}

export function shiftPeriod(kind, anchor, delta) {
  const d = new Date(anchor);
  if (kind === 'week') d.setDate(d.getDate() + 7 * delta);
  else if (kind === 'month') d.setMonth(d.getMonth() + delta, 1);
  else d.setFullYear(d.getFullYear() + delta, 0, 1);
  return d;
}

// Các cột của biểu đồ doanh thu: ngày trong tuần / ngày trong tháng / tháng trong năm
function bucketsFor(range) {
  if (range.kind === 'year') {
    return Array.from({ length: 12 }, (_, m) => ({ key: m, label: `T${m + 1}`, long: `Tháng ${m + 1}` }));
  }
  const days = Math.round((range.end - range.start) / DAY);
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(range.start);
    d.setDate(d.getDate() + i);
    return range.kind === 'week'
      ? { key: i, label: WEEKDAYS_SHORT[i], long: `${WEEKDAYS[i]} ${fmt(d)}` }
      : { key: i, label: String(d.getDate()), long: `${WEEKDAYS[weekdayIndex(d)]} ${fmt(d)}` };
  });
}

function bucketKey(range, date) {
  return range.kind === 'year' ? date.getMonth() : Math.round((startOfDay(date) - range.start) / DAY); // round: ngày đổi giờ mùa hè dài 23/25 tiếng
}
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

// Phân đoạn "thời điểm" để xem món nào bán mạnh lúc nào
function segmentsFor(range) {
  if (range.kind === 'week') return WEEKDAYS.map((label, i) => ({ label, match: (d) => weekdayIndex(d) === i }));
  if (range.kind === 'month') {
    return [
      { label: 'Đầu tháng (1–10)', match: (d) => d.getDate() <= 10 },
      { label: 'Giữa tháng (11–20)', match: (d) => d.getDate() > 10 && d.getDate() <= 20 },
      { label: 'Cuối tháng (21–hết)', match: (d) => d.getDate() > 20 },
    ];
  }
  return [1, 2, 3, 4].map((q) => ({ label: `Quý ${q}`, match: (d) => Math.floor(d.getMonth() / 3) === q - 1 }));
}

const inRange = (range) => (o) => {
  const t = new Date(o.createdAt);
  return o.status !== 'cancelled' && t >= range.start && t < range.end;
};

// Khoá gộp món cho báo cáo: tên đã chuẩn hoá, bỏ hậu tố TRỌNG LƯỢNG ở cuối tên.
// Cùng một món bị tách thành nhiều dòng chỉ vì cách ghi tên khác nhau giữa các nguồn:
// thực đơn web/app ghi kèm định lượng ("Giò lụa 500g", "Bánh cuốn 1kg"), sổ giấy và
// đơn nhập tay thì không ("Giò Lụa", "Bánh cuốn"). Chỉ bỏ token trọng lượng cuối tên
// (500g, 1kg, 1 kg...) — các phân biệt thật như "nhỏ", "mặn", "ngọt", "chuối" giữ nguyên.
// Bí danh theo thực đơn trong Cài đặt app — nguồn sự thật cho danh tính món (Paul chốt
// 24/11: "cùng món nhưng giá mới" thì vẫn là một món). Sổ giấy ghi tên khác thực đơn
// hiện tại: thiếu chữ "Bánh", ghi thêm "mặn" cho món mặn mặc định, hoặc tên cũ trước
// khi quán đổi tên. Các biến thể "ngọt" là món khác hẳn nên KHÔNG có bí danh.
const DISH_ALIASES = {
  'banh chung man': 'banh chung',
  'banh tet man': 'banh tet',
  'tet chuoi': 'banh tet chuoi',
  'tau hu': 'tau hu singapore',
};

const dishKey = (name) => {
  const base = normalizeText(name)
    .replace(/\s+\d+(?:[.,]\d+)?\s*(kg|g)$/, '')
    .trim();
  return DISH_ALIASES[base] ?? base;
};

function dishTotals(orders, menu = []) {
  // Tên chuẩn lấy từ thực đơn Cài đặt app: nhóm nào khớp một món trong thực đơn
  // thì hiển thị đúng tên thực đơn (VD nhóm "Tàu Hũ" hiện là "Tàu Hũ Singapore").
  const menuNames = new Map(menu.map((m) => [dishKey(m.name ?? ''), m.name]));
  const map = new Map();
  for (const o of orders) {
    for (const { name, qty, price } of o.items) {
      const key = dishKey(name);
      const row = map.get(key) ?? { name, qty: 0, revenue: 0, orders: 0, minPrice: price, maxPrice: price, variants: new Map() };
      row.qty += qty;
      row.revenue += qty * price;
      row.orders += 1;
      row.minPrice = Math.min(row.minPrice, price);
      row.maxPrice = Math.max(row.maxPrice, price);
      row.variants.set(name, (row.variants.get(name) ?? 0) + qty);
      map.set(key, row);
    }
  }
  // Tên hiển thị: ưu tiên tên thực đơn; không có trong thực đơn thì lấy biến thể
  // bán nhiều nhất trong nhóm (ổn định, không phụ thuộc thứ tự đơn).
  for (const [key, row] of map.entries()) {
    if (menuNames.has(key)) {
      row.name = menuNames.get(key);
      delete row.variants;
      continue;
    }
    let best = row.name;
    let bestQty = -1;
    for (const [variant, vQty] of row.variants) {
      if (vQty > bestQty) {
        best = variant;
        bestQty = vQty;
      }
    }
    row.name = best;
    delete row.variants;
  }
  return map;
}

const sum = (list, f) => list.reduce((s, x) => s + f(x), 0);

export function buildReport(allOrders, kind, anchor, menu = [], now = new Date()) {
  const range = periodRange(kind, anchor);
  const prevRange = periodRange(kind, shiftPeriod(kind, anchor, -1));
  const isCurrent = now >= range.start && now < range.end;
  const orders = allOrders.filter(inRange(range));
  // Kỳ đang diễn ra: so với cùng thời điểm của kỳ trước (VD thứ Tư tuần này so với hết thứ Tư tuần trước),
  // không so với cả kỳ trước để tránh "giảm" giả.
  const prevCutoff = isCurrent
    ? new Date(prevRange.start.getTime() + (now - range.start) * ((prevRange.end - prevRange.start) / (range.end - range.start)))
    : prevRange.end;
  const prevOrders = allOrders.filter(inRange({ start: prevRange.start, end: prevCutoff }));

  const revenue = sum(orders, orderTotal);
  const prevRevenue = sum(prevOrders, orderTotal);
  const totalQty = sum(orders, (o) => sum(o.items, (i) => i.qty));

  // Món: số lượng, doanh thu, tỉ trọng, giá TB, so với kỳ trước
  const dishes = dishTotals(orders, menu);
  const prevDishes = dishTotals(prevOrders, menu);
  const dishRows = [...dishes.entries()]
    .map(([key, d]) => ({
      ...d,
      avgPrice: d.revenue / d.qty,
      qtyShare: totalQty ? d.qty / totalQty : 0,
      revenueShare: revenue ? d.revenue / revenue : 0,
      prevQty: prevDishes.get(key)?.qty ?? 0,
    }))
    .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);

  // Biểu đồ doanh thu theo ngày / tháng
  const buckets = bucketsFor(range).map((b) => ({ ...b, revenue: 0, orders: 0 }));
  for (const o of orders) {
    const b = buckets[bucketKey(range, new Date(o.createdAt))];
    if (b) {
      b.revenue += orderTotal(o);
      b.orders += 1;
    }
  }

  // Thời điểm: doanh thu + top món theo từng phân đoạn
  const segments = segmentsFor(range).map((s) => {
    const list = orders.filter((o) => s.match(new Date(o.createdAt)));
    const top = [...dishTotals(list).values()].sort((a, b) => b.qty - a.qty).slice(0, 3);
    return { label: s.label, revenue: sum(list, orderTotal), orders: list.length, top };
  });

  // Thứ trong tuần mạnh nhất (cho tháng / năm)
  const weekdays = WEEKDAYS.map((label, i) => {
    const list = orders.filter((o) => weekdayIndex(new Date(o.createdAt)) === i);
    return { label, revenue: sum(list, orderTotal), orders: list.length };
  });

  // Dự báo. Nếu app mới bắt đầu dùng giữa kỳ, tính tốc độ bán từ đơn đầu tiên thay vì từ đầu kỳ.
  const firstOrderAt = allOrders.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), now.toISOString());
  const effectiveStart = new Date(Math.max(range.start, startOfDay(new Date(firstOrderAt))));
  const elapsed = isCurrent ? Math.max(0, (now - effectiveStart) / (range.end - effectiveStart)) : 1;
  const timeElapsed = isCurrent ? (now - range.start) / (range.end - range.start) : 1;
  const history = [1, 2, 3].map((k) =>
    sum(allOrders.filter(inRange(periodRange(kind, shiftPeriod(kind, anchor, -k)))), orderTotal)
  );
  const historyWithData = history.filter((v) => v > 0);
  const historyAvg = historyWithData.length ? sum(historyWithData, (v) => v) / historyWithData.length : 0;
  // Đầu kỳ ít dữ liệu: dựa nhiều vào trung bình các kỳ trước; càng về cuối kỳ càng dựa vào tốc độ bán thực tế.
  const runRate = elapsed > 0 ? revenue / elapsed : 0;
  const weight = historyAvg ? Math.min(1, elapsed * 1.5) : 1;
  // Số thực thu: đơn đã thanh toán trong kỳ (không ước tính). Phần chưa thu hiện riêng.
  const collected = sum(orders.filter((o) => o.paid), orderTotal);
  const uncollected = revenue - collected;
  const projected = isCurrent ? weight * runRate + (1 - weight) * historyAvg : revenue;
  // Dự báo kỳ sau chỉ dựa trên các kỳ đã đủ (không dùng số ước tính của kỳ đang chạy)
  const series = [history[1], history[0]].filter((v) => v > 0);
  if (!isCurrent && revenue > 0) series.push(revenue);
  const trend = series.length >= 2 ? (series[series.length - 1] - series[0]) / (series.length - 1) : 0;
  const nextForecast = Math.max(0, sum(series, (v) => v) / series.length + trend);

  const forecast = {
    isCurrent,
    elapsed: timeElapsed,
    sinceFirstOrder: effectiveStart > range.start,
    collected,
    uncollected,
    historyAvg,
    nextForecast,
    dishes: [],
  };

  const report = {
    range,
    prevRange,
    comparedToDate: isCurrent,
    revenue,
    prevRevenue,
    orderCount: orders.length,
    prevOrderCount: prevOrders.length,
    avgOrder: orders.length ? revenue / orders.length : 0,
    totalQty,
    dishes: dishRows,
    buckets,
    segments,
    weekdays,
    forecast,
    unsold: menu.filter((m) => m.available !== false && !dishes.has(normalizeText(m.name))).map((m) => m.name),
    menuAvgPrice: menu.length ? sum(menu, (m) => m.price) / menu.length : 0,
  };
  report.insights = buildInsights(report);
  return report;
}

const pct = (v) => `${v >= 0 ? '+' : ''}${Math.round(v * 100)}%`;
const money = (n) => formatMoney(n);

// Nhận xét tự động bằng quy tắc (không cần AI)
function buildInsights(r) {
  const out = [];
  if (!r.orderCount) return [{ tone: 'neutral', text: `Chưa có đơn nào trong ${r.range.label.toLowerCase()}.` }];

  if (r.prevRevenue > 0) {
    const g = (r.revenue - r.prevRevenue) / r.prevRevenue;
    const vs = r.comparedToDate ? 'cùng thời điểm kỳ trước' : 'kỳ trước';
    out.push({
      tone: g >= 0 ? 'good' : 'bad',
      text: `Doanh thu ${pct(g)} so với ${vs} (${money(r.prevRevenue)}).`,
    });
  }

  const [top] = r.dishes;
  const topRevenue = [...r.dishes].sort((a, b) => b.revenue - a.revenue)[0];
  out.push({
    tone: 'good',
    text: `Bán chạy nhất: ${top.name} – ${top.qty} phần (${Math.round(top.qtyShare * 100)}% số phần).`,
  });
  if (topRevenue.name !== top.name) {
    out.push({
      tone: 'good',
      text: `Mang về nhiều tiền nhất: ${topRevenue.name} – ${money(topRevenue.revenue)} (${Math.round(topRevenue.revenueShare * 100)}% doanh thu).`,
    });
  }

  // Tăng / giảm mạnh nhất so với kỳ trước
  const moved = r.dishes.filter((d) => d.prevQty > 0).map((d) => ({ ...d, change: (d.qty - d.prevQty) / d.prevQty }));
  const up = moved.filter((d) => d.change > 0.2).sort((a, b) => b.change - a.change)[0];
  const down = moved.filter((d) => d.change < -0.2).sort((a, b) => a.change - b.change)[0];
  if (up) out.push({ tone: 'good', text: `${up.name} tăng mạnh: ${up.prevQty} → ${up.qty} phần (${pct(up.change)}).` });
  if (down) out.push({ tone: 'bad', text: `${down.name} giảm: ${down.prevQty} → ${down.qty} phần (${pct(down.change)}).` });

  // Thời điểm
  const best = [...r.segments].sort((a, b) => b.revenue - a.revenue)[0];
  if (best.revenue > 0 && r.segments.length > 1) {
    out.push({
      tone: 'neutral',
      text: `Bán mạnh nhất vào ${best.label.toLowerCase()}: ${money(best.revenue)}, món chính là ${best.top[0]?.name}.`,
    });
  }
  if (r.range.kind !== 'week') {
    const bestDay = [...r.weekdays].sort((a, b) => b.revenue - a.revenue)[0];
    if (bestDay.revenue > 0) out.push({ tone: 'neutral', text: `Thứ bán tốt nhất: ${bestDay.label} (${money(bestDay.revenue)}).` });
  }

  // Giá
  if (r.menuAvgPrice > 0 && r.dishes.length >= 3) {
    const avgQty = r.totalQty / r.dishes.length;
    const cheapHot = r.dishes.find((d) => d.qty >= avgQty * 1.5 && d.avgPrice < r.menuAvgPrice);
    const priceyCold = r.dishes.find((d) => d.qty <= avgQty * 0.5 && d.avgPrice > r.menuAvgPrice);
    if (cheapHot) {
      out.push({
        tone: 'neutral',
        text: `Giá: ${cheapHot.name} bán rất chạy dù giá dưới mức trung bình thực đơn (${money(cheapHot.avgPrice)} so với ${money(r.menuAvgPrice)}) – có thể cân nhắc tăng giá nhẹ.`,
      });
    }
    if (priceyCold) {
      out.push({
        tone: 'bad',
        text: `Giá: ${priceyCold.name} bán ít và giá trên trung bình (${money(priceyCold.avgPrice)}) – cân nhắc khuyến mãi hoặc xem lại giá.`,
      });
    }
  }
  const changed = r.dishes.filter((d) => d.maxPrice !== d.minPrice);
  for (const d of changed.slice(0, 2)) {
    out.push({ tone: 'neutral', text: `${d.name} đã đổi giá trong kỳ (${money(d.minPrice)} – ${money(d.maxPrice)}).` });
  }
  if (r.unsold.length) {
    out.push({ tone: 'bad', text: `Chưa bán được phần nào: ${r.unsold.slice(0, 5).join(', ')}${r.unsold.length > 5 ? '…' : ''}.` });
  }
  return out;
}

// Dữ liệu gửi cho AI: chỉ số liệu tổng hợp, không có tên / SĐT / địa chỉ khách.
export function reportForAI(r) {
  const round = (n) => Math.round(n * 100) / 100;
  return {
    ky: r.range.label,
    ky_truoc: r.prevRange.label,
    so_sanh_ky_truoc: r.comparedToDate ? 'cùng thời điểm của kỳ trước (kỳ này chưa kết thúc)' : 'cả kỳ trước',
    ky_dang_dien_ra: r.forecast.isCurrent,
    phan_tram_ky_da_qua: Math.round(r.forecast.elapsed * 100),
    tien_te: 'AUD',
    doanh_thu: round(r.revenue),
    doanh_thu_ky_truoc: round(r.prevRevenue),
    so_don: r.orderCount,
    so_don_ky_truoc: r.prevOrderCount,
    gia_tri_don_trung_binh: round(r.avgOrder),
    gia_trung_binh_thuc_don: round(r.menuAvgPrice),
    mon: r.dishes.map((d) => ({
      ten: d.name,
      so_phan: d.qty,
      so_phan_ky_truoc: d.prevQty,
      doanh_thu: round(d.revenue),
      gia_ban_tb: round(d.avgPrice),
      gia_thap_nhat: d.minPrice,
      gia_cao_nhat: d.maxPrice,
    })),
    mon_chua_ban_duoc: r.unsold,
    doanh_thu_theo_moc: r.buckets.filter((b) => b.orders).map((b) => ({ moc: b.long, doanh_thu: round(b.revenue), so_don: b.orders })),
    theo_thoi_diem: r.segments.map((s) => ({
      thoi_diem: s.label,
      doanh_thu: round(s.revenue),
      so_don: s.orders,
      top_mon: s.top.map((t) => `${t.name} (${t.qty})`),
    })),
    theo_thu: r.weekdays.map((w) => ({ thu: w.label, doanh_thu: round(w.revenue), so_don: w.orders })),
    du_bao: {
      doanh_thu_du_kien_ca_ky: round(r.forecast.projected),
      trung_binh_3_ky_truoc: round(r.forecast.historyAvg),
      du_bao_ky_sau: round(r.forecast.nextForecast),
    },
  };
}
