import { createContext, createElement, useContext } from 'react';
import useCloudList, { dataOf } from './useCloudList';
import { supabase } from '../lib/supabase';

// Dữ liệu tab Inventory Management (chỉ chủ quán): nguyên liệu, nhập hàng, điều chỉnh kho, chi phí, công thức món.
// Mỗi bảng là danh sách trên máy chủ dùng chung (xem sql/inventory.sql).
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const fromRow = (row) => ({ ...row.data, id: row.id });

function writer(table) {
  return ({ added, changed, removed }) => {
    const ops = [];
    const rows = [...added, ...changed.map(([, next]) => next)].map((x) => ({ id: x.id, data: dataOf(x) }));
    if (rows.length) {
      ops.push({
        rowId: rows.length === 1 ? rows[0].id : undefined,
        run: () => supabase.from(table).upsert(rows),
        onDone: () => {},
      });
    }
    for (const x of removed) {
      ops.push({ rowId: x.id, run: () => supabase.from(table).delete().eq('id', x.id), onDone: () => {} });
    }
    return ops;
  };
}

function useTable(table, sort = (list) => list) {
  const { list, setList, ready, loadError } = useCloudList(table, { fromRow, sort, write: writer(table) });
  return {
    list,
    ready,
    loadError,
    add: (data) => {
      const id = data.id ?? newId();
      setList((prev) => sort([...prev, { ...data, id }])); // giữ đúng thứ tự (VD: ngày mới nhất lên đầu)
      return id;
    },
    update: (id, patch) => setList((prev) => sort(prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))),
    remove: (id) => setList((prev) => prev.filter((x) => x.id !== id)),
  };
}

const byName = (list) => [...list].sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'));
const byDateDesc = (list) =>
  [...list].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));

function useInventoryData() {
  const ingredients = useTable('inv_ingredients', byName);
  const purchases = useTable('inv_purchases', byDateDesc);
  const adjustments = useTable('inv_adjustments', byDateDesc);
  const expenses = useTable('inv_expenses', byDateDesc);
  const recipes = useTable('inv_recipes', (list) => list);
  const batches = useTable('inv_batches', byDateDesc);

  const all = [ingredients, purchases, adjustments, expenses, recipes];
  const missing = (t) => /inv_|relation|does not exist|schema cache/i.test(t.loadError ?? '');
  return {
    ingredients,
    purchases,
    adjustments,
    expenses,
    recipes,
    batches,
    // Bảng mẻ thêm sau (sql/inventory_batches.sql): chưa có thì các mục khác vẫn chạy, chỉ mục Mẻ báo cần cài
    batchesMissing: missing(batches),
    batchesReady: batches.ready,
    ready: all.every((t) => t.ready),
    // Bảng chưa tạo trên máy chủ (chưa chạy sql/inventory.sql)
    missingTables: all.some(missing),
    loadError: all.map((t) => t.loadError).find(Boolean) ?? null,
  };
}

// Một bản dữ liệu kho dùng chung cho cả app (chủ quán): trước đây mỗi lần mở Màn hình chính / Báo cáo / Kho lại mở
// thêm 6 kết nối trực tiếp và tải lại 6 bảng.
const InventoryContext = createContext(null);

export function InventoryProvider({ children }) {
  return createElement(InventoryContext.Provider, { value: useInventoryData() }, children);
}

export default function useInventory() {
  return useContext(InventoryContext);
}
