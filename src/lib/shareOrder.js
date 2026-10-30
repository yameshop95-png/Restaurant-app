import { directionsUrl } from './geo';
import { paymentLabel } from './orderStatus';
import { formatMoney, itemsTotal, orderTotal } from './stats';

// Mở địa chỉ trong ứng dụng bản đồ đã chọn ở Cài đặt app: 'apple' (Apple Maps) hoặc 'google' (Google Maps)
export const mapsUrl = (address, app = 'google') =>
  app === 'apple'
    ? `https://maps.apple.com/place?address=${encodeURIComponent(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

const pad = (n) => String(n).padStart(2, '0');
const when = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};

const itemLine = (i) => `${i.qty} × ${i.name}${i.note ? ` (${i.note})` : ''}`;
const paidText = (o) =>
  o.paid ? `ĐÃ THANH TOÁN${o.paymentMethod ? ` (${paymentLabel(o.paymentMethod)})` : ''}` : 'CHƯA THANH TOÁN, thu tiền khách';

// Nội dung đơn để dán vào Zalo / Messenger cho shipper
export function orderText(order, shopName, mapsApp = 'google') {
  const c = order.customer;
  // Ba khối cách nhau một dòng trống: thông tin giao, món, tổng tiền
  const blocks = [
    [
      `${shopName ? `[${shopName}] ` : ''}Đơn #${order.number}${order.deliverAt ? ` – ${order.type === 'delivery' ? 'giao' : 'đến lấy'} ${when(order.deliverAt)}` : ''}`,
      c && `Khách: ${c.name}`,
      c?.phone && `SĐT: ${c.phone}`,
      c?.address && `Địa chỉ: ${c.address}`,
      // Link bản đồ theo ứng dụng đã chọn ở Cài đặt app
      c?.address && `Bản đồ: ${mapsUrl(c.address, mapsApp)}`,
    ],
    [...order.items.map(itemLine), order.note && `Ghi chú: ${order.note}`],
    [
      (order.shippingFee > 0 || order.discount > 0) && `Tiền món: ${formatMoney(itemsTotal(order))}`,
      order.shippingFee > 0 && `Phí ship: ${formatMoney(order.shippingFee)}`,
      order.discount > 0 && `Giảm giá: −${formatMoney(order.discount)}`,
      `Tổng: ${formatMoney(orderTotal(order))} – ${paidText(order)}`,
    ],
  ];
  return blocks.map((lines) => lines.filter(Boolean).join('\n')).join('\n\n');
}

// Gửi một đơn cho shipper
export const shareOrder = (order, shopName, mapsApp) => shareText(orderText(order, shopName, mapsApp));

// Cả lộ trình giao trong một tin nhắn: các điểm theo thứ tự, tiền cần thu, link chỉ đường
export function routeText(plan, start, shopName, mapsApp) {
  const stops = plan.slots.flatMap((s) => s.stops);
  const toCollect = stops.filter((s) => !s.order.paid).reduce((sum, s) => sum + orderTotal(s.order), 0);
  const located = stops.filter((s) => s.geo);
  const now = new Date();
  const head = [
    `${shopName ? `[${shopName}] ` : ''}Lộ trình giao ${when(now.toISOString())} – ${stops.length} điểm`,
    toCollect > 0 && `Tổng cần thu: ${formatMoney(toCollect)}`,
    located.length > 0 && `Chỉ đường: ${directionsUrl(start, located.map((s) => s.geo), mapsApp)}`,
  ];
  const body = stops.map(({ order: o, index }) =>
    [
      `${index}. ${when(o.deliverAt).slice(0, 5)} – #${o.number} ${o.customer.name}${o.customer.phone ? ` – ${o.customer.phone}` : ''}`,
      `   ${o.customer.address}`,
      `   ${o.items.map(itemLine).join(', ')}`,
      o.note && `   Ghi chú: ${o.note}`,
      `   ${o.paid ? paidText(o) : `THU ${formatMoney(orderTotal(o))}`}`,
    ]
      .filter(Boolean)
      .join('\n')
  );
  return [head.filter(Boolean).join('\n'), ...body].join('\n\n');
}

// Mở bảng chia sẻ của điện thoại (Zalo, Messenger...) nếu có; không thì copy vào bộ nhớ tạm.
// Trả về 'shared' | 'copied' | 'cancelled'.
export async function shareText(text) {
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
