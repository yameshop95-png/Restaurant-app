import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { dateKey, fmtKey } from '../../lib/inventory';
import { Field, PrimaryButton, Sheet, inputClass, money, parseNum, qtyText } from './ui';

function PurchaseSheet({ ingredients, onSave, onClose }) {
  const [date, setDate] = useState(dateKey());
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [total, setTotal] = useState('');
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState(null);

  const ing = ingredients.find((i) => i.id === ingredientId);
  const q = parseNum(qty);
  const t = parseNum(total);
  const unitPrice = q > 0 && t >= 0 && total.trim() ? t / q : null;

  const save = () => {
    if (!ing) return setError('Chọn nguyên liệu (thêm ở mục Kho nếu chưa có)');
    if (!qty.trim() || !Number.isFinite(q) || q <= 0) return setError('Số lượng chưa đúng');
    if (!total.trim() || !Number.isFinite(t) || t < 0) return setError('Tổng tiền chưa đúng');
    onSave({ date, ingredientId, qty: q, total: Math.round(t * 100) / 100, supplier: supplier.trim() });
    onClose();
  };

  return (
    <Sheet
      title="Ghi nhập hàng"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={save} className="flex-1">
          Lưu
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày nhập">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass(false)} />
        </Field>
        <Field label="Nguyên liệu">
          <select value={ingredientId} onChange={(e) => setIngredientId(e.target.value)} className={inputClass(false)}>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Số lượng${ing ? ` (${ing.unit})` : ''}`}>
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="VD: 10" className={inputClass(false)} />
        </Field>
        <Field label="Tổng tiền (A$)" hint={unitPrice != null && ing ? `= ${money(unitPrice)} / ${ing.unit}` : undefined}>
          <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="VD: 120" className={inputClass(false)} />
        </Field>
      </div>
      <Field label="Nơi mua (không bắt buộc)">
        <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="VD: Chợ, Costco, Woolworths" className={inputClass(false)} />
      </Field>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </Sheet>
  );
}

// Lịch sử nhập hàng. Mỗi lần nhập cập nhật tồn kho và giá vốn nguyên liệu.
export default function PurchasesTab({ inventory }) {
  const [open, setOpen] = useState(false);
  const ingredients = inventory.ingredients.list;
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const purchases = inventory.purchases.list;
  const monthKey = dateKey().slice(0, 7);
  const monthTotal = purchases.filter((p) => String(p.date).startsWith(monthKey)).reduce((s, p) => s + Number(p.total || 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-500">Chi mua hàng tháng này</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">{money(monthTotal)}</p>
      </div>
      <PrimaryButton
        onClick={() => (ingredients.length ? setOpen(true) : window.alert('Thêm nguyên liệu ở mục Kho trước, rồi ghi nhập hàng.'))}
        className="flex w-full items-center justify-center gap-2"
      >
        <Plus size={18} /> Ghi nhập hàng
      </PrimaryButton>

      {purchases.length === 0 ? (
        <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">Chưa ghi lần nhập hàng nào</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
          {purchases.slice(0, 150).map((p) => {
            const ing = ingById.get(p.ingredientId);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{ing?.name ?? 'Nguyên liệu đã xoá'}</p>
                  <p className="text-xs text-slate-500">
                    {fmtKey(p.date)} · {qtyText(Number(p.qty))} {ing?.unit ?? ''}
                    {p.supplier ? ` · ${p.supplier}` : ''}
                  </p>
                </div>
                <p className="font-bold text-slate-900">{money(Number(p.total || 0))}</p>
                <button
                  onClick={() => window.confirm('Xoá lần nhập hàng này? Tồn kho và giá vốn sẽ tính lại.') && inventory.purchases.remove(p.id)}
                  aria-label="Xoá lần nhập"
                  className="rounded-lg p-2 text-red-500 active:bg-red-50"
                >
                  <Trash2 size={17} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="px-1 text-xs text-slate-500">
        Giá vốn nguyên liệu = trung bình có trọng số của 5 lần nhập gần nhất. Mua nguyên liệu mới thì thêm ở mục Kho trước.
      </p>

      {open && <PurchaseSheet ingredients={ingredients} onSave={(d) => inventory.purchases.add(d)} onClose={() => setOpen(false)} />}
    </div>
  );
}
