// Tính toán cho tab Inventory Management: giá nhập, giá vốn món, tồn kho, lãi lỗ.
// Toàn bộ là hàm thuần (không gọi máy chủ) để dễ kiểm tra.
import { normalizeText } from './text.js';
import { orderTotal } from './stats.js';

export const UNITS = ['kg', 'g', 'lít', 'ml', 'cái', 'gói', 'hộp', 'túi', 'chai', 'bó', 'khay'];
export const EXPENSE_CATEGORIES = ['Bao bì', 'Xăng / vận chuyển', 'Điện nước', 'Thuê chỗ', 'Quảng cáo', 'Lương', 'Dụng cụ', 'Khác'];
export const ADJUST_REASONS = { count: 'Kiểm kho', waste: 'Hao hụt / hỏng', other: 'Khác' };

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

// Giá nhập trung bình theo tuần (thứ Hai → Chủ nhật), tính cả lần mua sale: tổng tiền ÷ tổng số lượng nhập trong tuần.
// Kết quả: Map nguyên liệu → [{ week: 'YYYY-MM-DD' (thứ Hai), avg, qty, total }] xếp theo tuần tăng dần.
export function weeklyPrices(purchases) {
  const byIng = new Map();
  for (const p of purchases) {
    if (!p.ingredientId || !(num(p.qty) > 0)) continue;
    const week = weekStartKey(p.date);
    const weeks = byIng.get(p.ingredientId) ?? new Map();
    const w = weeks.get(week) ?? { week, qty: 0, total: 0 };
    w.qty += num(p.qty);
    w.total += num(p.total);
    weeks.set(week, w);
    byIng.set(p.ingredientId, weeks);
  }
  const out = new Map();
  for (const [id, weeks] of byIng) {
    out.set(
      id,
      [...weeks.values()].sort((x, y) => x.week.localeCompare(y.week)).map((w) => ({ ...w, avg: w.total / w.qty })),
    );
  }
  return out;
}

// Giá của 1 nguyên liệu trong tuần `week`: trung bình tuần đó; tuần đó không mua thì lấy tuần gần nhất trước đó;
// chưa mua lần nào trước đó thì lấy tuần mua đầu tiên.
function priceInWeek(list, week) {
  if (!list?.length) return null;
  let found = null;
  for (const w of list) {
    if (w.week <= week) found = w;
    else break;
  }
  return (found ?? list[0]).avg;
}

// Bảng giá theo tuần: costsForWeek('YYYY-MM-DD' thứ Hai) → Map nguyên liệu → A$ / đơn vị. Có bộ nhớ đệm theo tuần.
export function costTable(purchases) {
  const weekly = weeklyPrices(purchases);
  const cache = new Map();
  return (week) => {
    if (!cache.has(week)) {
      const map = new Map();
      for (const [id, list] of weekly) map.set(id, priceInWeek(list, week));
      cache.set(week, map);
    }
    return cache.get(week);
  };
}

// Giá hiện tại của từng nguyên liệu: trung bình tuần này, hoặc tuần mua gần nhất. Chưa nhập lần nào: không có giá.
export function ingredientCosts(ingredients, purchases) {
  return costTable(purchases)(weekStartKey(dateKey()));
}

// Giá dùng để xem lãi mỗi món và định giá bán: "giá chuẩn" chủ quán đặt (giá thường, không tính sale) nếu có,
// không thì giá hiện tại.
export function standardCosts(ingredients, purchases) {
  const current = ingredientCosts(ingredients, purchases);
  const map = new Map(current);
  for (const ing of ingredients) if (num(ing.standardPrice) > 0) map.set(ing.id, num(ing.standardPrice));
  return map;
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

// ---------- Làm theo mẻ ----------
// Món "làm theo mẻ" (recipe.batch = true): nguyên liệu bị trừ khi ghi mẻ (số thật), còn mỗi phần bán ra trừ vào
// thành phẩm của món đó. Áp dụng cho các đơn tạo từ ngày recipe.batchSince; đơn trước đó vẫn trừ theo công thức.

// Thứ Hai đầu tuần chứa ngày `key` ('YYYY-MM-DD'): bật làm theo mẻ từ đầu tuần để tính cả đơn đặt trước trong tuần
export function weekStartKey(key) {
  const d = parseKey(key);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateKey(d);
}

function batchModes(recipes) {
  const modes = new Map();
  for (const r of recipes) if (r.batch && r.batchSince) modes.set(r.id, parseKey(r.batchSince));
  return modes;
}

// Món của dòng đơn này có tính theo mẻ không (đơn tạo từ ngày bật làm theo mẻ)
const batchSale = (modes, menuItem, created) => {
  const since = menuItem && modes.get(menuItem.id);
  return Boolean(since && created && created >= since);
};

// Chi phí 1 mẻ theo giá nhập hiện tại. missing: nguyên liệu chưa có giá nhập.
export function batchCost(batch, costs, ingredientsById) {
  let cost = num(batch?.extraCost);
  const missing = [];
  for (const line of batch?.lines ?? []) {
    const ing = ingredientsById.get(line.ingredientId);
    if (!ing) continue;
    const unitCost = costs.get(ing.id);
    if (unitCost == null) missing.push(ing.name);
    else cost += convertQty(line.qty, line.unit, ing.unit) * unitCost;
  }
  return { cost, missing };
}

// Giá vốn 1 phần của món làm theo mẻ (chưa gồm chi phí hộp, túi) cho phần bán trong tuần `week`: lấy các mẻ trong cùng tuần,
// tuần đó không có mẻ thì lấy tuần có mẻ gần nhất. Mỗi mẻ tính theo giá nhập trung bình của tuần làm mẻ. null: chưa có mẻ.
export function batchUnitCost(productId, week, batches, costsForWeek, ingredientsById) {
  const groups = new Map();
  for (const b of batches) {
    if (b.productId !== productId || !(num(b.output) > 0)) continue;
    const w = weekStartKey(b.date);
    groups.set(w, [...(groups.get(w) ?? []), b]);
  }
  if (!groups.size) return null;
  const dist = (w) => Math.abs(parseKey(w) - parseKey(week));
  const chosen = [...groups.keys()].sort((x, y) => dist(x) - dist(y) || x.localeCompare(y))[0];
  const missing = new Set();
  let cost = 0;
  let output = 0;
  for (const b of groups.get(chosen)) {
    const c = batchCost(b, costsForWeek(weekStartKey(b.date)), ingredientsById);
    cost += c.cost;
    output += num(b.output);
    c.missing.forEach((m) => missing.add(m));
  }
  return { cost: cost / output, missing: [...missing], week: chosen };
}

// Ngày bắt đầu theo dõi kho của từng nguyên liệu: bút toán nhập / điều chỉnh đầu tiên
function trackingStarts(purchases, adjustments) {
  const starts = new Map();
  for (const e of [...purchases, ...adjustments]) {
    if (!e.ingredientId) continue;
    const d = parseKey(e.date);
    const cur = starts.get(e.ingredientId);
    if (!cur || d < cur) starts.set(e.ingredientId, d);
  }
  return starts;
}

// Tồn kho nguyên liệu = nhập + điều chỉnh (kiểm kho, hao hụt) − dùng cho đơn bán (theo công thức) − dùng cho các mẻ,
// tính từ ngày có bút toán đầu tiên của nguyên liệu đó.
export function stockLevels({ ingredients, purchases, adjustments, orders, menu, recipes, batches = [] }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const modes = batchModes(recipes);
  const startByIng = trackingStarts(purchases, adjustments);
  const byName = menuKey(menu);
  const used = new Map();
  const add = (id, qty) => used.set(id, (used.get(id) ?? 0) + qty);
  for (const order of live(orders)) {
    const created = order.createdAt ? new Date(order.createdAt) : null;
    for (const item of order.items ?? []) {
      const menuItem = byName.get(normalizeText(item.name ?? ''));
      if (batchSale(modes, menuItem, created)) continue; // trừ vào thành phẩm, không trừ nguyên liệu
      for (const line of recipesById.get(menuItem?.id)?.lines ?? []) {
        const ing = ingById.get(line.ingredientId);
        const start = startByIng.get(line.ingredientId);
        if (!ing || !start || !created || created < start) continue;
        add(ing.id, convertQty(line.qty, line.unit, ing.unit) * num(item.qty));
      }
    }
  }
  for (const b of batches) {
    const day = parseKey(b.date);
    for (const line of b.lines ?? []) {
      const ing = ingById.get(line.ingredientId);
      const start = startByIng.get(line.ingredientId);
      if (!ing || !start || day < start) continue;
      add(ing.id, convertQty(line.qty, line.unit, ing.unit));
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

// Thành phẩm của các món làm theo mẻ: đã làm − đã bán / đã đặt + điều chỉnh (bỏ đi). Âm = còn phải làm thêm cho đơn.
export function productLevels({ menu, recipes, batches, orders, adjustments, ingredients, purchases }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const costsForWeek = costTable(purchases);
  const thisWeek = weekStartKey(dateKey());
  const modes = batchModes(recipes);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const byName = menuKey(menu);
  const sold = new Map();
  const pending = new Map();
  for (const order of live(orders)) {
    const created = order.createdAt ? new Date(order.createdAt) : null;
    for (const item of order.items ?? []) {
      const menuItem = byName.get(normalizeText(item.name ?? ''));
      if (!batchSale(modes, menuItem, created)) continue;
      sold.set(menuItem.id, (sold.get(menuItem.id) ?? 0) + num(item.qty));
      if (order.status === 'pending') pending.set(menuItem.id, (pending.get(menuItem.id) ?? 0) + num(item.qty));
    }
  }
  return menu
    .filter((m) => modes.has(m.id))
    .map((m) => {
      const since = modes.get(m.id);
      const produced = batches
        .filter((b) => b.productId === m.id && parseKey(b.date) >= since)
        .reduce((s, b) => s + num(b.output), 0);
      const adjusted = adjustments.filter((a) => a.productId === m.id).reduce((s, a) => s + num(a.qty), 0);
      const soldQty = sold.get(m.id) ?? 0;
      const stock = Math.round((produced + adjusted - soldQty) * 1000) / 1000;
      const unit = batchUnitCost(m.id, thisWeek, batches, costsForWeek, ingById);
      return {
        menuItem: m,
        recipe: recipesById.get(m.id),
        since: recipesById.get(m.id).batchSince,
        produced,
        sold: soldQty,
        pending: pending.get(m.id) ?? 0,
        stock,
        toMake: stock < 0 ? -stock : 0,
        unitCost: unit ? unit.cost + num(recipesById.get(m.id).extra) : null,
        missing: unit?.missing ?? [],
      };
    });
}

// Nguyên liệu cho 1 phần món: theo mẻ gần nhất (nếu có) cho sát thực tế, không thì theo công thức
function perPortionLines(productId, batches, recipe) {
  const last = batches
    .filter((b) => b.productId === productId && num(b.output) > 0)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  if (last) return (last.lines ?? []).map((l) => ({ ...l, qty: num(l.qty) / num(last.output) }));
  return recipe?.lines ?? [];
}

// Danh sách đi chợ cho các đơn chưa làm (trạng thái Chờ xử lý):
// - món theo công thức: nguyên liệu của đơn đã được trừ trong tồn kho, nên chỉ cần bù phần âm và giữ mức tối thiểu;
// - món làm theo mẻ: phần còn phải làm thêm × nguyên liệu mỗi phần (theo mẻ gần nhất).
export function shoppingList(data) {
  const { ingredients, purchases, adjustments, orders, menu, recipes, batches = [] } = data;
  const levels = stockLevels(data);
  const products = productLevels(data);
  const priceFor = standardCosts(ingredients, purchases); // ước tính tiền đi chợ theo giá thường
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const modes = batchModes(recipes);
  const byName = menuKey(menu);

  const forPending = new Map(); // nguyên liệu cần cho đơn chưa làm (món theo công thức)
  const forBatches = new Map(); // nguyên liệu cần cho phần món phải làm thêm
  const add = (map, id, qty) => map.set(id, (map.get(id) ?? 0) + qty);
  for (const order of live(orders).filter((o) => o.status === 'pending')) {
    const created = order.createdAt ? new Date(order.createdAt) : null;
    for (const item of order.items ?? []) {
      const menuItem = byName.get(normalizeText(item.name ?? ''));
      if (!menuItem || batchSale(modes, menuItem, created)) continue;
      for (const line of recipesById.get(menuItem.id)?.lines ?? []) {
        const ing = ingById.get(line.ingredientId);
        if (ing) add(forPending, ing.id, convertQty(line.qty, line.unit, ing.unit) * num(item.qty));
      }
    }
  }
  for (const p of products) {
    if (!p.toMake) continue;
    for (const line of perPortionLines(p.menuItem.id, batches, p.recipe)) {
      const ing = ingById.get(line.ingredientId);
      if (ing) add(forBatches, ing.id, convertQty(line.qty, line.unit, ing.unit) * p.toMake);
    }
  }

  const rows = levels
    .map((l) => {
      const id = l.ingredient.id;
      const needOrders = (forPending.get(id) ?? 0) + (forBatches.get(id) ?? 0);
      // Đã theo dõi kho: tồn kho đã trừ đơn theo công thức, chỉ trừ thêm phần cho mẻ. Chưa theo dõi: coi như kho trống.
      const after = l.tracked ? l.stock - (forBatches.get(id) ?? 0) : -needOrders;
      const min = num(l.ingredient.minStock);
      const toBuy = Math.max(0, Math.round((min - after) * 1000) / 1000);
      return {
        ingredient: l.ingredient,
        needOrders,
        stockNow: l.tracked ? l.stock + (forPending.get(id) ?? 0) : 0,
        after,
        toBuy,
        estCost: priceFor.get(id) != null ? toBuy * priceFor.get(id) : null,
      };
    })
    .filter((r) => r.needOrders > 0 || r.toBuy > 0)
    .sort((a, b) => b.toBuy - a.toBuy || a.ingredient.name.localeCompare(b.ingredient.name, 'vi'));

  const pendingOrders = live(orders).filter((o) => o.status === 'pending').length;
  return {
    rows,
    makeMore: products.filter((p) => p.toMake > 0),
    pendingOrders,
    estTotal: rows.reduce((s, r) => s + (r.estCost ?? 0), 0),
    unknownPrice: rows.filter((r) => r.toBuy > 0 && r.estCost == null).map((r) => r.ingredient.name),
  };
}

// Lãi lỗ trong khoảng [start, end): doanh thu − giá vốn − chi phí khác. Thời điểm bán = lúc tạo đơn (giống tab Báo cáo).
// Giá nguyên liệu = giá nhập trung bình của tuần bán (có tính sale). Món làm theo mẻ = chi phí thật của mẻ cùng tuần / số phần;
// món khác theo công thức.
export function profitReport({ range, orders, menu, recipes, ingredients, purchases, expenses, batches = [] }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const costsForWeek = costTable(purchases); // giá trung bình từng tuần, có tính lần mua sale
  const modes = batchModes(recipes);
  const byName = menuKey(menu);
  const inRange = (d) => d >= range.start && d < range.end;
  const unitCache = new Map();
  const batchUnit = (id, week) => {
    const key = `${id}|${week}`;
    if (!unitCache.has(key)) unitCache.set(key, batchUnitCost(id, week, batches, costsForWeek, ingById));
    return unitCache.get(key);
  };

  const sold = live(orders).filter((o) => inRange(new Date(o.createdAt)));
  const revenue = sold.reduce((s, o) => s + orderTotal(o), 0);

  const dishes = new Map();
  const noRecipe = new Set();
  const noPrice = new Set();
  let cogs = 0;
  for (const order of sold) {
    const created = new Date(order.createdAt);
    const week = weekStartKey(dateKey(created));
    for (const item of order.items ?? []) {
      const menuItem = byName.get(normalizeText(item.name ?? ''));
      const recipe = recipesById.get(menuItem?.id);
      let unitCost;
      let known;
      const unit = batchSale(modes, menuItem, created) ? batchUnit(menuItem.id, week) : null;
      if (unit) {
        unitCost = unit.cost + num(recipe?.extra);
        unit.missing.forEach((n) => noPrice.add(n));
        known = true;
      } else {
        const rc = recipeCost(recipe, costsForWeek(week), ingById);
        rc.missing.forEach((n) => noPrice.add(n));
        unitCost = rc.cost;
        known = rc.hasRecipe;
      }
      if (!known) noRecipe.add(item.name);
      const qty = num(item.qty);
      const lineCost = unitCost * qty;
      cogs += lineCost;
      const row = dishes.get(item.name) ?? { name: item.name, qty: 0, revenue: 0, cost: 0, hasRecipe: known };
      row.qty += qty;
      row.revenue += num(item.price) * qty;
      row.cost += lineCost;
      row.hasRecipe = row.hasRecipe || known;
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
