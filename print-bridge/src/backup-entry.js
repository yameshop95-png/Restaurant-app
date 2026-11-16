// Gói sẵn (bằng esbuild) thành print-bridge/backup-lib.mjs để máy tính ở quán không phải cài thêm thư viện.
// Dựng lại sau khi sửa file này hoặc các file Excel trong src/lib: npm run build:bridge
import writeXlsxFile from 'write-excel-file/node';
import { customersSheet } from '../../src/lib/customerExcel.js';
import { menuSheet } from '../../src/lib/menuExcel.js';
import { ordersSheet } from '../../src/lib/orderExcel.js';

// Dòng trên máy chủ → dữ liệu như trong app, rồi → file Excel cùng dạng nút "Sao lưu ngay" (khôi phục được trong app)
export async function backupXlsx({ orderRows, customerRows, menuRows }) {
  const orders = orderRows.map((r) => ({ ...r.data, id: r.id, number: r.number }));
  const customers = customerRows.map((r) => ({ ...r.data, id: r.id }));
  const menu = [...menuRows]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((r) => ({ ...r.data, id: r.id, _position: r.position ?? 0 }));
  const sheets = [ordersSheet(orders), customersSheet(customers), menuSheet(menu)].map((s) => ({ stickyRowsCount: 1, ...s }));
  return writeXlsxFile(sheets).toBuffer();
}
