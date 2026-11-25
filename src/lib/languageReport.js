// Báo cáo khách theo ngôn ngữ: đơn đặt trên website ghi ngôn ngữ khách dùng (order.lang = 'vi' | 'en').
// Đơn tạo trong app (nhân viên nhập) không có ngôn ngữ. Không suy đoán dân tộc từ tên khách.
import { orderTotal } from './stats';
import { dishKey } from './dishKey';
import { saleDate } from './saleDate';

export const LANG_GROUPS = [
  { id: 'vi', label: 'Website · tiếng Việt' },
  { id: 'en', label: 'Website · tiếng Anh' },
  { id: 'app', label: 'Tạo trong app' },
];
export const groupOf = (o) => (o.source === 'web' || o.lang ? (o.lang === 'en' ? 'en' : 'vi') : 'app');
const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const emptyGroup = () => ({ orders: 0, revenue: 0, dishes: new Map() });

// Gộp theo tháng: [{ month: '2026-11', groups: { vi, en, app }, total }]
export function languageByMonth(orders) {
  const months = new Map();
  for (const o of orders) {
    if (o.status === 'cancelled' || (!o.createdAt && !o.deliverAt)) continue;
    const mk = monthKey(saleDate(o));
    const m = months.get(mk) ?? { month: mk, groups: { vi: emptyGroup(), en: emptyGroup(), app: emptyGroup() } };
    const g = m.groups[groupOf(o)];
    g.orders += 1;
    g.revenue += orderTotal(o);
    for (const it of o.items ?? []) {
      const k = dishKey(it.name ?? '');
      if (!k) continue;
      const row = g.dishes.get(k) ?? { name: it.name, qty: 0 };
      row.qty += Number(it.qty) || 0;
      g.dishes.set(k, row);
    }
    months.set(mk, m);
  }
  return [...months.values()].sort((a, b) => a.month.localeCompare(b.month));
}

// Tóm tắt trong khoảng [start, end): số đơn, doanh thu, tỉ lệ và 3 món bán nhiều nhất mỗi nhóm
export function languageSummary(orders, range) {
  const groups = { vi: emptyGroup(), en: emptyGroup(), app: emptyGroup() };
  for (const o of orders) {
    if (o.status === 'cancelled' || (!o.createdAt && !o.deliverAt)) continue;
    const d = saleDate(o);
    if (d < range.start || d >= range.end) continue;
    const g = groups[groupOf(o)];
    g.orders += 1;
    g.revenue += orderTotal(o);
    for (const it of o.items ?? []) {
      const k = dishKey(it.name ?? '');
      if (!k) continue;
      const row = g.dishes.get(k) ?? { name: it.name, qty: 0 };
      row.qty += Number(it.qty) || 0;
      g.dishes.set(k, row);
    }
  }
  const web = groups.vi.orders + groups.en.orders;
  return {
    web,
    total: web + groups.app.orders,
    enShareOfWeb: web ? groups.en.orders / web : null,
    groups: Object.fromEntries(
      Object.entries(groups).map(([id, g]) => [
        id,
        { orders: g.orders, revenue: g.revenue, top: [...g.dishes.values()].sort((a, b) => b.qty - a.qty).slice(0, 3) },
      ]),
    ),
  };
}
