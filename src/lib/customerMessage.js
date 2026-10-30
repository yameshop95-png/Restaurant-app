// Tin nhắn cho khách (nút "Nhắn khách" trên thẻ đơn): soạn sẵn, nhân viên gửi bằng app Tin nhắn của điện thoại quán.
// Ngôn ngữ: đơn đặt trên website nhớ ngôn ngữ khách dùng (order.lang); đơn tạo trong app mặc định tiếng Việt.
import { formatMoney, orderTotal } from './stats';

const DEFAULT_SHOP = 'Bánh Cuốn & Giò Chả';

export const MESSAGE_KINDS = [
  { id: 'confirm', label: 'Xác nhận đơn' },
  { id: 'ready', label: 'Đơn đã xong' },
];

// Đơn đang chờ: xác nhận; đã làm xong / đã giao: báo sẵn sàng
export const defaultKind = (order) => (order.status === 'pending' ? 'confirm' : 'ready');
export const defaultLang = (order) => (order.lang === 'en' ? 'en' : 'vi');

function when(order, lang) {
  if (!order.deliverAt) return '';
  const d = new Date(order.deliverAt);
  if (lang === 'en') {
    const day = d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();
    return `${day}, ${time}`;
  }
  const weekday = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${time} ${weekday} ${d.getDate()}/${d.getMonth() + 1}`;
}

export function customerMessage(order, kind, lang, shopName) {
  const shop = shopName?.trim() || DEFAULT_SHOP;
  const name = order.customer?.name?.trim() || '';
  const delivery = order.type === 'delivery';
  const items = (order.items ?? []).map((i) => `${i.qty}× ${i.name}`).join(', ');
  const total = formatMoney(orderTotal(order));
  const fee = order.shippingFee ? formatMoney(order.shippingFee) : null;
  const at = when(order, lang);

  if (lang === 'en') {
    const pay = order.paid ? 'Paid, thank you.' : `Please pay cash on ${delivery ? 'delivery' : 'pickup'}.`;
    if (kind === 'confirm') {
      return [
        `${shop}: Hi ${name}, we have your order #${order.number}.`,
        at && `${delivery ? 'Delivery' : 'Pickup'}: ${at}.`,
        items && `${items}.`,
        `Total ${total}${fee ? ` incl. ${fee} delivery` : ''}. ${pay}`,
        'Thank you!',
      ]
        .filter(Boolean)
        .join(' ');
    }
    return delivery
      ? `${shop}: Hi ${name}, order #${order.number} is on its way. Total ${total}. ${pay} Thank you!`
      : `${shop}: Hi ${name}, order #${order.number} is ready for pickup. Total ${total}. ${pay} See you soon!`;
  }

  const pay = order.paid ? 'Đã thanh toán, cảm ơn bạn.' : 'Vui lòng trả tiền mặt khi nhận hàng.';
  if (kind === 'confirm') {
    return [
      `${shop}: Chào ${name}, quán đã nhận đơn #${order.number}.`,
      at && `${delivery ? 'Giao' : 'Đến lấy'} lúc ${at}.`,
      items && `Món: ${items}.`,
      `Tổng ${total}${fee ? ` (gồm ship ${fee})` : ''}. ${pay}`,
      'Cảm ơn bạn!',
    ]
      .filter(Boolean)
      .join(' ');
  }
  return delivery
    ? `${shop}: Chào ${name}, đơn #${order.number} đang được giao tới bạn. Tổng ${total}. ${pay} Cảm ơn bạn!`
    : `${shop}: Chào ${name}, đơn #${order.number} đã sẵn sàng, mời bạn ghé lấy. Tổng ${total}. ${pay} Cảm ơn bạn!`;
}

// Link mở app Tin nhắn với số và nội dung soạn sẵn. iPhone dùng "&body=", Android dùng "?body=".
export function smsLink(phone, text) {
  const to = String(phone ?? '').replace(/[^\d+]/g, '');
  const ios = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  return `sms:${to}${ios ? '&' : '?'}body=${encodeURIComponent(text)}`;
}
