import { useState } from 'react';
import { AlertTriangle, Plus } from 'lucide-react';
import { ADJUST_REASONS, UNITS, dateKey } from '../../lib/inventory';
import { Card, Field, PrimaryButton, Sheet, inputClass, money, parseNum, qtyText } from './ui';

function IngredientSheet({ level, ingredients, adjustments, onSave, onDelete, onClose }) {
  const ing = level?.ingredient;
  const [name, setName] = useState(ing?.name ?? '');
  const [unit, setUnit] = useState(ing?.unit ?? 'kg');
  const [min, setMin] = useState(ing?.minStock ? String(ing.minStock) : '');
  const [count, setCount] = useState('');
  const [waste, setWaste] = useState('');
  const [error, setError] = useState(null);

  const save = () => {
    const minValue = min.trim() ? parseNum(min) : 0;
    if (!name.trim()) return setError('Nhập tên nguyên liệu');
    if (ingredients.some((i) => i.id !== ing?.id && i.name.trim().toLowerCase() === name.trim().toLowerCase()))
      return setError('Đã có nguyên liệu này');
    if (!Number.isFinite(minValue) || minValue < 0) return setError('Mức cảnh báo chưa đúng');
    onSave({ name: name.trim(), unit, minStock: minValue });
    onClose();
  };

  const adjust = (qty, reason, note) => {
    adjustments.add({ date: dateKey(), ingredientId: ing.id, qty, reason, note });
    onClose();
  };

  const countValue = parseNum(count);
  const wasteValue = parseNum(waste);

  return (
    <Sheet
      title={ing ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu'}
      onClose={onClose}
      footer={
        <>
          {ing && (
            <button
              onClick={() => {
                if (window.confirm(`Xoá nguyên liệu "${ing.name}"? Các lần nhập hàng của nó vẫn còn trong lịch sử.`)) {
                  onDelete();
                  onClose();
                }
              }}
              className="rounded-2xl bg-red-50 px-4 py-3.5 font-semibold text-red-600 active:bg-red-100"
            >
              Xoá
            </button>
          )}
          <PrimaryButton onClick={save} className="flex-1">
            Lưu
          </PrimaryButton>
        </>
      }
    >
      <Field label="Tên nguyên liệu *" error={error}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Thịt heo, Bột gạo" className={inputClass(error)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Đơn vị" hint="Đơn vị lúc nhập hàng và đếm kho">
          <select value={unit} onChange={(e) => setUnit(e.target.value)} className={inputClass(false)}>
            {UNITS.map((u) => (
              <option key={u} value={u} className="bg-card">
                {u}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Báo khi còn ≤" hint="Để trống nếu không cần">
          <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} placeholder="0" className={inputClass(false)} />
        </Field>
      </div>

      {ing && (
        <>
          <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
            Tồn kho hiện tại:{' '}
            <b>
              {qtyText(level.stock)} {ing.unit}
            </b>
          </div>
          <Field label={`Kiểm kho: số thực tế đếm được (${ing.unit})`} hint="App tự ghi chênh lệch so với tồn trên sổ">
            <div className="flex gap-2">
              <input inputMode="decimal" value={count} onChange={(e) => setCount(e.target.value)} className={inputClass(false)} />
              <button
                disabled={!count.trim() || !Number.isFinite(countValue) || countValue < 0}
                onClick={() => adjust(Math.round((countValue - level.stock) * 1000) / 1000, 'count', `Kiểm kho: đếm ${countValue}`)}
                className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-slate-50 disabled:opacity-40"
              >
                Ghi
              </button>
            </div>
          </Field>
          <Field label={`Hao hụt / hỏng (${ing.unit})`} hint="Số lượng bỏ đi, trừ khỏi kho">
            <div className="flex gap-2">
              <input inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value)} className={inputClass(false)} />
              <button
                disabled={!waste.trim() || !Number.isFinite(wasteValue) || wasteValue <= 0}
                onClick={() => adjust(-wasteValue, 'waste', ADJUST_REASONS.waste)}
                className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-slate-50 disabled:opacity-40"
              >
                Ghi
              </button>
            </div>
          </Field>
        </>
      )}
    </Sheet>
  );
}

// Tồn kho từng nguyên liệu, cảnh báo sắp hết, kiểm kho
export default function StockTab({ levels, inventory }) {
  const [editing, setEditing] = useState(null); // null | 'new' | level
  const totalValue = levels.reduce((s, l) => s + l.value, 0);
  const lowCount = levels.filter((l) => l.low || l.negative).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="text-sm text-slate-500">Giá trị tồn kho</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{money(totalValue)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-slate-500">Sắp hết / lệch kho</p>
          <p className={`mt-1 text-2xl font-extrabold ${lowCount ? 'text-red-500' : 'text-emerald-600'}`}>{lowCount}</p>
        </Card>
      </div>

      <PrimaryButton onClick={() => setEditing('new')} className="flex w-full items-center justify-center gap-2">
        <Plus size={18} /> Thêm nguyên liệu
      </PrimaryButton>

      {levels.length === 0 ? (
        <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">
          Chưa có nguyên liệu nào. Thêm nguyên liệu, rồi ghi nhập hàng để app biết giá vốn.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
          {levels.map((l) => (
            <li key={l.ingredient.id}>
              <button onClick={() => setEditing(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{l.ingredient.name}</p>
                  <p className="text-xs text-slate-500">
                    {l.unitCost != null ? `${money(l.unitCost)} / ${l.ingredient.unit}` : 'Chưa có giá nhập'}
                    {l.tracked ? '' : ' · chưa nhập kho'}
                  </p>
                </div>
                {(l.low || l.negative) && <AlertTriangle size={18} className="shrink-0 text-red-500" />}
                <div className="text-right">
                  <p className={`font-bold ${l.negative ? 'text-red-600' : l.low ? 'text-red-500' : 'text-slate-900'}`}>
                    {qtyText(l.stock)} {l.ingredient.unit}
                  </p>
                  <p className="text-xs text-slate-500">{l.value > 0 ? money(l.value) : ''}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="px-1 text-xs text-slate-500">
        Tồn kho = hàng đã nhập − hàng dùng cho các đơn bán (theo công thức món) − hao hụt. Tồn kho lệch so với thực tế thì
        bấm vào nguyên liệu để kiểm kho.
      </p>

      {editing && (
        <IngredientSheet
          level={editing === 'new' ? null : editing}
          ingredients={levels.map((l) => l.ingredient)}
          adjustments={inventory.adjustments}
          onSave={(data) =>
            editing === 'new' ? inventory.ingredients.add(data) : inventory.ingredients.update(editing.ingredient.id, data)
          }
          onDelete={() => inventory.ingredients.remove(editing.ingredient.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
