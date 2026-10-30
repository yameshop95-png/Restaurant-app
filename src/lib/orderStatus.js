// Tên trạng thái đơn và cách thanh toán, dùng chung cho màn hình, thông báo và file Excel.

export const STATUS_LABEL = {
  pending: 'Chờ xử lý',
  done: 'Hoàn thành',
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

// Bước trước của từng trạng thái, dùng cho nút "quay lại" trên thẻ đơn
export const PREVIOUS_STATUS = { done: 'pending', shipped: 'done', cancelled: 'pending' };

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tiền mặt' },
  { id: 'transfer', label: 'Chuyển khoản' },
  { id: 'payid', label: 'PayID' },
];

export const paymentLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? null;
