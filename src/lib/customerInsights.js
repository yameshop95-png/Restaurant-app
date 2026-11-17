// Xác suất theo từng khách và món hay mua kèm, chỉ từ đơn hàng của quán.
//
// 1. Món khách hay mua: P(món) = (Σ w·[đơn có món] + 0,5) ÷ (Σ w + 1), w = 0,8^i (i = 0 là đơn gần nhất) —
//    đơn gần đây nặng hơn, và làm mượt để khách mới 1–2 đơn không bị 100% / 0%.
// 2. Khả năng đặt trong 7 ngày tới: đã t ngày từ đơn cuối; trong các khoảng cách giữa hai đơn của khách,
//    P = (số khoảng nằm trong (t, t + 7] + 0,5) ÷ (số khoảng > t + 1). Đã quá mọi khoảng cũ thì giảm dần theo
//    exp(−quá hạn ÷ khoảng thường lệ) (khách có thể đã thôi mua).
// 3. Món hay mua kèm: lift(A → B) = P(B | có A) ÷ P(B). Chỉ lấy cặp xuất hiện ≥ 3 đơn và lift ≥ 1,2.
import { normalizeText } from './text';

const DAY = 86400000;
const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function customerProfile(orders, now = new Date()) {
  const list = orders
    .filter((o) => o.status !== 'cancelled' && o.createdAt)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // mới nhất trước
  if (!list.length) return null;

  // Món hay mua
  const weight = new Map();
  const names = new Map();
  let total = 0;
  list.forEach((o, i) => {
    const w = 0.8 ** i;
    total += w;
    const seen = new Set();
    for (const it of o.items ?? []) {
      const k = normalizeText(it.name ?? '');
      if (!k || seen.has(k)) continue;
      seen.add(k);
      names.set(k, it.name);
      weight.set(k, (weight.get(k) ?? 0) + w);
    }
  });
  const dishes = [...weight.entries()]
    .map(([k, w]) => ({ key: k, name: names.get(k), p: (w + 0.5) / (total + 1) }))
    .sort((a, b) => b.p - a.p);

  // Khoảng cách giữa các đơn (ngày), đơn cùng ngày tính là một lần
  const days = [...new Set(list.map((o) => Math.floor(new Date(o.createdAt).getTime() / DAY)))].sort((a, b) => b - a);
  const intervals = days.slice(0, -1).map((d, i) => d - days[i + 1]);
  const since = Math.floor((now - new Date(list[0].createdAt)) / DAY);
  const typical = median(intervals);
  let next7 = null;
  if (intervals.length) {
    const longer = intervals.filter((iv) => iv > since);
    if (longer.length) {
      const inWindow = longer.filter((iv) => iv <= since + 7).length;
      next7 = (inWindow + 0.5) / (longer.length + 1);
    } else {
      const overdue = since - Math.max(...intervals);
      next7 = 0.5 * Math.exp(-overdue / Math.max(typical, 1));
    }
  }
  return {
    count: list.length,
    lastAt: list[0].createdAt,
    since,
    typical,
    next7,
    due: typical != null && since >= typical,
    dishes,
  };
}

// Cặp món hay mua kèm, từ mọi đơn (không tính đơn huỷ)
export function pairLift(orders, { minSupport = 3, minLift = 1.2 } = {}) {
  const baskets = orders
    .filter((o) => o.status !== 'cancelled')
    .map((o) => [...new Set((o.items ?? []).map((i) => normalizeText(i.name ?? '')).filter(Boolean))]);
  const n = baskets.length;
  if (!n) return [];
  const names = new Map();
  for (const o of orders) for (const i of o.items ?? []) names.set(normalizeText(i.name ?? ''), i.name);
  const single = new Map();
  const pair = new Map();
  for (const b of baskets) {
    for (const a of b) single.set(a, (single.get(a) ?? 0) + 1);
    for (const a of b) for (const c of b) if (a !== c) pair.set(`${a}|${c}`, (pair.get(`${a}|${c}`) ?? 0) + 1);
  }
  const out = [];
  for (const [k, both] of pair) {
    if (both < minSupport) continue;
    const [a, c] = k.split('|');
    const conf = both / single.get(a);
    const lift = conf / (single.get(c) / n);
    if (lift >= minLift) out.push({ from: a, to: c, fromName: names.get(a), toName: names.get(c), both, conf, lift });
  }
  return out.sort((x, y) => y.lift - x.lift || y.both - x.both);
}

// Gợi ý cho website: id món → tối đa 3 id món hay mua kèm (lưu trong webOrdering.pairs)
export function pairsForWebsite(pairs, menu) {
  const idOf = new Map(menu.map((m) => [normalizeText(m.name), m.id]));
  const out = {};
  for (const p of pairs) {
    const from = idOf.get(p.from);
    const to = idOf.get(p.to);
    if (!from || !to) continue;
    out[from] ??= [];
    if (out[from].length < 3 && !out[from].includes(to)) out[from].push(to);
  }
  return out;
}
