// Danh bạ khách hàng <-> sheet Excel "Khách hàng"
import { boldHeader, pickSheet, readSheets, today, writeSheets } from './excelFile';

export const CUSTOMER_SHEET = 'Khách hàng';

export function customersSheet(customers) {
  const rows = [...customers]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((c) => [
      c.name,
      // Lưu SĐT dạng chữ để Excel không bỏ số 0 ở đầu
      { value: c.phone || null, type: String },
      c.address || null,
    ]);
  return {
    sheet: CUSTOMER_SHEET,
    data: [boldHeader(['Tên khách hàng', 'Số điện thoại', 'Địa chỉ']), ...rows],
    columns: [{ width: 28 }, { width: 18 }, { width: 50 }],
  };
}

export const exportCustomers = (customers) => writeSheets([customersSheet(customers)], `khach-hang-${today()}.xlsx`);

// Nhận sheet do app xuất ra, hoặc sheet tự soạn có cột "Tên", "SĐT"/"Điện thoại", "Địa chỉ".
export function parseCustomers(data) {
  if (!data) throw new Error(`Không tìm thấy sheet "${CUSTOMER_SHEET}" trong file`);
  const [headerRow = [], ...rows] = data;
  const headers = headerRow.map((h) => String(h ?? '').toLowerCase());
  const col = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const iName = col('tên', 'ten', 'name');
  const iPhone = col('điện thoại', 'sđt', 'sdt', 'phone');
  const iAddress = col('địa chỉ', 'dia chi', 'address');
  if (iName < 0) throw new Error('Không tìm thấy cột "Tên khách hàng" trong file');

  const cell = (row, i) => (i >= 0 && row[i] != null ? String(row[i]).trim() : '');
  return rows
    .map((row) => ({ name: cell(row, iName), phone: cell(row, iPhone), address: cell(row, iAddress) }))
    .filter((c) => c.name);
}

export const importCustomersFile = async (file) => parseCustomers(pickSheet(await readSheets(file), CUSTOMER_SHEET));
