// Thực đơn <-> sheet Excel "Thực đơn"
import { boldHeader, pickSheet, readSheets, today, writeSheets } from './excelFile';

export const MENU_SHEET = 'Thực đơn';

export function menuSheet(menu) {
  // Giữ đúng thứ tự món như trong app
  const rows = menu.map((m) => [
    m.name,
    { value: m.price, type: Number, format: '0.00' },
    m.available === false ? 'Hết' : 'Còn',
    m.portion ?? '',
  ]);
  return {
    sheet: MENU_SHEET,
    data: [boldHeader(['Tên món', 'Giá (A$)', 'Trạng thái', 'Định lượng']), ...rows],
    columns: [{ width: 30 }, { width: 12 }, { width: 12 }, { width: 28 }],
  };
}

export const exportMenu = (menu) => writeSheets([menuSheet(menu)], `thuc-don-${today()}.xlsx`);

// Nhận sheet do app xuất ra, hoặc sheet tự soạn có cột "Tên món" và "Giá". Cột "Trạng thái", "Định lượng" không bắt buộc.
export function parseMenu(data) {
  if (!data) throw new Error(`Không tìm thấy sheet "${MENU_SHEET}" trong file`);
  const [headerRow = [], ...rows] = data;
  const headers = headerRow.map((h) => String(h ?? '').toLowerCase());
  const col = (...keys) => headers.findIndex((h) => keys.some((k) => h.includes(k)));
  const iName = col('tên', 'ten', 'món', 'name');
  const iPrice = col('giá', 'gia', 'price');
  const iStatus = col('trạng thái', 'trang thai', 'status');
  const iPortion = col('định lượng', 'dinh luong', 'portion');
  if (iName < 0 || iPrice < 0) throw new Error('File cần có cột "Tên món" và "Giá"');

  const items = [];
  for (const [index, row] of rows.entries()) {
    const name = row[iName] != null ? String(row[iName]).trim() : '';
    if (!name) continue;
    const price = Number(
      String(row[iPrice] ?? '')
        .replace(/[^\d.,]/g, '')
        .replace(',', '.'),
    );
    if (!Number.isFinite(price) || String(row[iPrice] ?? '').trim() === '') {
      throw new Error(`Dòng ${index + 2}: giá của "${name}" chưa đúng`);
    }
    const status = iStatus >= 0 ? String(row[iStatus] ?? '').toLowerCase() : '';
    items.push({
      name,
      price: Math.round(price * 100) / 100,
      available: !status.includes('hết') && !status.includes('het'),
      ...(iPortion >= 0 && { portion: String(row[iPortion] ?? '').trim() }),
    });
  }
  return items;
}

export const importMenuFile = async (file) => parseMenu(pickSheet(await readSheets(file), MENU_SHEET));
