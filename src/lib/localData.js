// Dữ liệu bản cũ lưu riêng trên từng máy (localStorage), trước khi có máy chủ dùng chung.
// Chủ quán chuyển lên máy chủ một lần ở Cài đặt app.
import { mergeInto } from '../hooks/useCustomers';
import { SHOP_KEYS, loadLocalSettings } from '../hooks/useSettings';

const KEYS = { orders: 'restaurant-app.orders', customers: 'restaurant-app.customers', menu: 'restaurant-app.menu' };
const DONE_KEY = 'restaurant-app.migrated';

const read = (key) => {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
};

export function readLocalData() {
  const orders = read(KEYS.orders) ?? [];
  // Bản cũ có thể chưa lưu danh bạ riêng: lấy khách từ các đơn
  const customers =
    read(KEYS.customers) ??
    mergeInto(
      [],
      orders
        .filter((o) => o.customer?.phone)
        .reverse()
        .map((o) => ({ ...o.customer, lastOrderAt: o.createdAt })),
    );
  const settings = loadLocalSettings();
  const shop = Object.fromEntries(SHOP_KEYS.filter((k) => settings[k]).map((k) => [k, settings[k]]));
  return { orders, customers, menu: read(KEYS.menu) ?? [], shop };
}

export const hasLocalData = () => {
  const { orders, customers } = readLocalData();
  return orders.length + customers.length > 0;
};

export const localDataMoved = () => {
  try {
    return Boolean(localStorage.getItem(DONE_KEY));
  } catch {
    return false;
  }
};

export const markLocalDataMoved = () => {
  try {
    localStorage.setItem(DONE_KEY, new Date().toISOString());
  } catch {
    // không lưu được thì lần sau vẫn hiện nút, chuyển lại cũng không bị trùng
  }
};
