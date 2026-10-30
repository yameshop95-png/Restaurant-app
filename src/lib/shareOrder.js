import { formatMoney, itemsTotal, orderTotal } from './stats';

export const mapsUrl = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const pad = (n) => String(n).padStart(2, '0');
const when = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

// Nội dung đơn để dán vào Zalo / Messenger cho shipper
export function orderText(order, shopName) {
  const c = order.customer;
  // Ba khối cách nhau một dòng trống: thông tin giao, món, tổng tiền
  const blocks = [
    [
      `${shopName ? `[${shopName}] ` : ''}Đơn #${order.number}${order.deliverAt ? ` – giao ${when(order.deliverAt)}` : ''}`,
      c && `Khách: ${c.name}`,
      c?.phone && `SĐT: ${c.phone}`,
      c?.address && `Địa chỉ: ${c.address}`,
      c?.address && `Bản đồ: ${mapsUrl(c.address)}`,
    ],
    [...order.items.map((i) => `${i.qty} × ${i.name}`), order.note && `Ghi chú: ${order.note}`],
    [
      (order.shippingFee > 0 || order.discount > 0) && `Tiền món: ${formatMoney(itemsTotal(order))}`,
      order.shippingFee > 0 && `Phí ship: ${formatMoney(order.shippingFee)}`,
      order.discount > 0 && `Giảm giá: −${formatMoney(order.discount)}`,
      `Tổng: ${formatMoney(orderTotal(order))} – ${order.paid ? 'ĐÃ THANH TOÁN' : 'CHƯA THANH TOÁN, thu tiền khách'}`,
    ],
  ];
  return blocks.map((lines) => lines.filter(Boolean).join('\n')).join('\n\n');
}

// Mở bảng chia sẻ của điện thoại (Zalo, Messenger...) nếu có; không thì copy vào bộ nhớ tạm.
// Trả về 'shared' | 'copied' | 'cancelled'.
export async function shareOrder(order, shopName) {
  const text = orderText(order, shopName);
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch (err) {
      if (err?.name === 'AbortError') return 'cancelled';
      // chia sẻ lỗi: thử copy
    }
  }
  await navigator.clipboard.writeText(text);
  return 'copied';
}
