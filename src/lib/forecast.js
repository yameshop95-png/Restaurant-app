// Dự báo tuần này khách sẽ mua món nào nhiều, chỉ từ dữ liệu bán của chính quán (không gọi dịch vụ ngoài).
//
// Cách tính, cho từng món:
//   mức nền   = trung bình có trọng số 4 tuần đã xong gần nhất (tuần gần nặng hơn: 4, 3, 2, 1)
//   × hệ số tuần trong tháng (tuần 1..5: dịp lĩnh lương, đầu / cuối tháng)
//   × hệ số mùa (hè / thu / đông / xuân ở Úc)
//   × hệ số thời tiết (chủ quán chọn mỗi tuần: Nóng / Mát / Lạnh / Mưa)
// Mỗi hệ số = (bán trung bình trong các tuần cùng điều kiện) ÷ (bán trung bình mọi tuần), kéo về 1 khi còn ít tuần
// (co rút: (n × hệ số + K) ÷ (n + K)), nên vài tuần lẻ không làm dự báo nhảy lung tung.
// Nghiên cứu về bán hàng nhà hàng cho thấy nhiệt độ là yếu tố thời tiết ảnh hưởng mạnh nhất; mưa ít ảnh hưởng tới doanh số.
import { normalizeText } from './text';
import { periodRange } from './report';

export const WEATHER = [
  { id: 'hot', label: 'Nóng' },
  { id: 'mild', label: 'Mát' },
  { id: 'cold', label: 'Lạnh' },
  { id: 'rain', label: 'Mưa' },
];
const SEASON_LABEL = { summer: 'mùa hè', autumn: 'mùa thu', winter: 'mùa đông', spring: 'mùa xuân' };
// Tết Nguyên Đán (mùng 1)
const TET = ['2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23'];
const K = 4; // độ co rút về 1
const MIN_WEEKS = 3;
const DAY = 86400000;

const pad = (n) => String(n).padStart(2, '0');
export const weekKey = (d) => {
  const s = periodRange('week', d).start;
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}`;
};
const keyDate = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
// Tuần thứ mấy trong tháng, theo ngày thứ Năm của tuần (tuần thuộc tháng có nhiều ngày hơn)
const weekOfMonth = (start) => {
  const thu = new Date(start.getTime() + 3 * DAY);
  return Math.min(5, Math.ceil(thu.getDate() / 7));
};
const season = (start) => {
  const m = new Date(start.getTime() + 3 * DAY).getMonth();
  return m === 11 || m <= 1 ? 'summer' : m <= 4 ? 'autumn' : m <= 7 ? 'winter' : 'spring';
};
const pct = (f) => `${f >= 1 ? '+' : '−'}${Math.round(Math.abs(f - 1) * 100)}%`;

export function weeklyForecast({ orders, now, weatherLog = {} }) {
  const thisKey = weekKey(now);
  const thisStart = keyDate(thisKey);

  // Số phần bán mỗi tuần, mỗi món (bỏ đơn huỷ)
  const byWeek = new Map(); // weekKey -> Map(nameKey -> qty)
  const names = new Map(); // nameKey -> tên hiển thị gần nhất
  for (const o of orders) {
    if (o.status === 'cancelled' || !o.createdAt) continue;
    const wk = weekKey(new Date(o.createdAt));
    const row = byWeek.get(wk) ?? new Map();
    for (const it of o.items ?? []) {
      const k = normalizeText(it.name ?? '');
      if (!k) continue;
      row.set(k, (row.get(k) ?? 0) + (Number(it.qty) || 0));
      names.set(k, it.name);
    }
    byWeek.set(wk, row);
  }
  const soldThisWeek = byWeek.get(thisKey) ?? new Map();

  // Các tuần đã xong, từ tuần có đơn đầu tiên tới tuần trước (tuần không có đơn tính là 0)
  const done = [...byWeek.keys()].filter((k) => k < thisKey).sort();
  const weeks = [];
  if (done.length) {
    for (let d = keyDate(done[0]); d < thisStart; d = new Date(d.getTime() + 7 * DAY)) {
      const k = weekKey(d);
      weeks.push({ key: k, start: keyDate(k), qty: byWeek.get(k) ?? new Map() });
    }
  }

  const notes = [];
  const tet = TET.map(keyDate).find((t) => t >= thisStart && t - thisStart <= 28 * DAY);
  if (tet) notes.push(`Còn ${Math.max(0, Math.round((tet - now) / DAY))} ngày nữa là Tết (${tet.getDate()}/${tet.getMonth() + 1}): nhớ chuẩn bị bánh chưng, bánh tét.`);

  if (weeks.length < MIN_WEEKS) {
    return { ready: false, weeksUsed: weeks.length, minWeeks: MIN_WEEKS, items: [], notes, weekStart: thisStart };
  }

  const wom = weekOfMonth(thisStart);
  const sea = season(thisStart);
  const weather = weatherLog[thisKey] ?? null;
  const recent = weeks.slice(-4);
  const W = [1, 2, 3, 4].slice(-recent.length);

  // Hệ số cho một nhóm tuần cùng điều kiện, đã co rút về 1
  const factor = (k, same) => {
    if (same.length === 0) return { f: 1, n: 0 };
    const all = weeks.reduce((s, w) => s + (w.qty.get(k) ?? 0), 0) / weeks.length;
    if (all <= 0) return { f: 1, n: same.length };
    const raw = same.reduce((s, w) => s + (w.qty.get(k) ?? 0), 0) / same.length / all;
    return { f: (same.length * raw + K) / (same.length + K), n: same.length };
  };
  const sameWom = weeks.filter((w) => weekOfMonth(w.start) === wom);
  const seasons = new Set(weeks.map((w) => season(w.start)));
  const sameSeason = seasons.size > 1 ? weeks.filter((w) => season(w.start) === sea) : [];
  const sameWeather = weather ? weeks.filter((w) => weatherLog[w.key] === weather) : [];

  const items = [];
  for (const [k, label] of names) {
    const base = recent.reduce((s, w, i) => s + (w.qty.get(k) ?? 0) * W[i], 0) / W.reduce((a, b) => a + b, 0);
    if (base <= 0 && !(soldThisWeek.get(k) > 0)) continue;
    const fW = factor(k, sameWom);
    const fS = factor(k, sameSeason);
    const fX = factor(k, sameWeather);
    const expected = base * fW.f * fS.f * fX.f;
    const last8 = weeks.slice(-8).map((w) => w.qty.get(k) ?? 0);
    const mean = last8.reduce((a, b) => a + b, 0) / last8.length;
    const sd = Math.sqrt(last8.reduce((s, x) => s + (x - mean) ** 2, 0) / last8.length);
    const reasons = [`4 tuần gần đây: khoảng ${Math.round(base * 10) / 10} phần/tuần`];
    if (fW.n && Math.abs(fW.f - 1) >= 0.08) reasons.push(`Tuần ${wom} trong tháng thường bán ${pct(fW.f)}`);
    if (fS.n && Math.abs(fS.f - 1) >= 0.08) reasons.push(`${SEASON_LABEL[sea]} thường bán ${pct(fS.f)}`);
    if (fX.n && Math.abs(fX.f - 1) >= 0.08) {
      const wl = WEATHER.find((x) => x.id === weather)?.label.toLowerCase();
      reasons.push(`Khi trời ${wl} thường bán ${pct(fX.f)} (${fX.n} tuần)`);
    }
    items.push({
      key: k,
      name: label,
      expected,
      low: Math.max(0, expected - sd),
      high: expected + sd,
      base,
      change: base > 0 ? expected / base : null,
      soldSoFar: soldThisWeek.get(k) ?? 0,
      reasons,
    });
  }
  items.sort((a, b) => b.expected - a.expected);
  return {
    ready: true,
    weeksUsed: weeks.length,
    weekStart: thisStart,
    weekOfMonth: wom,
    season: SEASON_LABEL[sea],
    weather,
    weatherWeeks: sameWeather.length,
    items,
    notes,
  };
}
