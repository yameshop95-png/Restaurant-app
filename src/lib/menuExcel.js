// Xuất / nhập thực đơn bằng file Excel (.xlsx).
// Thư viện được tải khi cần để không làm chậm lúc mở app.

const HEADERS = ['Tên món', 'Giá (A$)', 'Trạng thái'];

export async function exportMenu(menu) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const header = HEADERS.map((value) => ({ value, fontWeight: 'bold' }));
  // Giữ đúng thứ tự món như trong app
  const rows = menu.map((m) => [
    m.name,
    { value: m.price, type: Number, format: '0.00' },
    m.available === false ? 'Hết' : 'Còn',
  ]);
  const date = new Date().toISOString().slice(0, 10);
  await writeExcelFile([header, ...rows], {
    sheet: 'Thực đơn',
    columns: [{ width: 30 }, { width: 12 }, { width: 12 }],
  }).toFile(`thuc-don-${date}.xlsx`);
}

// Nhận file do app xuất ra, hoặc file tự soạn có cột "Tên món" và "Giá". Cột "Trạng thái" không bắt buộc.
export async function importMenuFile(file) {
  const { readSheet } = await import('read-excel-file/browser');
  const [headerRow = [], ...rows] = await readSheet(file);
  const headers = headerRow.map((h) => String(h ?? '').toLowerCase());
  const col = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const iName = col('tên', 'ten', 'món', 'name');
  const iPrice = col('giá', 'gia', 'price');
  const iStatus = col('trạng thái', 'trang thai', 'status');
  if (iName < 0 || iPrice < 0) throw new Error('File cần có cột "Tên món" và "Giá"');

  const items = [];
  for (const [index, row] of rows.entries()) {
    const name = row[iName] != null ? String(row[iName]).trim() : '';
    if (!name) continue;
    const price = Number(String(row[iPrice] ?? '').replace(/[^\d.,]/g, '').replace(',', '.'));
    if (!Number.isFinite(price) || String(row[iPrice] ?? '').trim() === '') {
      throw new Error(`Dòng ${index + 2}: giá của "${name}" chưa đúng`);
    }
    const status = iStatus >= 0 ? String(row[iStatus] ?? '').toLowerCase() : '';
    items.push({ name, price: Math.round(price * 100) / 100, available: !status.includes('hết') && !status.includes('het') });
  }
  return items;
}
