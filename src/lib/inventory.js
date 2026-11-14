// Tính toán cho tab Inventory Management: giá nhập, giá vốn món, tồn kho, lãi lỗ.
// Toàn bộ là hàm thuần (không gọi máy chủ) để dễ kiểm tra.
import { normalizeText } from './text.js';
import { orderTotal } from './stats.js';

export const UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'gói', 'hộp', 'túi', 'chai', 'bó', 'khay'];
export const EXPENSE_CATEGORIES = ['Bao bì', 'Xăng / vận chuyển', 'Điện nước', 'Thuê chỗ', 'Quảng cáo', 'Lương', 'Dụng cụ', 'Khác'];
export const ADJUST_REASONS = { count: 'Kiểm kho', waste: 'Hao hụt / hỏng', other: 'Khác' };

const PRICE_WINDOW = 5; // giá nhập tính theo trung bình có trọng số của 5 lần nhập gần nhất
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// 'YYYY-MM-DD' theo giờ máy
export const dateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// 'YYYY-MM-DD' -> Date lúc 00:00 giờ máy
export const parseKey = (k) => {
  const [y, m, d] = String(k).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
export const fmtKey = (k) => String(k).split('-').reverse().join('/');

// Đơn vị cùng nhóm đổi được cho nhau: g ↔ kg, ml ↔ lít
const FACTOR = { 'g>kg': 0.001, 'kg>g': 1000, 'ml>lít': 0.001, 'lít>ml': 1000 };
export const compatibleUnits = (unit) => {
  if (unit === 'kg' || unit === 'g') return ['g', 'kg'];
  if (unit === 'lít' || unit === 'ml') return ['ml', 'lít'];
  return [unit];
};
// Đổi `qty` từ đơn vị `from` sang đơn vị của nguyên liệu `to`
export const convertQty = (qty, from, to) => (!from || from === to ? num(qty) : num(qty) * (FACTOR[`${from}>${to}`] ?? 1));

// Giá nhập hiện tại của từng nguyên liệu (A$ trên 1 đơn vị). Chưa nhập lần nào: không có giá.
export function ingredientCosts(ingredients, purchases) {
  const costs = new Map();
  for (const ing of ingredients) {
    const recent = purchases
      .filter((p) => p.ingredientId === ing.id && num(p.qty) > 0)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .slice(0, PRICE_WINDOW);
    const qty = recent.reduce((s, p) => s + num(p.qty), 0);
    if (qty > 0) costs.set(ing.id, recent.reduce((s, p) => s + num(p.total), 0) / qty);
  }
  return costs;
}

// Giá vốn 1 phần của món theo công thức. missing: nguyên liệu trong công thức chưa có giá nhập.
export function recipeCost(recipe, costs, ingredientsById) {
  let cost = num(recipe?.extra);
  const missing = [];
  for (const line of recipe?.lines ?? []) {
    const ing = ingredientsById.get(line.ingredientId);
    if (!ing) continue;
    const unitCost = costs.get(ing.id);
    if (unitCost == null) missing.push(ing.name);
    else cost += convertQty(line.qty, line.unit, ing.unit) * unitCost;
  }
  return { cost, missing, hasRecipe: Boolean(recipe && (recipe.lines?.length || num(recipe.extra) > 0)) };
}

// Tìm món trong thực đơn theo tên ghi trên đơn
const menuKey = (menu) => new Map(menu.map((m) => [normalizeText(m.name), m]));

const live = (orders) => orders.filter((o) => o.status !== 'cancelled');


// Tồn kho = nhập + điều chỉnh (kiểm kho, hao hụt) − đã dùng cho đơn bán, tính từ ngày có bút toán đầu tiên của nguyên liệu đó
export function stockLevels({ ingredients, purchases, adjustments, orders, menu, recipes }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const startByIng = new Map();
  for (const e of [...purchases, ...adjustments]) {
    const d = parseKey(e.date);
    const cur = startByIng.get(e.ingredientId);
    if (!cur || d < cur) startByIng.set(e.ingredientId, d);
  }
  const byName = menuKey(menu);
  const used = new Map();
  for (const order of live(orders)) {
    const created = order.createdAt ? new Date(order.createdAt) : null;
    for (const item of order.items ?? []) {
      const recipe = recipesById.get(byName.get(normalizeText(item.name ?? ''))?.id);
      for (const line of recipe?.lines ?? []) {
        const ing = ingById.get(line.ingredientId);
        const start = startByIng.get(line.ingredientId);
        if (!ing || !start || !created || created < start) continue;
        used.set(ing.id, (used.get(ing.id) ?? 0) + convertQty(line.qty, line.unit, ing.unit) * num(item.qty));
      }
    }
  }
  const costs = ingredientCosts(ingredients, purchases);
  return ingredients.map((ing) => {
    const bought = purchases.filter((p) => p.ingredientId === ing.id).reduce((s, p) => s + num(p.qty), 0);
    const adjusted = adjustments.filter((a) => a.ingredientId === ing.id).reduce((s, a) => s + num(a.qty), 0);
    const usedQty = used.get(ing.id) ?? 0;
    const stock = Math.round((bought + adjusted - usedQty) * 1000) / 1000;
    const unitCost = costs.get(ing.id) ?? null;
    const min = num(ing.minStock);
    return {
      ingredient: ing,
      stock,
      used: usedQty,
      unitCost,
      value: unitCost != null && stock > 0 ? stock * unitCost : 0,
      tracked: startByIng.has(ing.id),
      low: min > 0 && stock <= min,
      negative: stock < 0,
    };
  });
}

// Lãi lỗ trong khoảng [start, end): doanh thu − giá vốn − chi phí khác. Thời điểm bán = lúc tạo đơn (giống tab Báo cáo).
export function profitReport({ range, orders, menu, recipes, ingredients, purchases, expenses }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const costs = ingredientCosts(ingredients, purchases);
  const byName = menuKey(menu);
  const inRange = (iso) => iso >= range.start && iso < range.end;

  const sold = live(orders).filter((o) => inRange(new Date(o.createdAt)));
  const revenue = sold.reduce((s, o) => s + orderTotal(o), 0);

  const dishes = new Map();
  const noRecipe = new Set();
  const noPrice = new Set();
  let cogs = 0;
  for (const order of sold) {
    for (const item of order.items ?? []) {
      const menuItem = byName.get(normalizeText(item.name ?? ''));
      const recipe = recipesById.get(menuItem?.id);
      const rc = recipeCost(recipe, costs, ingById);
      if (!rc.hasRecipe) noRecipe.add(item.name);
      rc.missing.forEach((n) => noPrice.add(n));
      const qty = num(item.qty);
      const lineCost = rc.cost * qty;
      cogs += lineCost;
      const row = dishes.get(item.name) ?? { name: item.name, qty: 0, revenue: 0, cost: 0, hasRecipe: rc.hasRecipe };
      row.qty += qty;
      row.revenue += num(item.price) * qty;
      row.cost += lineCost;
      dishes.set(item.name, row);
    }
  }

  const dateIn = (e) => inRange(parseKey(e.date));
  const periodExpenses = expenses.filter(dateIn);
  const otherCosts = periodExpenses.reduce((s, e) => s + num(e.amount), 0);
  const byCategory = new Map();
  for (const e of periodExpenses) byCategory.set(e.category || 'Khác', (byCategory.get(e.category || 'Khác') ?? 0) + num(e.amount));
  const bought = purchases.filter(dateIn).reduce((s, p) => s + num(p.total), 0);

  const profit = revenue - cogs - otherCosts;
  return {
    revenue,
    cogs,
    otherCosts,
    profit,
    margin: revenue > 0 ? profit / revenue : null,
    cashIn: revenue,
    cashOut: bought + otherCosts,
    cashNet: revenue - bought - otherCosts,
    bought,
    orders: sold.length,
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    dishes: [...dishes.values()].map((d) => ({ ...d, profit: d.revenue - d.cost })).sort((a, b) => b.profit - a.profit),
    noRecipe: [...noRecipe],
    noPrice: [...noPrice],
  };
}
