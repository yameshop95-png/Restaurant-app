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
  //          items: [{ name, price, qty }], status: 'pending' | 'done' | 'cancelled', createdAt }
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
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);

  const setStatus = (id, status) =>
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

  return { orders, addOrder, setStatus };
}
