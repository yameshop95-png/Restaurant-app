import { useEffect, useState } from 'react';

// Thực đơn lưu trong localStorage, quản lý ở tab "Quản lý món ăn".
const STORAGE_KEY = 'restaurant-app.menu';

// Thực đơn mẫu cho lần chạy đầu tiên
const DEFAULT_MENU = [
  { id: 'pho', name: 'Phở bò', price: 15 },
  { id: 'bun-cha', name: 'Bún chả', price: 14 },
  { id: 'com-tam', name: 'Cơm tấm', price: 13 },
  { id: 'banh-mi', name: 'Bánh mì', price: 9 },
  { id: 'goi-cuon', name: 'Gỏi cuốn', price: 8 },
  { id: 'tra-da', name: 'Trà đá', price: 3 },
].map((m) => ({ ...m, available: true }));

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(saved) ? saved : DEFAULT_MENU;
  } catch {
    return DEFAULT_MENU;
  }
}

// MenuItem: { id, name, price, available }
export default function useMenu() {
  const [menu, setMenu] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(menu));
    } catch {
      // Không lưu được (chế độ ẩn danh...): vẫn dùng được trong phiên hiện tại.
    }
  }, [menu]);

  const addItem = ({ name, price }) =>
    setMenu((prev) => [...prev, { id: newId(), name: name.trim(), price, available: true }]);

  const updateItem = (id, patch) =>
    setMenu((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch, name: (patch.name ?? m.name).trim() } : m)));

  const deleteItem = (id) => setMenu((prev) => prev.filter((m) => m.id !== id));

  // Đổi chỗ với món liền trên/dưới (delta = -1 / +1)
  const moveItem = (id, delta) =>
    setMenu((prev) => {
      const i = prev.findIndex((m) => m.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return { menu, addItem, updateItem, deleteItem, moveItem };
}
