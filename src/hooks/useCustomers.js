import { useEffect, useState } from 'react';

// Danh bạ khách hàng, lưu riêng với đơn hàng trong localStorage.
// Sao lưu/khôi phục bằng file Excel ở tab "Cài đặt app".
const STORAGE_KEY = 'restaurant-app.customers';
const ORDERS_KEY = 'restaurant-app.orders';

// Bỏ dấu + chữ thường để tìm "lan" ra "Lan", "Lân", "LAN"...
export const normalizeText = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();

const phoneKey = (phone) => phone.replace(/\D/g, '');
// Khách được nhận diện theo số điện thoại; không có SĐT thì theo tên.
const customerKey = (c) => phoneKey(c.phone ?? '') || `name:${normalizeText(c.name)}`;

function mergeInto(list, incoming) {
  const map = new Map(list.map((c) => [customerKey(c), c]));
  for (const c of incoming) {
    if (!c.name?.trim()) continue;
    const key = customerKey(c);
    const prev = map.get(key);
    map.set(key, {
      name: c.name.trim(),
      phone: (c.phone ?? '').trim(),
      address: (c.address || prev?.address || '').trim(),
      lastOrderAt: [prev?.lastOrderAt, c.lastOrderAt].filter(Boolean).sort().pop() ?? null,
    });
  }
  return [...map.values()];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
    // Lần đầu chạy: lấy khách từ các đơn đã có.
    const orders = JSON.parse(localStorage.getItem(ORDERS_KEY)) ?? [];
    return mergeInto(
      [],
      orders
        .filter((o) => o.customer)
        .reverse()
        .map((o) => ({ ...o.customer, lastOrderAt: o.createdAt }))
    );
  } catch {
    return [];
  }
}

export default function useCustomers() {
  const [customers, setCustomers] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
    } catch {
      // Không lưu được (chế độ ẩn danh...): vẫn dùng được trong phiên hiện tại.
    }
  }, [customers]);

  const saveCustomer = (customer) =>
    setCustomers((prev) => mergeInto(prev, [{ ...customer, lastOrderAt: new Date().toISOString() }]));

  // Trả về số khách sau khi gộp, để báo cho người dùng.
  const importCustomers = (list) => {
    const next = mergeInto(customers, list);
    setCustomers(next);
    return next.length - customers.length;
  };

  return { customers, saveCustomer, importCustomers };
}

export function searchCustomers(customers, query, limit = 6) {
  const q = normalizeText(query);
  const digits = phoneKey(query);
  if (!q) return [];
  return customers
    .filter((c) => normalizeText(c.name).includes(q) || (digits.length >= 3 && phoneKey(c.phone).includes(digits)))
    .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''))
    .slice(0, limit);
}
