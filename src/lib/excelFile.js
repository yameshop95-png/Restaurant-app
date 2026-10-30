// Đọc / ghi file Excel nhiều sheet. Thư viện được tải khi cần để không làm chậm lúc mở app.

export const today = () => new Date().toISOString().slice(0, 10);

// sheets: [{ sheet: 'Tên sheet', data: [[...hàng]], columns: [{ width }] }]
export async function writeSheets(sheets, fileName) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  await writeExcelFile(sheets.map((s) => ({ stickyRowsCount: 1, ...s }))).toFile(fileName);
}

// Trả về [{ sheet, data }] của mọi sheet trong file
export async function readSheets(file) {
  const { default: readExcelFile } = await import('read-excel-file/browser');
  return readExcelFile(file);
}

// Lấy sheet theo tên (file sao lưu tổng có nhiều sheet); file chỉ có một sheet thì dùng sheet đó.
export function pickSheet(sheets, name) {
  return (sheets.find((s) => s.sheet === name) ?? (sheets.length === 1 ? sheets[0] : null))?.data ?? null;
}

export const boldHeader = (names) => names.map((value) => ({ value, fontWeight: 'bold' }));
