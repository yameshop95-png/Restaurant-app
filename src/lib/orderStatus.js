// Tên trạng thái đơn và cách thanh toán, dùng chung cho màn hình, thông báo và file Excel.

export const STATUS_LABEL = {
  pending: 'Chờ xử lý',
  done: 'Hoàn thành',
  delivering: 'Đang giao',
  shipped: 'Đã ship',
  cancelled: 'Đã huỷ',
};

// Đơn đến lấy: bước cuối là "Đã lấy" thay vì "Đã ship"
export const statusLabel = (status, type) => (type === 'pickup' && status === 'shipped' ? 'Đã lấy' : STATUS_LABEL[status]);

// Hai loại đơn. Đơn "tại quán" của bản cũ được đổi thành "đến lấy" khi mở app.
export const ORDER_TYPES = {
  pickup: { label: 'Đến lấy', timeLabel: 'Giờ đến lấy', dateLabel: 'Ngày lấy', verb: 'Lấy' },
  delivery: { label: 'Giao hàng', timeLabel: 'Giờ giao', dateLabel: 'Ngày giao', verb: 'Giao' },
};
export const orderType = (type) => (type === 'delivery' ? 'delivery' : 'pickup');

// Đơn tính là "đã giao hôm nay" cho tiến độ / đối soát chuyến: trạng thái shipped và
// mốc shippedAt (lúc bấm "Đã giao xong", do setStatus trong useOrders ghi) rơi vào
// hôm nay theo giờ máy. Đơn đã ship từ trước khi app có shippedAt thì không có mốc
// này nên không được tính — đó là lịch sử, cố ý loại ra để số liệu chuyến không bị
// đơn cũ làm sai lệch dần theo thời gian.
export function isShippedToday(o, now = new Date()) {
  if (o.status !== 'shipped' || !o.shippedAt) return false;
  const d = new Date(o.shippedAt);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

// Đơn web đã xác nhận (confirmedAt) nhưng chưa ai nhắn tin xác nhận cho khách
// (chưa có messagedAt) — vd xác nhận trên PC không có SMS. Thẻ đơn gắn chip
// "Chưa nhắn khách" để máy khác (điện thoại có SIM) nhắn bù; gửi/copy tin xác
// nhận ở bất cứ máy nào cũng ghi messagedAt và chip tự mất trên mọi máy.
export const needsCustomerMessage = (o) =>
  o?.source === 'web' && o?.status === 'pending' && !!o?.confirmedAt && !o?.messagedAt;

// Bước trước của từng trạng thái, dùng cho nút "quay lại" trên thẻ đơn.
// Riêng "shipped": đơn giao hàng quay về "delivering", đơn đến lấy quay về "done" —
// OrdersPage tự phân biệt theo loại đơn (xem previousStatus ở đó), ở đây giữ giá trị của đơn đến lấy.
export const PREVIOUS_STATUS = { done: 'pending', delivering: 'done', shipped: 'done', cancelled: 'pending' };

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tiền mặt' },
  { id: 'transfer', label: 'Chuyển khoản' },
  { id: 'payid', label: 'PayID' },
];

export const paymentLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? null;
