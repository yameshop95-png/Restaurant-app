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
