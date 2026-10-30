// Sao lưu / khôi phục tất cả dữ liệu trong MỘT file Excel có 3 sheet.
import { CUSTOMER_SHEET, customersSheet, parseCustomers } from './customerExcel';
import { readSheets, today, writeSheets } from './excelFile';
import { MENU_SHEET, menuSheet, parseMenu } from './menuExcel';
import { ORDER_SHEET, ordersSheet, parseOrders } from './orderExcel';

export const BACKUP_REMINDER_DAYS = 7;

export const exportAll = ({ orders, customers, menu }) =>
  writeSheets([ordersSheet(orders), customersSheet(customers), menuSheet(menu)], `sao-luu-${today()}.xlsx`);

// Đọc file sao lưu tổng; sheet nào thiếu thì bỏ qua. Trả về { orders?, customers?, menu? }.
export async function readBackup(file) {
  const sheets = await readSheets(file);
  const find = (name) => sheets.find((s) => s.sheet === name)?.data;
  const result = {};
  if (find(ORDER_SHEET)) result.orders = parseOrders(find(ORDER_SHEET));
  if (find(CUSTOMER_SHEET)) result.customers = parseCustomers(find(CUSTOMER_SHEET));
  if (find(MENU_SHEET)) result.menu = parseMenu(find(MENU_SHEET));
  if (!Object.keys(result).length) {
    throw new Error('Không phải file sao lưu của app (cần sheet "Đơn hàng", "Khách hàng" hoặc "Thực đơn")');
  }
  return result;
}

export function daysSinceBackup(lastBackupAt, now = new Date()) {
  return lastBackupAt ? Math.floor((now - new Date(lastBackupAt)) / 86400000) : null;
}
