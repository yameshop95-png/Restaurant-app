import { useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2, X } from 'lucide-react';
import { normalizeText } from '../hooks/useCustomers';
import { formatMoney } from '../lib/stats';

const inputClass = (error) =>
  `w-full rounded-xl border px-4 py-3 text-base outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;

function MenuItemSheet({ item, menu, onSave, onDelete, onClose }) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(item ? String(item.price) : '');
  const [submitted, setSubmitted] = useState(false);

  const priceValue = Number(price.replace(',', '.'));
  const errors = {};
  if (!name.trim()) errors.name = 'Nhập tên món';
  else if (menu.some((m) => m.id !== item?.id && normalizeText(m.name) === normalizeText(name)))
    errors.name = 'Đã có món này trong thực đơn';
  if (!price.trim() || !Number.isFinite(priceValue) || priceValue < 0) errors.price = 'Giá chưa đúng';
  const shown = submitted ? errors : {};

  const save = () => {
    setSubmitted(true);
    if (Object.keys(errors).length) return;
    onSave({ name, price: Math.round(priceValue * 100) / 100 });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-white pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{item ? 'Sửa món' : 'Thêm món'}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Tên món <span className="text-red-500">*</span>
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass(shown.name)} />
            {shown.name && <span className="mt-1 block text-sm text-red-600">{shown.name}</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">
              Giá (A$) <span className="text-red-500">*</span>
            </span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="VD: 15 hoặc 12.50"
              className={inputClass(shown.price)}
            />
            {shown.price && <span className="mt-1 block text-sm text-red-600">{shown.price}</span>}
          </label>
          {item && (
            <p className="text-sm text-slate-500">Đổi giá chỉ áp dụng cho đơn mới, các đơn đã tạo giữ giá cũ.</p>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
          {item && (
            <button
              onClick={() => {
                if (window.confirm(`Xoá món "${item.name}" khỏi thực đơn? Các đơn cũ vẫn giữ món này.`)) {
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

// Nhân viên chỉ báo Còn / Hết; thêm, sửa giá, xoá, đổi thứ tự là việc của chủ quán
export default function MenuPage({ menu, isOwner, onAddMenuItem, onUpdateMenuItem, onDeleteMenuItem, onMoveMenuItem }) {
  // undefined: đóng · null: thêm món mới · object: sửa món đó
  const [editing, setEditing] = useState(undefined);
  const availableCount = menu.filter((m) => m.available !== false).length;

  return (
    <div className="mx-auto max-w-2xl pb-24">
      <p className="mb-3 text-sm text-slate-500">
        {menu.length} món · <span className="font-semibold text-emerald-600">{availableCount} còn</span>
        {menu.length > availableCount && (
          <span className="font-semibold text-red-600"> · {menu.length - availableCount} hết</span>
        )}
        <span className="block">Món "Hết" sẽ bị ẩn khi tạo đơn mới.</span>
        {!isOwner && <span className="block">Chỉ chủ quán mới thêm món, sửa giá được.</span>}
      </p>

      {menu.length === 0 ? (
        <p className="rounded-3xl bg-white/60 px-5 py-12 text-center text-slate-400">Chưa có món nào</p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
          {menu.map((m, i) => {
            const available = m.available !== false;
            return (
              <li key={m.id} className={`flex items-center gap-2 px-3 py-3 ${available ? '' : 'bg-slate-50'}`}>
                {isOwner && (
                  <div className="flex flex-col">
                    <button
                      onClick={() => onMoveMenuItem(m.id, -1)}
                      disabled={i === 0}
                      className="rounded p-0.5 text-slate-400 active:bg-slate-100 disabled:opacity-20"
                      aria-label={`Đưa ${m.name} lên`}
                    >
                      <ChevronUp size={18} />
                    </button>
                    <button
                      onClick={() => onMoveMenuItem(m.id, 1)}
                      disabled={i === menu.length - 1}
                      className="rounded p-0.5 text-slate-400 active:bg-slate-100 disabled:opacity-20"
                      aria-label={`Đưa ${m.name} xuống`}
                    >
                      <ChevronDown size={18} />
                    </button>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className={`font-semibold ${available ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                    {m.name}
                  </p>
                  <p className="text-sm text-slate-500">{formatMoney(m.price)}</p>
                </div>

                <button
                  onClick={() => onUpdateMenuItem(m.id, { available: !available })}
                  className={`w-16 shrink-0 rounded-full py-1.5 text-sm font-bold ${
                    available ? 'bg-emerald-100 text-emerald-700' : 'bg-red-500 text-white'
                  }`}
                  aria-label={`${m.name}: ${available ? 'còn món, bấm để báo hết' : 'hết món, bấm để báo còn'}`}
                >
                  {available ? 'Còn' : 'Hết'}
                </button>
                {isOwner && (
                  <button
                    onClick={() => setEditing(m)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-200"
                  >
                    <Pencil size={14} /> Sửa
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {isOwner && (
        <button
          onClick={() => setEditing(null)}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-5 lg:bottom-6 z-20 flex items-center gap-2 rounded-full bg-blue-500 px-6 py-4 text-base font-semibold text-white shadow-lg shadow-blue-500/30 active:bg-blue-600"
        >
          <Plus size={20} /> Thêm món
        </button>
      )}

      {editing !== undefined && (
        <MenuItemSheet
          item={editing}
          menu={menu}
          onSave={(data) => (editing ? onUpdateMenuItem(editing.id, data) : onAddMenuItem(data))}
          onDelete={() => onDeleteMenuItem(editing.id)}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}
