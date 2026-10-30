// Tên trạng thái đơn và cách thanh toán, dùng chung cho màn hình, thông báo và file Excel.

export const STATUS_LABEL = {
  pending: 'Chờ xử lý',
  done: 'Hoàn thành',
  shipped: 'Đã ship',
  cancelled: 'Đã huỷ',
};

// Bước trước của từng trạng thái, dùng cho nút "quay lại" trên thẻ đơn
export const PREVIOUS_STATUS = { done: 'pending', shipped: 'done', cancelled: 'pending' };

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Tiền mặt' },
  { id: 'transfer', label: 'Chuyển khoản' },
  { id: 'payid', label: 'PayID' },
];

export const paymentLabel = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.label ?? null;
