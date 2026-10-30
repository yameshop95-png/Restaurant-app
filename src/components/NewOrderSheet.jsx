import { useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';
import { MENU } from '../data/menu';
import { formatMoney } from '../lib/stats';

const TYPE_TEXT = {
  'dine-in': { title: 'Tạo đơn tại quán', notePlaceholder: 'Số bàn / tên khách (không bắt buộc)' },
  delivery: { title: 'Tạo đơn ship', notePlaceholder: 'Tên, SĐT, địa chỉ giao' },
};

export default function NewOrderSheet({ type, onSubmit, onClose }) {
  const [qty, setQty] = useState({});
  const [note, setNote] = useState('');

  const change = (id, delta) =>
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  const items = MENU.filter((m) => qty[m.id] > 0).map((m) => ({
    name: m.name,
    price: m.price,
    qty: qty[m.id],
  }));
  const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const count = items.reduce((sum, i) => sum + i.qty, 0);

  const submit = () => {
    if (!items.length) return;
    onSubmit({ type, note, items });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{TYPE_TEXT[type].title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={TYPE_TEXT[type].notePlaceholder}
            className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <ul className="divide-y divide-slate-100">
            {MENU.map((m) => {
              const n = qty[m.id] ?? 0;
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-sm text-slate-500">{formatMoney(m.price)}</p>
                  </div>
                  {n > 0 && (
                    <>
                      <button
                        onClick={() => change(m.id, -1)}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 active:bg-slate-200"
                        aria-label={`Bớt ${m.name}`}
                      >
                        <Minus size={18} />
                      </button>
                      <span className="w-6 text-center text-lg font-bold">{n}</span>
                    </>
                  )}
                  <button
                    onClick={() => change(m.id, 1)}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500 text-white active:bg-blue-600"
                    aria-label={`Thêm ${m.name}`}
                  >
                    <Plus size={18} />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t border-slate-200 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={submit}
            disabled={!items.length}
            className="flex w-full items-center justify-between rounded-2xl bg-blue-500 px-5 py-4 text-base font-semibold text-white active:bg-blue-600 disabled:bg-slate-300"
          >
            <span>{items.length ? `Tạo đơn · ${count} món` : 'Chọn món để tạo đơn'}</span>
            <span>{formatMoney(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
