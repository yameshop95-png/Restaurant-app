import { useState } from 'react';
import { MapPin, Pencil, Phone, Plus, Search, Trash2, UserRound, X } from 'lucide-react';
import { matchesCustomer, sameCustomer } from '../hooks/useCustomers';
import { formatMoney, orderTotal } from '../lib/stats';

const inputClass = (error) =>
  `w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;

function CustomerSheet({ customer, onSave, onDelete, onClose }) {
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    address: customer?.address ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const errors = {};
  if (!form.name.trim()) errors.name = 'Nhập tên khách hàng';
  if (form.phone.replace(/\D/g, '').length < 8) errors.phone = 'Số điện thoại chưa đúng';
  const shown = submitted ? errors : {};

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    onSave(form);
    onClose();
  };

  const fields = [
    { key: 'name', label: 'Tên khách hàng', required: true },
    { key: 'phone', label: 'Số điện thoại', required: true, type: 'tel' },
    { key: 'address', label: 'Địa chỉ', multiline: true },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{customer ? 'Sửa khách hàng' : 'Thêm khách hàng'}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {fields.map(({ key, label, required, type, multiline }) => (
            <label key={key} className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                {label} {required && <span className="text-red-500">*</span>}
              </span>
              {multiline ? (
                <textarea rows={2} value={form[key]} onChange={set(key)} className={inputClass(shown[key])} />
              ) : (
                <input type={type ?? 'text'} value={form[key]} onChange={set(key)} className={inputClass(shown[key])} />
              )}
              {shown[key] && <span className="mt-1 block text-sm text-red-600">{shown[key]}</span>}
            </label>
          ))}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
          {customer && (
            <button
              onClick={() => {
                if (window.confirm(`Xoá khách "${customer.name}" khỏi danh bạ? Các đơn cũ vẫn được giữ.`)) {
                  onDelete();
                  onClose();
                }
              }}
              className="flex items-center gap-1.5 rounded-2xl bg-red-50 px-4 py-3.5 font-semibold text-red-600 active:bg-red-100"
            >
              <Trash2 size={18} /> Xoá
            </button>
          )}
          <button
            onClick={save}
            className="flex-1 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white active:bg-blue-600"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CustomersPage({ customers, orders, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) {
  const [query, setQuery] = useState('');
  // undefined: đóng · null: thêm khách mới · object: sửa khách đó
  const [editing, setEditing] = useState(undefined);

  const stats = (c) => {
    const list = orders.filter((o) => o.customer && o.status !== 'cancelled' && sameCustomer(o.customer, c));
    return { count: list.length, total: list.reduce((sum, o) => sum + orderTotal(o), 0) };
  };

  const visible = customers
    .filter((c) => !query.trim() || matchesCustomer(c, query))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi'));

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <div className="relative mb-4">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Tìm trong ${customers.length} khách (tên, SĐT, địa chỉ)`}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {visible.length === 0 ? (
        <p className="rounded-3xl bg-white/60 px-5 py-12 text-center text-slate-400">
          {customers.length ? 'Không tìm thấy khách nào' : 'Chưa có khách hàng. Khách sẽ tự được lưu khi tạo đơn.'}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
          {visible.map((c) => {
            const s = stats(c);
            return (
              <li key={c.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <UserRound size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{c.name}</p>
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-sm text-slate-600">
                      <Phone size={13} /> {c.phone}
                    </a>
                  )}
                  {c.address && (
                    <p className="flex items-start gap-1.5 text-sm text-slate-500">
                      <MapPin size={13} className="mt-0.5 shrink-0" /> {c.address}
                    </p>
                  )}
                  {s.count > 0 && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {s.count} đơn · {formatMoney(s.total)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setEditing(c)}
                  className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-200"
                >
                  <Pencil size={14} /> Sửa
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        onClick={() => setEditing(null)}
        className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-5 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 active:bg-blue-600"
      >
        <Plus size={20} /> Thêm khách
      </button>

      {editing !== undefined && (
        <CustomerSheet
          customer={editing}
          onSave={(data) => (editing ? onUpdateCustomer(editing.id, data) : onAddCustomer(data))}
          onDelete={() => onDeleteCustomer(editing.id)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
