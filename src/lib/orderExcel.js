// Đơn hàng <-> sheet Excel "Đơn hàng".
// Mỗi dòng là một món trong đơn; các dòng cùng "Mã đơn" thuộc cùng một đơn.
import { boldHeader, pickSheet, readSheets, today, writeSheets } from './excelFile';

export const ORDER_SHEET = 'Đơn hàng';

const COLUMNS = [
  ['Mã đơn', 38],
  ['Số đơn', 8],
  ['Ngày tạo', 17],
  ['Loại', 10],
  ['Trạng thái', 12],
  ['Thanh toán', 15],
  ['Tên khách', 22],
  ['SĐT', 15],
  ['Địa chỉ', 35],
  ['Giờ giao', 17],
  ['Ghi chú', 25],
  ['Món', 22],
  ['Số lượng', 9],
  ['Đơn giá', 9],
  ['Thành tiền', 11],
];

const TYPE_TEXT = { 'dine-in': 'Tại quán', delivery: 'Ship' };
const STATUS_TEXT = { pending: 'Chờ xử lý', done: 'Hoàn thành', shipped: 'Đã ship', cancelled: 'Đã huỷ' };
const reverse = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [v.toLowerCase(), k]));
const TYPE_KEY = reverse(TYPE_TEXT);
const STATUS_KEY = reverse(STATUS_TEXT);

// Ngày giờ ghi dạng chữ "dd/mm/yyyy HH:mm" theo giờ máy, để đọc lại không bị lệch múi giờ
const pad = (n) => String(n).padStart(2, '0');
function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function parseDateTime(value) {
  if (value instanceof Date) return value.toISOString();
  const m = String(value ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = '0', mi = '0'] = m;
  return new Date(+yyyy, +mm - 1, +dd, +hh, +mi).toISOString();
}

export function ordersSheet(orders) {
  const rows = [...orders]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((o) =>
      o.items.map((item) => [
        o.id,
        o.number,
        formatDateTime(o.createdAt),
        TYPE_TEXT[o.type] ?? o.type,
        STATUS_TEXT[o.status] ?? o.status,
        o.paid ? 'Đã thanh toán' : 'Chưa thanh toán',
        o.customer?.name ?? null,
        { value: o.customer?.phone || null, type: String },
        o.customer?.address ?? null,
        formatDateTime(o.deliverAt),
        o.note || null,
        item.name,
        item.qty,
        { value: item.price, type: Number, format: '0.00' },
        { value: item.qty * item.price, type: Number, format: '0.00' },
      ])
    );
  return {
    sheet: ORDER_SHEET,
    data: [boldHeader(COLUMNS.map(([name]) => name)), ...rows],
    columns: COLUMNS.map(([, width]) => ({ width })),
  };
}

export const exportOrders = (orders) => writeSheets([ordersSheet(orders)], `don-hang-${today()}.xlsx`);

export function parseOrders(data) {
  if (!data) throw new Error(`Không tìm thấy sheet "${ORDER_SHEET}" trong file`);
  const [headerRow = [], ...rows] = data;
  const headers = headerRow.map((h) => String(h ?? '').trim().toLowerCase());
  const idx = Object.fromEntries(COLUMNS.map(([name]) => [name, headers.indexOf(name.toLowerCase())]));
  if (idx['Mã đơn'] < 0 || idx['Món'] < 0) {
    throw new Error('Đây không phải file đơn hàng do app tải về (thiếu cột "Mã đơn" hoặc "Món")');
  }
  const get = (row, name) => (idx[name] >= 0 && row[idx[name]] != null ? row[idx[name]] : '');
  const text = (row, name) => String(get(row, name)).trim();

  const byId = new Map();
  for (const row of rows) {
    const id = text(row, 'Mã đơn');
    const itemName = text(row, 'Món');
    if (!id || !itemName) continue;
    if (!byId.has(id)) {
      const name = text(row, 'Tên khách');
      byId.set(id, {
        id,
        number: Number(get(row, 'Số đơn')) || 0,
        createdAt: parseDateTime(get(row, 'Ngày tạo')) ?? new Date().toISOString(),
        type: TYPE_KEY[text(row, 'Loại').toLowerCase()] ?? 'dine-in',
        status: STATUS_KEY[text(row, 'Trạng thái').toLowerCase()] ?? 'pending',
        paid: text(row, 'Thanh toán').toLowerCase() === 'đã thanh toán',
        customer: name ? { name, phone: text(row, 'SĐT'), address: text(row, 'Địa chỉ') } : null,
        deliverAt: parseDateTime(get(row, 'Giờ giao')),
        note: text(row, 'Ghi chú'),
        items: [],
      });
    }
    byId.get(id).items.push({
      name: itemName,
      qty: Number(get(row, 'Số lượng')) || 1,
      price: Number(get(row, 'Đơn giá')) || 0,
    });
  }
  return [...byId.values()];
}

export const importOrdersFile = async (file) => parseOrders(pickSheet(await readSheets(file), ORDER_SHEET));
