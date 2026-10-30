// Xuất danh sách đơn đang xem (tab Đến lấy / Giao hàng) ra Excel để dễ xem và in:
//   sheet "Đơn hàng": mỗi đơn một dòng, theo đúng thứ tự trên màn hình
//   sheet "Tổng món": tổng số phần từng món trong các đơn đó, để bếp chuẩn bị
import { boldHeader, today, writeSheets } from './excelFile';
import { ORDER_TYPES, paymentLabel, statusLabel } from './orderStatus';
import { orderTotal } from './stats';

const pad = (n) => String(n).padStart(2, '0');
const when = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
};
const wrap = (value) => (value ? { value, wrap: true } : null);
const money = (value) => ({ value, type: Number, format: '0.00' });

export async function exportOrderList(orders, type, viewLabel) {
  const isDelivery = type === 'delivery';
  const info = ORDER_TYPES[type];

  const columns = [
    ['STT', 5],
    [info.timeLabel, 13],
    ['Số đơn', 7],
    ['Trạng thái', 12],
    ['Khách', 20],
    ['SĐT', 14],
    ...(isDelivery ? [['Địa chỉ', 32]] : []),
    ['Món', 34],
    ['Ghi chú', 24],
    ['Tổng (A$)', 10],
    ['Thanh toán', 16],
  ];
  const rows = orders.map((o, i) => [
    i + 1,
    when(o.deliverAt) ?? 'chưa hẹn giờ',
    o.number,
    statusLabel(o.status, o.type),
    o.customer?.name ?? null,
    { value: o.customer?.phone || null, type: String },
    ...(isDelivery ? [wrap(o.customer?.address)] : []),
    wrap(o.items.map((it) => `${it.qty} × ${it.name}${it.note ? ` (${it.note})` : ''}`).join('\n')),
    wrap(o.note),
    money(orderTotal(o)),
    o.paid ? `Đã trả${o.paymentMethod ? ` – ${paymentLabel(o.paymentMethod)}` : ''}` : 'CHƯA TRẢ',
  ]);
  const totalRow = columns.map(([name]) => {
    if (name === 'Khách') return { value: `${orders.length} đơn`, fontWeight: 'bold' };
    if (name === 'Tổng (A$)') return { ...money(orders.reduce((s, o) => s + orderTotal(o), 0)), fontWeight: 'bold' };
    return null;
  });

  // Tổng món: gộp theo tên món, liệt kê ghi chú kèm số đơn
  const dishes = new Map();
  for (const o of orders) {
    for (const it of o.items) {
      const row = dishes.get(it.name) ?? { qty: 0, notes: [] };
      row.qty += it.qty;
      if (it.note) row.notes.push(`#${o.number}: ${it.note}`);
      dishes.set(it.name, row);
    }
  }
  const dishRows = [...dishes.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, d]) => [name, d.qty, wrap(d.notes.join('\n'))]);

  const fileType = isDelivery ? 'giao-hang' : 'den-lay';
  await writeSheets(
    [
      {
        sheet: 'Đơn hàng',
        data: [
          [{ value: `${info.label} – ${viewLabel} – xuất lúc ${when(new Date().toISOString())}`, fontWeight: 'bold' }],
          boldHeader(columns.map(([name]) => name)),
          ...rows,
          totalRow,
        ],
        columns: columns.map(([, width]) => ({ width })),
        stickyRowsCount: 2,
      },
      {
        sheet: 'Tổng món',
        data: [boldHeader(['Món', 'Số phần', 'Ghi chú món']), ...dishRows],
        columns: [{ width: 26 }, { width: 9 }, { width: 40 }],
      },
    ],
    `${fileType}-${today()}.xlsx`
  );
}
