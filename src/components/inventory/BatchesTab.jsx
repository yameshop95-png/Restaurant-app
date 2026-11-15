import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { batchCost, compatibleUnits, convertQty, dateKey, fmtKey, weekStartKey } from '../../lib/inventory';
import { Card, Field, PrimaryButton, Sheet, inputClass, money, parseNum, qtyText } from './ui';

// Nguyên liệu gợi ý cho mẻ: công thức 1 phần × số phần, đổi về đơn vị của nguyên liệu
function suggestLines(recipe, output, ingById) {
  const n = parseNum(output);
  if (!recipe?.lines?.length || !Number.isFinite(n) || n <= 0) return [];
  return recipe.lines
    .map((l) => {
      const ing = ingById.get(l.ingredientId);
      if (!ing) return null;
      return { ingredientId: ing.id, unit: ing.unit, qty: qtyText(convertQty(l.qty, l.unit, ing.unit) * n) };
    })
    .filter(Boolean);
}

function BatchSheet({ menu, ingredients, recipesById, costsForWeek, onSave, onClose }) {
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const [date, setDate] = useState(dateKey());
  const [productId, setProductId] = useState(menu[0]?.id ?? '');
  const [output, setOutput] = useState('');
  const [lines, setLines] = useState([]);
  const [touched, setTouched] = useState(false); // đã sửa tay nguyên liệu thì không gợi ý đè nữa
  const [extraCost, setExtraCost] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState(null);

  const refill = (pid, out) => {
    if (!touched) setLines(suggestLines(recipesById.get(pid), out, ingById));
  };
  const setLine = (i, patch) => {
    setTouched(true);
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  };

  const outValue = parseNum(output);
  const clean = lines
    .map((l) => ({ ingredientId: l.ingredientId, qty: parseNum(l.qty), unit: l.unit }))
    .filter((l) => l.ingredientId && Number.isFinite(l.qty) && l.qty > 0);
  const extraValue = extraCost.trim() ? parseNum(extraCost) : 0;
  const preview = batchCost(
    { lines: clean, extraCost: Number.isFinite(extraValue) ? extraValue : 0 },
    costsForWeek(weekStartKey(date)),
    ingById,
  );
  const dish = menu.find((m) => m.id === productId);

  const save = () => {
    if (!dish) return setError('Chọn món');
    if (!output.trim() || !Number.isFinite(outValue) || outValue <= 0) return setError('Nhập số phần làm ra');
    if (!clean.length) return setError('Thêm ít nhất một nguyên liệu đã dùng');
    if (!Number.isFinite(extraValue) || extraValue < 0) return setError('Chi phí khác chưa đúng');
    onSave({ date, productId, output: outValue, lines: clean, extraCost: extraValue, note: note.trim() });
    onClose();
  };

  return (
    <Sheet
      title="Ghi mẻ mới"
      onClose={onClose}
      footer={
        <PrimaryButton onClick={save} className="flex-1">
          Lưu mẻ
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ngày làm">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass(false)} />
        </Field>
        <Field label="Số phần làm ra" hint="Tính theo phần bán trên thực đơn (cây, hộp...)">
          <input
            inputMode="decimal"
            value={output}
            onChange={(e) => {
              setOutput(e.target.value);
              refill(productId, e.target.value);
            }}
            placeholder="VD: 25"
            className={inputClass(false)}
          />
        </Field>
      </div>
      <Field label="Món">
        <select
          value={productId}
          onChange={(e) => {
            setProductId(e.target.value);
            refill(e.target.value, output);
          }}
          className={inputClass(false)}
        >
          {menu.map((m) => (
            <option key={m.id} value={m.id} className="bg-card">
              {m.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-slate-700">Nguyên liệu đã dùng cho cả mẻ</p>
        {!touched && lines.length > 0 && (
          <p className="text-xs text-slate-500">Gợi ý theo công thức × số phần. Sửa lại cho đúng số thật đã dùng.</p>
        )}
        {lines.map((l, i) => {
          const ing = ingById.get(l.ingredientId);
          return (
            <div key={i} className="flex gap-2">
              <select
                value={l.ingredientId}
                onChange={(e) => setLine(i, { ingredientId: e.target.value, unit: ingById.get(e.target.value)?.unit })}
                className={inputClass(false)}
                aria-label="Nguyên liệu"
              >
                {ingredients.map((x) => (
                  <option key={x.id} value={x.id} className="bg-card">
                    {x.name}
                  </option>
                ))}
              </select>
              <input
                inputMode="decimal"
                value={l.qty}
                onChange={(e) => setLine(i, { qty: e.target.value })}
                placeholder="SL"
                aria-label="Số lượng"
                className={`${inputClass(false)} !w-24 shrink-0`}
              />
              <select
                value={l.unit ?? ing?.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                aria-label="Đơn vị"
                className={`${inputClass(false)} !w-20 shrink-0 !px-2`}
              >
                {compatibleUnits(ing?.unit ?? l.unit).map((u) => (
                  <option key={u} value={u} className="bg-card">
                    {u}
                  </option>
                ))}
              </select>
              <button
                onClick={() => {
                  setTouched(true);
                  setLines((ls) => ls.filter((_, idx) => idx !== i));
                }}
                aria-label="Bỏ dòng"
                className="shrink-0 rounded-xl px-2 text-red-500 active:bg-red-50"
              >
                <Trash2 size={18} />
              </button>
            </div>
          );
        })}
        <button
          onClick={() => {
            if (!ingredients.length) return window.alert('Thêm nguyên liệu ở mục Kho trước.');
            setTouched(true);
            setLines((ls) => [...ls, { ingredientId: ingredients[0].id, unit: ingredients[0].unit, qty: '' }]);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-50"
        >
          <Plus size={18} /> Thêm nguyên liệu
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Chi phí khác cả mẻ (A$)" hint="VD: gas, lá chuối">
          <input inputMode="decimal" value={extraCost} onChange={(e) => setExtraCost(e.target.value)} placeholder="0" className={inputClass(false)} />
        </Field>
        <Field label="Ghi chú">
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass(false)} />
        </Field>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
        <p className="flex justify-between">
          <span>Chi phí cả mẻ</span>
          <b>{money(preview.cost)}</b>
        </p>
        <p className="flex justify-between">
          <span>Giá vốn mỗi phần</span>
          <b>{outValue > 0 ? money(preview.cost / outValue) : '—'}</b>
        </p>
        {preview.missing.length > 0 && <p className="mt-1 text-xs text-red-500">Chưa có giá nhập: {preview.missing.join(', ')}</p>}
      </div>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
    </Sheet>
  );
}

function ProductSheet({ product, onAdjust, onStop, onClose }) {
  const [waste, setWaste] = useState('');
  const [count, setCount] = useState('');
  const w = parseNum(waste);
  const c = parseNum(count);
  const name = product.menuItem.name;
  return (
    <Sheet title={name} onClose={onClose}>
      <div className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
        <p>
          Đã làm <b>{qtyText(product.produced)}</b> · đã bán / đặt <b>{qtyText(product.sold)}</b> (chưa giao {qtyText(product.pending)})
        </p>
        <p>
          Tính từ {fmtKey(product.since)} · {product.stock >= 0 ? `còn ${qtyText(product.stock)} phần` : `cần làm thêm ${qtyText(-product.stock)} phần`}
        </p>
      </div>
      <Field label="Bỏ đi / hỏng (phần)" hint="VD: cuối ngày bánh cuốn còn dư phải bỏ">
        <div className="flex gap-2">
          <input inputMode="decimal" value={waste} onChange={(e) => setWaste(e.target.value)} className={inputClass(false)} />
          <button
            disabled={!waste.trim() || !Number.isFinite(w) || w <= 0}
            onClick={() => {
              onAdjust(-w, 'waste');
              onClose();
            }}
            className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-slate-50 disabled:opacity-40"
          >
            Ghi
          </button>
        </div>
      </Field>
      <Field label="Đếm thực tế còn (phần)" hint="App tự ghi chênh lệch so với số trên sổ">
        <div className="flex gap-2">
          <input inputMode="decimal" value={count} onChange={(e) => setCount(e.target.value)} className={inputClass(false)} />
          <button
            disabled={!count.trim() || !Number.isFinite(c) || c < 0}
            onClick={() => {
              onAdjust(Math.round((c - product.stock) * 1000) / 1000, 'count');
              onClose();
            }}
            className="shrink-0 rounded-xl bg-slate-900 px-4 font-semibold text-slate-50 disabled:opacity-40"
          >
            Ghi
          </button>
        </div>
      </Field>
      <button
        onClick={() => {
          if (window.confirm(`Thôi làm theo mẻ cho "${name}"? Từ giờ món này trừ kho và tính giá vốn theo công thức.`)) {
            onStop();
            onClose();
          }
        }}
        className="w-full rounded-2xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 active:bg-slate-50"
      >
        Thôi làm theo mẻ
      </button>
    </Sheet>
  );
}

// Mẻ sản xuất: món nào làm theo mẻ thì ghi mỗi mẻ (số phần làm ra, nguyên liệu dùng thật). App tính giá vốn thật
// và thành phẩm còn lại / còn phải làm thêm cho các đơn đặt trước.
export default function BatchesTab({ menu, inventory, costsForWeek, products }) {
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const ingredients = inventory.ingredients.list;
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const recipesById = new Map(inventory.recipes.list.map((r) => [r.id, r]));
  const menuById = new Map(menu.map((m) => [m.id, m]));

  if (inventory.batchesMissing) {
    return (
      <Card className="p-5">
        <h2 className="font-bold text-slate-900">Chưa bật ghi mẻ</h2>
        <p className="mt-2 text-sm text-slate-600">
          Mở file <b>sql/inventory_batches.sql</b>, dán vào SQL Editor của project quán, bấm Run một lần rồi tải lại trang.
        </p>
      </Card>
    );
  }

  const save = (b) => {
    inventory.batches.add(b);
    // Bật làm theo mẻ cho món này từ đầu tuần của mẻ, để tính cả đơn đặt trước trong tuần
    const since = weekStartKey(b.date);
    const recipe = recipesById.get(b.productId);
    if (!recipe) inventory.recipes.add({ id: b.productId, lines: [], extra: 0, batch: true, batchSince: since });
    else if (!recipe.batch || !recipe.batchSince) inventory.recipes.update(b.productId, { batch: true, batchSince: since });
    else if (since < recipe.batchSince) inventory.recipes.update(b.productId, { batchSince: since });
  };

  return (
    <div className="space-y-4">
      <PrimaryButton
        onClick={() => (menu.length ? setAdding(true) : window.alert('Thực đơn đang trống.'))}
        className="flex w-full items-center justify-center gap-2"
      >
        <Plus size={18} /> Ghi mẻ mới
      </PrimaryButton>

      <Card title="Thành phẩm">
        {products.length === 0 ? (
          <p className="px-5 pb-4 pt-2 text-sm text-slate-500">
            Chưa có món nào làm theo mẻ. Ghi mẻ đầu tiên của một món (VD: 10 kg thịt ra 25 cây giò) là món đó tự chuyển sang tính
            theo mẻ: giá vốn theo số thật, và app biết còn bao nhiêu hoặc phải làm thêm bao nhiêu cho đơn đặt trước.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {products.map((p) => (
              <li key={p.menuItem.id}>
                <button onClick={() => setViewing(p)} className="flex w-full items-center gap-3 px-5 py-3 text-left active:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{p.menuItem.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.unitCost != null ? `Giá vốn ${money(p.unitCost)} / phần` : 'Chưa có mẻ nào'}
                      {p.pending > 0 ? ` · ${qtyText(p.pending)} phần đặt chưa giao` : ''}
                    </p>
                  </div>
                  <p className={`shrink-0 text-right font-bold ${p.stock < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                    {p.stock < 0 ? `Làm thêm ${qtyText(-p.stock)}` : `Còn ${qtyText(p.stock)}`}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <section>
        <h3 className="mb-2 px-1 text-sm font-semibold text-slate-500">Mẻ gần đây</h3>
        {inventory.batches.list.length === 0 ? (
          <p className="rounded-3xl bg-card px-5 py-8 text-center text-slate-400">Chưa ghi mẻ nào</p>
        ) : (
          <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
            {inventory.batches.list.slice(0, 100).map((b) => {
              const c = batchCost(b, costsForWeek(weekStartKey(b.date)), ingById);
              return (
                <li key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">
                      {menuById.get(b.productId)?.name ?? 'Món đã xoá'} · {qtyText(Number(b.output))} phần
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {fmtKey(b.date)} · {(b.lines ?? []).map((l) => `${ingById.get(l.ingredientId)?.name ?? '?'} ${qtyText(Number(l.qty))}${l.unit}`).join(', ')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold text-slate-900">{money(c.cost)}</p>
                    <p className="text-xs text-slate-500">{Number(b.output) > 0 ? `${money(c.cost / Number(b.output))}/phần` : ''}</p>
                  </div>
                  <button
                    onClick={() => window.confirm('Xoá mẻ này? Tồn kho và giá vốn sẽ tính lại.') && inventory.batches.remove(b.id)}
                    aria-label="Xoá mẻ"
                    className="rounded-lg p-2 text-red-500 active:bg-red-50"
                  >
                    <Trash2 size={17} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="px-1 text-xs text-slate-500">
        Món làm theo mẻ: nguyên liệu bị trừ khi ghi mẻ (số thật), mỗi phần bán trừ vào thành phẩm. Giá vốn mỗi phần = chi phí các mẻ trong
        tuần / số phần (giá nguyên liệu theo giá nhập trung bình tuần làm mẻ), cộng chi phí hộp, túi ghi ở Công thức.
      </p>

      {adding && (
        <BatchSheet
          menu={menu}
          ingredients={ingredients}
          recipesById={recipesById}
          costsForWeek={costsForWeek}
          onSave={save}
          onClose={() => setAdding(false)}
        />
      )}
      {viewing && (
        <ProductSheet
          product={viewing}
          onAdjust={(qty, reason) => inventory.adjustments.add({ date: dateKey(), productId: viewing.menuItem.id, qty, reason })}
          onStop={() => inventory.recipes.update(viewing.menuItem.id, { batch: false })}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
