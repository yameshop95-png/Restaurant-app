// Phân loại món theo lãi và độ phổ biến (menu engineering, Kasavana & Smith, Michigan State University, 1982).
//   Lãi mỗi phần (contribution margin) = giá bán − giá vốn một phần
//   Tỉ lệ bán (menu mix) = số phần món đó ÷ tổng số phần mọi món
//   Món "phổ biến" khi tỉ lệ bán ≥ 70% × (1 ÷ số món)
//   Món "lãi cao" khi lãi mỗi phần ≥ lãi trung bình mỗi phần (bình quân theo số phần bán)
// Chỉ món có công thức (biết giá vốn) mới phân loại được; món còn lại trả về trong `unknown`.
export const CLASSES = {
  star: { label: 'Ngôi sao', hint: 'Bán chạy, lãi cao: giữ nguyên, đưa lên đầu', tone: 'text-orange-300' },
  plowhorse: { label: 'Bán chạy, lãi thấp', hint: 'Xem lại giá bán hoặc giá vốn', tone: 'text-amber-500' },
  puzzle: { label: 'Lãi cao, ít người mua', hint: 'Giới thiệu nhiều hơn, cho khách thử', tone: 'text-sky-400' },
  dog: { label: 'Ít bán, lãi thấp', hint: 'Cân nhắc làm lại công thức hoặc bỏ', tone: 'text-red-600' },
};

export function menuEngineering(dishes) {
  const known = dishes.filter((d) => d.hasRecipe && d.qty > 0);
  const unknown = dishes.filter((d) => !d.hasRecipe && d.qty > 0).map((d) => d.name);
  const totalQty = known.reduce((s, d) => s + d.qty, 0);
  if (!known.length || totalQty <= 0) return { rows: [], unknown, popularityLine: null, avgMargin: null };
  const popularityLine = 0.7 / known.length;
  const avgMargin = known.reduce((s, d) => s + (d.revenue - d.cost), 0) / totalQty;
  const rows = known
    .map((d) => {
      const margin = (d.revenue - d.cost) / d.qty;
      const mix = d.qty / totalQty;
      const popular = mix >= popularityLine;
      const high = margin >= avgMargin;
      const cls = popular && high ? 'star' : popular ? 'plowhorse' : high ? 'puzzle' : 'dog';
      return { name: d.name, qty: d.qty, price: d.revenue / d.qty, cost: d.cost / d.qty, margin, mix, cls };
    })
    .sort((a, b) => Object.keys(CLASSES).indexOf(a.cls) - Object.keys(CLASSES).indexOf(b.cls) || b.qty - a.qty);
  return { rows, unknown, popularityLine, avgMargin };
}
