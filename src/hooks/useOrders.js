import useCloudList, { dataOf, shallowPatch } from './useCloudList';
import { supabase } from '../lib/supabase';

// Đơn hàng lưu trên máy chủ, mọi máy đăng nhập đều thấy cùng một danh sách.
// Số đơn do máy chủ cấp (2 máy tạo đơn cùng lúc không bị trùng số); trên máy hiện tạm số kế tiếp cho tới khi lưu xong.
const fromRow = (row) => ({ ...row.data, id: row.id, number: row.number });
const sort = (list) => [...list].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

function write({ added, changed, removed }) {
  const ops = [];
  if (added.length) {
    const rows = added.map((o) => ({
      id: o.id,
      // Đơn mới tạo: để máy chủ cấp số. Đơn khôi phục từ file: giữ số cũ.
      ...(o._provisional ? {} : { number: o.number }),
      data: dataOf(o, ['number']),
    }));
    const hasNumber = rows.filter((r) => 'number' in r);
    const noNumber = rows.filter((r) => !('number' in r));
    for (const group of [hasNumber, noNumber]) {
      if (!group.length) continue;
      ops.push({
        rowId: group.length === 1 ? group[0].id : undefined,
        run: () => supabase.from('orders').upsert(group).select(),
      });
    }
  }
  for (const [old, next] of changed) {
    const patch = shallowPatch(old, next, ['id', 'number']);
    if (!Object.keys(patch).length) continue;
    ops.push({
      rowId: next.id,
      run: () => supabase.rpc('patch_data', { table_name: 'orders', row_id: next.id, patch }),
      onDone: () => {},
    });
  }
  for (const o of removed) {
    ops.push({ rowId: o.id, run: () => supabase.from('orders').delete().eq('id', o.id), onDone: () => {} });
  }
  return ops;
}

export default function useOrders(account) {
  const { list: orders, setList: setOrders, ready, loadError } = useCloudList('orders', { fromRow, sort, write });

  // Order: { id, number, type: 'pickup' | 'delivery',
  //          customer: { name, phone, address }, deliverAt (ISO: giờ giao / giờ đến lấy),
  //          table (đơn tại quán của bản cũ), note,
  //          shippingFee, discount (A$),
  //          items: [{ name, price, qty, note? }], status: 'pending' | 'done' | 'shipped' | 'cancelled',
  //          paid: boolean, paymentMethod: 'cash' | 'transfer' | 'payid' | null, paidAt (ISO), createdAt,
  //          createdBy: tên người tạo đơn }
  const addOrder = ({ type, customer, deliverAt, table, note, items, shippingFee, discount }) =>
    setOrders((prev) => [
      {
        id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
        number: prev.reduce((max, o) => Math.max(max, o.number ?? 0), 0) + 1,
        _provisional: true,
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
        createdBy: account?.name ?? null,
      },
      ...prev,
    ]);

  const setStatus = (id, status) => setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));

  // paidAt mặc định là lúc bấm; truyền vào khi cần khôi phục giá trị cũ (hoàn tác)
  const setPaid = (id, paid, paymentMethod = null, paidAt = paid ? new Date().toISOString() : null) =>
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, paid, paymentMethod: paid ? paymentMethod : null, paidAt } : o)),
    );

  // Sửa đơn đã tạo: thông tin khách, giờ giao, ghi chú, món. Giữ nguyên số đơn, trạng thái, thanh toán.
  const updateOrder = (id, { customer, deliverAt, table, note, items, shippingFee, discount }) =>
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, customer, deliverAt, table, note: note.trim(), items, shippingFee, discount } : o,
      ),
    );

  // Khôi phục từ Excel / chuyển dữ liệu cũ: chỉ thêm đơn chưa có (theo id), đơn đã có giữ nguyên.
  // Trả về số đơn được thêm.
  const importOrders = (list) => {
    const known = new Set(orders.map((o) => o.id));
    const fresh = list
      .filter((o) => !known.has(o.id))
      .map((o) => (o.type === 'dine-in' ? { ...o, type: 'pickup' } : o));
    setOrders(sort([...orders, ...fresh]));
    return fresh.length;
  };

  return { orders, ready, loadError, addOrder, updateOrder, setStatus, setPaid, importOrders };
}
