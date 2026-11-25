// Dự báo trong tuần từ đơn đã đặt + gợi ý số nên làm. Xem docs/du-bao.md mục 5.
//
// 1. Đường nhận đơn: các tuần trước, tới cùng thời điểm này trong tuần (tính từ 0 giờ thứ Hai) thường đã có bao nhiêu %
//    số phần của cả tuần → f. Tuần này đã đặt S phần thì phần còn lại ước tính theo đơn = S·(1 − f)/f.
// 2. Trộn với dự báo theo mô hình (mức nền × hệ số) cho phần còn lại: tuần càng về cuối càng tin số đơn thật
//    (trọng số f cho đơn thật, 1 − f cho mô hình).
// 3. Số bán có dao động: dùng phân phối nhị thức âm (số đếm, dao động lớn hơn Poisson) để ra khoảng 80%
//    và số nên làm = mức mà xác suất đủ hàng bằng mức chủ quán chọn (bài toán người bán báo:
//    mức nên chọn = lãi mỗi phần ÷ (lãi mỗi phần + tiền mất khi phải bỏ phần dư)).
import { weekKey } from './forecast';
import { dishKey } from './dishKey';
import { saleDate } from './saleDate';

const WEEK = 7 * 86400000;
const CURVE_WEEKS = 8;
const keyDate = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Tỉ lệ số phần thường đã có tới thời điểm `now` trong tuần, học từ các tuần trước
export function orderCurve(orders, now) {
  const thisStart = keyDate(weekKey(now));
  const elapsed = now - thisStart;
  const weeks = new Map(); // key → { total, before }
  for (const o of orders) {
    if (o.status === 'cancelled' || !o.createdAt) continue;
    const created = new Date(o.createdAt);
    if (created >= thisStart) continue;
    const start = keyDate(weekKey(created));
    if (thisStart - start > CURVE_WEEKS * WEEK) continue;
    const qty = (o.items ?? []).reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const w = weeks.get(+start) ?? { total: 0, before: 0 };
    w.total += qty;
    if (created - start <= elapsed) w.before += qty;
    weeks.set(+start, w);
  }
  const used = [...weeks.values()].filter((w) => w.total > 0);
  if (used.length < 2) return { f: null, weeks: used.length };
  const total = used.reduce((s, w) => s + w.total, 0);
  const before = used.reduce((s, w) => s + w.before, 0);
  return { f: before / total, weeks: used.length };
}

// Phân vị của phân phối nhị thức âm có trung bình `mean`, phương sai `variance` (≤ trung bình thì dùng Poisson)
export function countQuantile(mean, variance, p) {
  if (!(mean > 0)) return 0;
  const v = Math.max(variance, mean);
  let pmf;
  let next;
  if (v <= mean * 1.02) {
    pmf = Math.exp(-mean);
    next = (k, pk) => (pk * mean) / (k + 1);
  } else {
    const r = (mean * mean) / (v - mean);
    const q = r / (r + mean);
    pmf = Math.exp(r * Math.log(q));
    next = (k, pk) => (pk * (k + r) * (1 - q)) / (k + 1);
  }
  let cdf = pmf;
  let k = 0;
  const cap = Math.ceil(mean * 20 + 200);
  while (cdf < p && k < cap) {
    pmf = next(k, pmf);
    k += 1;
    cdf += pmf;
  }
  return k;
}

export const SERVICE_LEVELS = [
  { id: 0.6, label: 'Ít dư', hint: 'món lãi thấp hoặc khó để lâu' },
  { id: 0.75, label: 'Cân bằng', hint: 'mặc định' },
  { id: 0.9, label: 'Ít hết hàng', hint: 'món lãi cao, để được vài ngày' },
];

// Bổ sung cho từng món của dự báo tuần: dự báo cả tuần có tính đơn đã đặt, khoảng 80%, số nên làm
export function nowcast({ forecast, orders, now, level = 0.75 }) {
  const curve = orderCurve(orders, now);
  const f = curve.f;
  const thisStart = keyDate(weekKey(now));

  // Món có trong dự báo, cộng món của ĐỢT GIAO này đã có đơn (khi chưa đủ tuần để dự
  // báo theo mô hình). "Đã đặt của đợt" tính theo tuần giao (saleDate) và khoá món
  // dishKey — phải khớp hệt khoá của weeklySeries/weeklyForecast (PR #80), nếu không
  // cùng một món sẽ thành hai dòng và số đã đặt bị tính thiếu biến thể có đuôi trọng lượng.
  const thisEnd = new Date(thisStart.getTime() + WEEK);
  const inRun = (o) => {
    if (o.status === 'cancelled' || !o.createdAt || new Date(o.createdAt) > now) return false;
    const d = saleDate(o);
    return d >= thisStart && d < thisEnd;
  };
  const items = new Map((forecast.items ?? []).map((it) => [it.key, { ...it }]));
  for (const o of orders) {
    if (!inRun(o)) continue;
    for (const i of o.items ?? []) {
      const k = dishKey(i.name ?? '');
      if (!k || items.has(k)) continue;
      items.set(k, { key: k, name: i.name, expected: null, low: null, high: null, soldSoFar: 0, reasons: [] });
    }
  }
  if (!forecast.ready) {
    for (const it of items.values()) {
      it.soldSoFar = orders
        .filter(inRun)
        .flatMap((o) => o.items ?? [])
        .filter((i) => dishKey(i.name ?? '') === it.key)
        .reduce((s, i) => s + (Number(i.qty) || 0), 0);
    }
  }

  const out = [];
  for (const it of items.values()) {
    const sold = it.soldSoFar ?? 0;
    const model = it.expected;
    const sd = it.high != null && it.low != null ? (it.high - it.low) / 2 : null;
    let remaining = null;
    if (f != null && f >= 0.05 && f < 0.999) {
      const byOrders = (sold * (1 - f)) / f;
      remaining = model != null ? f * byOrders + (1 - f) * Math.max(0, model * (1 - f)) : byOrders;
    } else if (f != null && f >= 0.999) remaining = 0;
    else if (model != null) remaining = Math.max(0, model - sold);
    if (remaining == null) {
      out.push({ ...it, total: null });
      continue;
    }
    const share = f != null ? 1 - f : 1;
    const variance = Math.max(remaining * 1.5, sd != null ? sd * sd * share : 0);
    const total = sold + remaining;
    out.push({
      ...it,
      total,
      p10: sold + countQuantile(remaining, variance, 0.1),
      p90: sold + countQuantile(remaining, variance, 0.9),
      make: sold + countQuantile(remaining, variance, level),
    });
  }
  out.sort((a, b) => (b.total ?? b.soldSoFar) - (a.total ?? a.soldSoFar));
  return { curve, level, items: out };
}
