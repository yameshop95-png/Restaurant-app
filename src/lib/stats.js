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

export function summarize(allOrders, now = new Date()) {
  // Đơn đã huỷ không tính vào doanh thu
  const orders = allOrders.filter((o) => o.status !== 'cancelled');
  const weekStart = startOfWeek(now);
  const weekOrders = orders.filter((o) => new Date(o.createdAt) >= weekStart);

  // Gộp số lượng + doanh thu theo từng món trong tuần
  const byItem = new Map();
  for (const order of weekOrders) {
    for (const { name, qty, price } of order.items) {
      const row = byItem.get(name) ?? { name, qty: 0, revenue: 0 };
      row.qty += qty;
      row.revenue += qty * price;
      byItem.set(name, row);
    }
  }

  const sumOf = (list) => list.reduce((sum, o) => sum + orderTotal(o), 0);
  const weekPaid = weekOrders.filter((o) => o.paid);
  const weekUnpaid = weekOrders.filter((o) => !o.paid);
  // Đơn chưa thu tiền từ tuần trước: không tính vào tuần này nhưng vẫn cần nhắc.
  const olderUnpaid = orders.filter((o) => !o.paid && new Date(o.createdAt) < weekStart);

  return {
    weekStart,
    weekPaid: { total: sumOf(weekPaid), count: weekPaid.length },
    weekUnpaid: { total: sumOf(weekUnpaid), count: weekUnpaid.length },
    olderUnpaid: { total: sumOf(olderUnpaid), count: olderUnpaid.length },
    weekOrderCount: weekOrders.length,
    weekRevenue: weekOrders.reduce((sum, o) => sum + orderTotal(o), 0),
    allTimeRevenue: orders.reduce((sum, o) => sum + orderTotal(o), 0),
    allTimeOrderCount: orders.length,
    weekItems: [...byItem.values()].sort((a, b) => b.qty - a.qty || b.revenue - a.revenue),
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

export const formatMoney = (n) => `A$${n.toFixed(2)}`;

export const formatDay = (d) => d.toLocaleDateString('vi-VN', { weekday: 'long' });
export const formatDate = (d) =>
  d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
