import { dishKey, dishLabel } from './dishKey';
import { saleDate } from './saleDate';

// Mốc đầu tuần: 00:00 sáng thứ Hai theo giờ máy. Số liệu "tuần này" tự reset tại mốc này.
export function startOfWeek(now = new Date()) {
  const d = new Date(now);
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d;
}

export const itemsTotal = (order) => order.items.reduce((sum, i) => sum + i.price * i.qty, 0);
// Số tiền khách trả: tiền món + phí ship − giảm giá
export const orderTotal = (order) => itemsTotal(order) + (order.shippingFee || 0) - (order.discount || 0);

export function summarize(allOrders, now = new Date(), menu = []) {
  // Đơn đã huỷ không tính vào doanh thu
  const orders = allOrders.filter((o) => o.status !== 'cancelled');
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  // "Tuần này" = TUẦN GIAO hiện tại (saleDate, quy ước PR #80): đơn tạo tuần trước mà
  // giao thứ Bảy này vẫn tính vào tuần này; đơn tạo tuần này mà giao tuần sau thì chưa.
  const weekOrders = orders.filter((o) => {
    const d = saleDate(o);
    return d >= weekStart && d < weekEnd;
  });

  // Gộp số lượng + doanh thu theo từng món trong tuần bằng dishKey dùng chung với
  // Báo cáo (trước đây gộp theo tên thô nên cùng một món tách nhiều dòng, số lệch
  // hẳn với tab Báo cáo). Tên hiển thị: tên thực đơn nếu có, không thì biến thể
  // bán nhiều nhất trong nhóm — như dishTotals ở lib/report.js.
  const byItem = new Map();
  for (const order of weekOrders) {
    for (const { name, qty, price } of order.items) {
      const key = dishKey(name);
      const row = byItem.get(key) ?? { key, name, qty: 0, revenue: 0, variants: new Map() };
      row.qty += qty;
      row.revenue += qty * price;
      row.variants.set(name, (row.variants.get(name) ?? 0) + qty);
      byItem.set(key, row);
    }
  }
  const weekItems = [...byItem.values()].map((row) => {
    let best = row.name;
    let bestQty = -1;
    for (const [variant, vQty] of row.variants) {
      if (vQty > bestQty) {
        best = variant;
        bestQty = vQty;
      }
    }
    return { name: dishLabel(row.key, menu, best), qty: row.qty, revenue: row.revenue };
  });
  // Xếp theo DOANH THU giảm dần (quy ước Paul chốt), bằng nhau thì theo số lượng
  weekItems.sort((a, b) => b.revenue - a.revenue || b.qty - a.qty);

  const sumOf = (list) => list.reduce((sum, o) => sum + orderTotal(o), 0);
  const weekPaid = weekOrders.filter((o) => o.paid);
  const weekUnpaid = weekOrders.filter((o) => !o.paid);
  // Đơn chưa thu tiền của các tuần giao trước: không tính vào tuần này nhưng vẫn cần nhắc.
  const olderUnpaid = orders.filter((o) => !o.paid && saleDate(o) < weekStart);

  return {
    weekStart,
    weekPaid: { total: sumOf(weekPaid), count: weekPaid.length },
    weekUnpaid: { total: sumOf(weekUnpaid), count: weekUnpaid.length },
    olderUnpaid: { total: sumOf(olderUnpaid), count: olderUnpaid.length },
    weekOrderCount: weekOrders.length,
    weekRevenue: weekOrders.reduce((sum, o) => sum + orderTotal(o), 0),
    allTimeRevenue: orders.reduce((sum, o) => sum + orderTotal(o), 0),
    allTimeOrderCount: orders.length,
    weekItems,
  };
}

// Chốt ca: tiền đã thu hôm nay theo từng cách thanh toán (theo lúc bấm "Đã thanh toán"),
// và tiền còn phải thu của các đơn giao / tạo hôm nay.
export function dailyCollection(allOrders, now = new Date()) {
  const sameDay = (iso) => iso && new Date(iso).toDateString() === now.toDateString();
  const orders = allOrders.filter((o) => o.status !== 'cancelled');
  const paid = orders.filter((o) => o.paid && sameDay(o.paidAt));
  const byMethod = (method) => {
    const list = paid.filter((o) => (o.paymentMethod ?? null) === method);
    return { total: list.reduce((sum, o) => sum + orderTotal(o), 0), count: list.length };
  };
  const unpaid = orders.filter((o) => !o.paid && sameDay(o.deliverAt ?? o.createdAt));
  return {
    cash: byMethod('cash'),
    transfer: byMethod('transfer'),
    payid: byMethod('payid'),
    unknown: byMethod(null),
    total: paid.reduce((sum, o) => sum + orderTotal(o), 0),
    unpaid: { total: unpaid.reduce((sum, o) => sum + orderTotal(o), 0), count: unpaid.length },
  };
}

// $1,200.50: dấu phẩy ngăn hàng nghìn, luôn 2 số lẻ
const MONEY = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const formatMoney = (n) => `$${MONEY.format(Number(n) || 0)}`;

export const formatDay = (d) => d.toLocaleDateString('vi-VN', { weekday: 'long' });
export const formatDate = (d) =>
  d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
