import { useEffect, useState } from 'react';

// Đơn được lưu trong localStorage của trình duyệt: không mất khi tải lại trang,
// nhưng mỗi máy có dữ liệu riêng. Thay bằng API/database khi có backend dùng chung.
const STORAGE_KEY = 'restaurant-app.orders';

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : [];
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

  // Order: { id, number, type: 'dine-in' | 'delivery',
  //          customer: { name, phone, address }, deliverAt (ISO), note,
  //          items: [{ name, price, qty }], status: 'pending' | 'done' | 'shipped' | 'cancelled',
  //          paid: boolean, createdAt }
  const addOrder = ({ type, customer, deliverAt, note, items }) =>
    setOrders((prev) => [
      {
        id: crypto.randomUUID?.() ?? String(Date.now()),
        number: prev.reduce((max, o) => Math.max(max, o.number), 0) + 1,
        type,
        customer,
        deliverAt,
        note: note.trim(),
        items,
        status: 'pending',
        paid: false,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

  const setStatus = (id, status) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

  const setPaid = (id, paid) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, paid } : o)));

  // Sửa đơn đã tạo: thông tin khách, giờ giao, ghi chú, món. Giữ nguyên số đơn, trạng thái, thanh toán.
  const updateOrder = (id, { customer, deliverAt, note, items }) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, customer, deliverAt, note: note.trim(), items } : o))
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
