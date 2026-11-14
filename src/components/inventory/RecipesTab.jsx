import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { compatibleUnits, recipeCost } from '../../lib/inventory';
import { Card, Field, PrimaryButton, Sheet, inputClass, money, parseNum } from './ui';

function RecipeSheet({ dish, recipe, ingredients, costs, onSave, onClear, onClose }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const [lines, setLines] = useState(() => (recipe?.lines ?? []).map((l) => ({ ...l, qty: String(l.qty) })));
  const [extra, setExtra] = useState(recipe?.extra ? String(recipe.extra) : '');

  const clean = lines
    .map((l) => ({ ingredientId: l.ingredientId, qty: parseNum(l.qty), unit: l.unit }))
    .filter((l) => l.ingredientId && Number.isFinite(l.qty) && l.qty > 0);
  const extraValue = extra.trim() ? parseNum(extra) : 0;
  const preview = recipeCost({ lines: clean, extra: Number.isFinite(extraValue) ? extraValue : 0 }, costs, ingById);
  const margin = dish.price - preview.cost;

  const setLine = (i, patch) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => {
    const first = ingredients[0];
    if (!first) return window.alert('Thêm nguyên liệu ở mục Kho trước.');
    setLines((ls) => [...ls, { ingredientId: first.id, qty: '', unit: first.unit }]);
  };

  return (
    <Sheet
      title={`Công thức: ${dish.name}`}
      onClose={onClose}
      footer={
        <>
          {recipe && (
            <button
              onClick={() => {
                if (window.confirm('Xoá công thức của món này?')) {
                  onClear();
                  onClose();
                }
              }}
              className="rounded-2xl bg-red-50 px-4 py-3.5 font-semibold text-red-600 active:bg-red-100"
            >
              Xoá
            </button>
          )}
          <PrimaryButton
            onClick={() => {
              onSave({ lines: clean, extra: Number.isFinite(extraValue) && extraValue > 0 ? extraValue : 0 });
              onClose();
            }}
            className="flex-1"
          >
            Lưu
          </PrimaryButton>
        </>
      }
    >
      <p className="text-sm text-slate-600">
        Nguyên liệu cần cho <b>1 phần</b> món này (giá bán {money(dish.price)}). Có công thức thì app tự tính giá vốn, lãi, và
        trừ kho mỗi khi bán.
      </p>

      <div className="space-y-3">
        {lines.map((l, i) => {
          const ing = ingById.get(l.ingredientId);
          const units = compatibleUnits(ing?.unit ?? l.unit);
          return (
            <div key={i} className="rounded-2xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <select
                  value={l.ingredientId}
                  onChange={(e) => {
                    const next = ingById.get(e.target.value);
                    setLine(i, { ingredientId: e.target.value, unit: next?.unit });
                  }}
                  className={inputClass(false)}
                  aria-label="Nguyên liệu"
                >
                  {ingredients.map((x) => (
                    <option key={x.id} value={x.id} className="bg-card">
                      {x.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  aria-label="Bỏ dòng này"
                  className="shrink-0 rounded-xl px-3 text-red-500 active:bg-red-50"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  inputMode="decimal"
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  placeholder="Số lượng"
                  className={inputClass(false)}
                  aria-label="Số lượng"
                />
                <select
                  value={l.unit ?? ing?.unit}
                  onChange={(e) => setLine(i, { unit: e.target.value })}
                  className={`${inputClass(false)} !w-28 shrink-0`}
                  aria-label="Đơn vị"
                >
                  {units.map((u) => (
                    <option key={u} value={u} className="bg-card">
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              {ing && costs.get(ing.id) == null && (
                <p className="mt-1 text-xs font-semibold text-red-500">Chưa có giá nhập, ghi nhập hàng để tính giá vốn</p>
              )}
            </div>
          );
        })}
        <button
          onClick={addLine}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-50"
        >
          <Plus size={18} /> Thêm nguyên liệu vào công thức
        </button>
      </div>

      <Field label="Chi phí khác mỗi phần (A$)" hint="VD: hộp, túi, nước chấm. Để trống nếu không có">
        <input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0" className={inputClass(false)} />
      </Field>

      <div className="rounded-2xl bg-slate-50 p-3 text-sm">
        <p className="flex justify-between text-slate-700">
          <span>Giá vốn 1 phần</span>
          <b>{money(preview.cost)}</b>
        </p>
        <p className="flex justify-between text-slate-700">
          <span>Lãi 1 phần</span>
          <b className={margin < 0 ? 'text-red-600' : 'text-emerald-600'}>
            {money(margin)}
            {dish.price > 0 ? ` (${Math.round((margin / dish.price) * 100)}%)` : ''}
          </b>
        </p>
        {preview.missing.length > 0 && (
          <p className="mt-1 text-xs text-red-500">Chưa có giá nhập: {preview.missing.join(', ')}, giá vốn đang thấp hơn thực tế.</p>
        )}
      </div>
    </Sheet>
  );
}

// Công thức từng món: giá vốn, lãi trên mỗi phần
export default function RecipesTab({ menu, inventory, costs }) {
  const [editing, setEditing] = useState(null);
  const ingredients = inventory.ingredients.list;
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(inventory.recipes.list.map((r) => [r.id, r]));

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-slate-600">
          Bấm vào món để nhập công thức. Quán làm theo mẻ nên chỉ cần ước lượng nguyên liệu cho <b>1 phần</b>; sau vài tuần
          bạn chỉnh lại cho sát.
        </p>
      </Card>
      {menu.length === 0 ? (
        <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">Thực đơn đang trống</p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
          {menu.map((m) => {
            const recipe = recipesById.get(m.id);
            const rc = recipeCost(recipe, costs, ingById);
            const margin = Number(m.price) - rc.cost;
            return (
              <li key={m.id}>
                <button onClick={() => setEditing(m)} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{m.name}</p>
                    <p className="text-xs text-slate-500">
                      Giá bán {money(Number(m.price))}
                      {rc.hasRecipe ? ` · giá vốn ${money(rc.cost)}` : ''}
                      {rc.missing.length > 0 && ' · thiếu giá nhập'}
                    </p>
                  </div>
                  {rc.hasRecipe ? (
                    <div className="text-right">
                      <p className={`font-bold ${margin < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{money(margin)}</p>
                      <p className="text-xs text-slate-500">{Number(m.price) > 0 ? `${Math.round((margin / Number(m.price)) * 100)}%` : ''}</p>
                    </div>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">Chưa có công thức</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editing && (
        <RecipeSheet
          dish={{ name: editing.name, price: Number(editing.price) }}
          recipe={recipesById.get(editing.id)}
          ingredients={ingredients}
          costs={costs}
          onSave={(data) =>
            recipesById.has(editing.id) ? inventory.recipes.update(editing.id, data) : inventory.recipes.add({ ...data, id: editing.id })
          }
          onClear={() => inventory.recipes.remove(editing.id)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
