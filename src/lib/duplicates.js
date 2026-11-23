// Cảnh báo đơn trùng: hai nhân viên cùng nhập một đơn, hoặc khách vừa đặt web vừa gọi điện.
import { normalizeText } from './text.js';

// Khách: SĐT (≥ 8 chữ số) nếu có, không thì tên đã bỏ dấu
const customerKey = (o) => {
  const digits = (o.customer?.phone ?? '').replace(/\D/g, '');
  if (digits.length >= 8) return `p${digits}`;
  const name = normalizeText(o.customer?.name ?? '').trim();
  return name ? `n${name}` : '';
};
const dayOf = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};
const itemsSig = (o) =>
  (o.items ?? [])
    .map((i) => `${normalizeText(i.name ?? '')}x${i.qty}`)
    .sort()
    .join('|');

// Đơn khác (chưa huỷ) của cùng khách, cùng ngày lấy / giao. sameItems: chỉ tính khi món giống hệt.
export function findDuplicate(order, orders, { excludeId, sameItems = false } = {}) {
  const key = customerKey(order);
  if (!key) return null;
  const day = dayOf(order.deliverAt);
  const sig = sameItems ? itemsSig(order) : null;
  return (
    orders.find(
      (o) =>
        o.id !== excludeId &&
        o.id !== order.id &&
        o.status !== 'cancelled' &&
        customerKey(o) === key &&
        dayOf(o.deliverAt) === day &&
        (!sameItems || itemsSig(o) === sig),
    ) ?? null
  );
}

// Map orderId → số đơn trùng (cùng khách, cùng ngày, món giống hệt) để gắn chip trên thẻ đơn
export function duplicateNumbers(orders) {
  const groups = new Map();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const key = customerKey(o);
    if (!key) continue;
    const g = `${key}|${dayOf(o.deliverAt)}|${itemsSig(o)}`;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(o);
  }
  const out = new Map();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (const o of list) out.set(o.id, list.filter((x) => x.id !== o.id).map((x) => x.number));
  }
  return out;
}
