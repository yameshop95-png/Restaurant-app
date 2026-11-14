import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, dateKey, fmtKey } from '../../lib/inventory';
import { Field, PrimaryButton, Sheet, inputClass, money, parseNum } from './ui';

function ExpenseSheet({ onSave, onClose }) {
  const [date, setDate] = useState(dateKey());
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);
  const a = parseNum(amount);

  const save = () => {
    if (!amount.trim() || !Number.isFinite(a) || a <= 0) return setError('Số tiền chưa đúng');
    onSave({ date, category, amount: Math.round(a * 100) / 100, note: note.trim() });
    onClose();
  };

  return (
    <Sheet
      title="Ghi chi phí"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={save} className="flex-1">
          Lưu
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày chi">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass(false)} />
        </Field>
        <Field label="Số tiền (A$)" error={error}>
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="VD: 25" className={inputClass(error)} />
        </Field>
      </div>
      <Field label="Loại chi phí" hint="Tiền mua nguyên liệu ghi ở mục Nhập hàng, đừng ghi lại ở đây">
        <div className="flex flex-wrap gap-2">
          {EXPENSE_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${category === c ? 'bg-slate-900 text-slate-50' : 'bg-slate-100 text-slate-700'}`}
            >
              {c}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Ghi chú (không bắt buộc)">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: túi nilon, tiền xăng giao hàng" className={inputClass(false)} />
      </Field>
    </Sheet>
  );
}

// Chi phí ngoài nguyên liệu: bao bì, xăng, điện nước, thuê chỗ, quảng cáo, lương...
export default function ExpensesTab({ inventory }) {
  const [open, setOpen] = useState(false);
  const expenses = inventory.expenses.list;
  const monthKey = dateKey().slice(0, 7);
  const thisMonth = expenses.filter((e) => String(e.date).startsWith(monthKey));
  const monthTotal = thisMonth.reduce((s, e) => s + Number(e.amount || 0), 0);

  // Nhóm theo tháng để dễ đối chiếu
  const months = [];
  for (const e of expenses.slice(0, 300)) {
    const key = String(e.date).slice(0, 7);
    const last = months[months.length - 1];
    if (last?.key === key) last.items.push(e);
    else months.push({ key, items: [e] });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-500">Chi phí tháng này (không gồm nguyên liệu)</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">{money(monthTotal)}</p>
      </div>
      <PrimaryButton onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2">
        <Plus size={18} /> Ghi chi phí
      </PrimaryButton>

      {months.length === 0 && <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">Chưa ghi chi phí nào</p>}
      {months.map(({ key, items }) => (
        <section key={key}>
          <h3 className="mb-2 flex justify-between px-1 text-sm font-semibold text-slate-500">
            <span>
              Tháng {key.split('-')[1]}/{key.split('-')[0]}
            </span>
            <span>{money(items.reduce((s, e) => s + Number(e.amount || 0), 0))}</span>
          </h3>
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
            {items.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{e.category}</p>
                  <p className="truncate text-xs text-slate-500">
                    {fmtKey(e.date)}
                    {e.note ? ` · ${e.note}` : ''}
                  </p>
                </div>
                <p className="font-bold text-slate-900">{money(Number(e.amount || 0))}</p>
                <button
                  onClick={() => window.confirm('Xoá khoản chi này?') && inventory.expenses.remove(e.id)}
                  aria-label="Xoá khoản chi"
                  className="rounded-lg p-2 text-red-500 active:bg-red-50"
                >
                  <Trash2 size={17} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {open && <ExpenseSheet onSave={(d) => inventory.expenses.add(d)} onClose={() => setOpen(false)} />}
    </div>
  );
}
