import useCloudList, { dataOf } from './useCloudList';
import { normalizeText } from './useCustomers';
import { supabase } from '../lib/supabase';

// Thực đơn lưu trên máy chủ dùng chung, quản lý ở tab "Quản lý món ăn".
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

const fromRow = (row) => ({ ...row.data, id: row.id, _position: row.position ?? 0 });
const sort = (list) => [...list].sort((a, b) => a._position - b._position);

function write({ prev, next, added, changed, removed }) {
  const ops = [];
  const prevIndex = new Map(prev.map((m, i) => [m.id, i]));
  const changedIds = new Set(changed.map(([, m]) => m.id));
  const rows = [];
  next.forEach((m, i) => {
    const old = prev[prevIndex.get(m.id)];
    const moved = prevIndex.get(m.id) !== i;
    if (!old || moved) return rows.push(m);
    if (!changedIds.has(m.id)) return;
    // Chỉ đổi Còn/Hết: nhân viên cũng làm được (qua hàm riêng trên máy chủ)
    const onlyAvailability =
      JSON.stringify({ ...old, available: m.available, _position: 0 }) === JSON.stringify({ ...m, _position: 0 });
    if (onlyAvailability) {
      ops.push({
        rowId: m.id,
        run: () => supabase.rpc('set_menu_available', { item_id: m.id, is_available: m.available }),
        onDone: () => {},
      });
    } else rows.push(m);
  });
  if (rows.length) {
    const payload = rows.map((m) => ({ id: m.id, position: next.indexOf(m), data: dataOf(m) }));
    ops.push({
      rowId: payload.length === 1 ? payload[0].id : undefined,
      run: () => supabase.from('menu_items').upsert(payload),
      onDone: () => {},
    });
  }
  for (const m of removed) {
    ops.push({ rowId: m.id, run: () => supabase.from('menu_items').delete().eq('id', m.id), onDone: () => {} });
  }
  return ops;
}

// MenuItem: { id, name, price, available }. Thứ tự trong danh sách là thứ tự hiện khi tạo đơn.
// Chỉ chủ quán sửa được tên / giá / thứ tự; nhân viên chỉ bật tắt Còn / Hết.
export default function useMenu() {
  const { list: menu, setList, ready } = useCloudList('menu_items', { fromRow, sort, write });
  // Thứ tự mảng là thứ tự món; _position đi theo để món nhận từ máy khác chen đúng chỗ
  const setMenu = (updater) =>
    setList((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return prev;
      return next.map((m, i) => (m._position === i ? m : { ...m, _position: i }));
    });

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

  // Khôi phục từ Excel: xếp theo thứ tự trong file; món trùng tên được cập nhật giá + trạng thái,
  // món chỉ có trong app (không có trong file) giữ lại ở cuối. Trả về số món được thêm mới.
  const importMenu = (items) => {
    const key = (m) => normalizeText(m.name);
    const fromFile = new Map(items.map((item) => [key(item), item]));
    const existing = new Map(menu.map((m) => [key(m), m]));
    const next = [...fromFile.values()].map((item) => {
      const prev = existing.get(key(item));
      return prev ? { ...prev, price: item.price, available: item.available } : { id: newId(), ...item };
    });
    setMenu([...next, ...menu.filter((m) => !fromFile.has(key(m)))]);
    return next.filter((m) => !existing.has(key(m))).length;
  };

  return { menu, ready, addItem, updateItem, deleteItem, moveItem, importMenu };
}
