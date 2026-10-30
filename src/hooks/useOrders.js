import { useEffect, useState } from 'react';

// Đơn được lưu trong localStorage của trình duyệt: không mất khi tải lại trang,
// nhưng mỗi máy có dữ liệu riêng. Thay bằng API/database khi có backend dùng chung.
const STORAGE_KEY = 'restaurant-app.orders';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    // Đơn "tại quán" của bản cũ được tính là đơn đến lấy
    return Array.isArray(saved) ? saved.map((o) => (o.type === 'dine-in' ? { ...o, type: 'pickup' } : o)) : [];
  } catch {
    return [];
  }
}

export default function useOrders() {
  const [orders, setOrders] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // Trình duyệt chặn lưu trữ (chế độ ẩn danh...): vẫn chạy được, chỉ không lưu lại.
    }
  }, [orders]);

  // Order: { id, number, type: 'pickup' | 'delivery',
  //          customer: { name, phone, address }, deliverAt (ISO: giờ giao / giờ đến lấy),
  //          table (đơn tại quán của bản cũ), note,
  //          shippingFee, discount (A$),
  //          items: [{ name, price, qty, note? }], status: 'pending' | 'done' | 'shipped' | 'cancelled',
  //          paid: boolean, paymentMethod: 'cash' | 'transfer' | 'payid' | null, paidAt (ISO), createdAt }
  const addOrder = ({ type, customer, deliverAt, table, note, items, shippingFee, discount }) =>
    setOrders((prev) => [
      {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        number: prev.reduce((max, o) => Math.max(max, o.number), 0) + 1,
        type,
        customer,
        deliverAt,
        table,
        note: note.trim(),
        items,
        shippingFee,
        discount,
        status: 'pending',
        paid: false,
        paymentMethod: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

  const setStatus = (id, status) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

  // paidAt mặc định là lúc bấm; truyền vào khi cần khôi phục giá trị cũ (hoàn tác)
  const setPaid = (id, paid, paymentMethod = null, paidAt = paid ? new Date().toISOString() : null) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, paid, paymentMethod: paid ? paymentMethod : null, paidAt } : o))
    );

  // Sửa đơn đã tạo: thông tin khách, giờ giao, ghi chú, món. Giữ nguyên số đơn, trạng thái, thanh toán.
  const updateOrder = (id, { customer, deliverAt, table, note, items, shippingFee, discount }) =>
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, customer, deliverAt, table, note: note.trim(), items, shippingFee, discount } : o
      )
    );

  // Khôi phục từ Excel: chỉ thêm đơn chưa có (theo id), đơn đã có trong app giữ nguyên.
  // Trả về số đơn được thêm.
  const importOrders = (list) => {
    const known = new Set(orders.map((o) => o.id));
    const fresh = list.filter((o) => !known.has(o.id));
    setOrders([...orders, ...fresh].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    return fresh.length;
  };

  return { orders, addOrder, updateOrder, setStatus, setPaid, importOrders };
}
