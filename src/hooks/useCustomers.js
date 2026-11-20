import useCloudList, { dataOf } from './useCloudList';
import { supabase } from '../lib/supabase';
import { normalizeText } from '../lib/text';

// Danh bạ khách hàng, lưu trên máy chủ dùng chung. Sao lưu/khôi phục bằng file Excel ở tab "Cài đặt app".

export { normalizeText };

const phoneKey = (phone) => phone.replace(/\D/g, '');
// Khách được nhận diện theo số điện thoại; không có SĐT thì theo tên.
export const customerKey = (c) => phoneKey(c.phone ?? '') || `name:${normalizeText(c.name)}`;
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function mergeInto(list, incoming) {
  const map = new Map(list.map((c) => [customerKey(c), c]));
  for (const c of incoming) {
    if (!c.name?.trim()) continue;
    const key = customerKey(c);
    const prev = map.get(key);
    // Giữ các thông tin khác đã có của khách (VD: đồng ý nhận tin nhắn), chỉ cập nhật tên / SĐT / địa chỉ
    map.set(key, {
      ...prev,
      id: prev?.id ?? newId(),
      name: c.name.trim(),
      phone: (c.phone ?? '').trim(),
      address: (c.address || prev?.address || '').trim(),
      lastOrderAt: [prev?.lastOrderAt, c.lastOrderAt].filter(Boolean).sort().pop() ?? null,
      // Thêm khách mới có đánh dấu đồng ý nhận tin: ghi lại thời điểm đồng ý
      ...(c.marketingConsent != null && {
        marketingConsent: c.marketingConsent,
        consentAt: c.marketingConsent ? (prev?.consentAt ?? new Date().toISOString()) : null,
      }),
    });
  }
  return [...map.values()];
}

const fromRow = (row) => ({ ...row.data, id: row.id });

function write({ added, changed, removed }) {
  const ops = [];
  const rows = [...added, ...changed.map(([, c]) => c)].map((c) => ({ id: c.id, data: dataOf(c) }));
  if (rows.length) {
    ops.push({
      rowId: rows.length === 1 ? rows[0].id : undefined,
      run: () => supabase.from('customers').upsert(rows),
      spec: { kind: 'upsert', table: 'customers', rows },
      onDone: () => {},
    });
  }
  for (const c of removed) {
    ops.push({
      rowId: c.id,
      run: () => supabase.from('customers').delete().eq('id', c.id),
      spec: { kind: 'delete', table: 'customers', rowId: c.id },
      onDone: () => {},
    });
  }
  return ops;
}

export default function useCustomers() {
  const { list: customers, setList: setCustomers, ready } = useCloudList('customers', { fromRow, write });

  const saveCustomer = (customer) =>
    setCustomers((prev) => mergeInto(prev, [{ ...customer, lastOrderAt: new Date().toISOString() }]));

  // Trả về số khách được thêm mới sau khi gộp, để báo cho người dùng.
  const importCustomers = (list) => {
    const next = mergeInto(customers, list);
    setCustomers(next);
    return next.length - customers.length;
  };

  const updateCustomer = (id, data) =>
    setCustomers((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              name: data.name.trim(),
              phone: data.phone.trim(),
              address: data.address.trim(),
              ...(data.marketingConsent != null && {
                marketingConsent: data.marketingConsent,
                consentAt: data.marketingConsent ? (c.marketingConsent ? c.consentAt : new Date().toISOString()) : null,
              }),
            }
          : c
      )
    );

  const deleteCustomer = (id) => setCustomers((prev) => prev.filter((c) => c.id !== id));

  return { customers, ready, saveCustomer, importCustomers, updateCustomer, deleteCustomer };
}

export const sameCustomer = (a, b) => customerKey(a) === customerKey(b);

export const matchesCustomer = (c, query) => {
  const q = normalizeText(query);
  const digits = phoneKey(query);
  return (
    normalizeText(c.name).includes(q) ||
    normalizeText(c.address ?? '').includes(q) ||
    (digits.length >= 3 && phoneKey(c.phone).includes(digits))
  );
};

export function searchCustomers(customers, query, limit = 6) {
  if (!normalizeText(query)) return [];
  return customers
    .filter((c) => matchesCustomer(c, query))
    .sort((a, b) => (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? ''))
    .slice(0, limit);
}
