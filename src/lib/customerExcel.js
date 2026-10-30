// Xuất / nhập danh bạ khách hàng bằng file Excel (.xlsx).
// Thư viện được tải khi cần để không làm chậm lúc mở app.

const HEADERS = ['Tên khách hàng', 'Số điện thoại', 'Địa chỉ', 'Đơn gần nhất'];

export async function exportCustomers(customers) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const header = HEADERS.map((value) => ({ value, fontWeight: 'bold' }));
  const rows = [...customers]
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'))
    .map((c) => [
      c.name,
      // Lưu SĐT dạng chữ để Excel không bỏ số 0 ở đầu
      { value: c.phone || null, type: String },
      c.address || null,
      c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString('vi-VN') : null,
    ]);
  const date = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows], {
    sheet: 'Khách hàng',
    columns: [{ width: 28 }, { width: 18 }, { width: 45 }, { width: 14 }],
  }).toFile(`khach-hang-${date}.xlsx`);
}

// Nhận file do app xuất ra, hoặc file tự soạn có cột "Tên", "SĐT"/"Điện thoại", "Địa chỉ".
export async function importCustomersFile(file) {
  const { readSheet } = await import('read-excel-file/browser');
  const [headerRow = [], ...rows] = await readSheet(file);
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
