import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { buyBreakdown, buyToBase, buyUnitOf, dateKey, fmtKey } from '../../lib/inventory';
import { Field, PrimaryButton, Sheet, inputClass, money, parseNum, qtyText } from './ui';

// Giá theo đơn vị nhỏ (gam/ml) rất bé: hiện 4 số lẻ thay vì làm tròn $0,01
const fmtPrice = (v) => (v >= 0.1 ? money(v) : `$${v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`);

function PurchaseSheet({ ingredients, onSave, onClose }) {
  const [date, setDate] = useState(dateKey());
  const [ingredientId, setIngredientId] = useState(ingredients[0]?.id ?? '');
  const [qty, setQty] = useState('');
  const [total, setTotal] = useState('');
  const [supplier, setSupplier] = useState('');
  const [error, setError] = useState(null);
  // Nhập theo đơn vị mua (thùng/gói/chai) khi nguyên liệu có đặt quy đổi
  const [mode, setMode] = useState(null); // null = tự chọn theo nguyên liệu
  const [bCount, setBCount] = useState('');
  const [bPrice, setBPrice] = useState('');
  const [bTotal, setBTotal] = useState('');

  const ing = ingredients.find((i) => i.id === ingredientId);
  const buy = buyUnitOf(ing);
  const bd = buyBreakdown(ing);
  // Chữ quy cách như trên bao bì: "1 thùng = 12 gói × 500 g = 6 kg"
  const bdText = bd
    ? bd.packs > 0
      ? `1 ${bd.unit} = ${qtyText(bd.packs)} ${bd.packUnit || 'đơn vị con'} × ${qtyText(bd.packSize)} ${bd.measure} = ${qtyText(bd.size)} ${ing?.unit}`
      : `1 ${bd.unit} = ${qtyText(bd.size)} ${ing?.unit}`
    : '';
  const effMode = buy ? (mode ?? 'buy') : 'base';

  const pickIngredient = (id) => {
    setIngredientId(id);
    setMode(null);
    setQty('');
    setTotal('');
    setBCount('');
    setBPrice('');
    setBTotal('');
    setError(null);
  };

  // Ba ô của chế độ mua theo đơn vị mua luôn khớp nhau: sửa ô này thì ô kia tự tính
  const editCount = (v) => {
    setBCount(v);
    const c = parseNum(v);
    const pr = parseNum(bPrice);
    if (c > 0 && pr > 0) setBTotal(String(Math.round(c * pr * 100) / 100));
  };
  const editPrice = (v) => {
    setBPrice(v);
    const c = parseNum(bCount);
    const pr = parseNum(v);
    if (c > 0 && pr > 0) setBTotal(String(Math.round(c * pr * 100) / 100));
  };
  const editTotal = (v) => {
    setBTotal(v);
    const c = parseNum(bCount);
    const t = parseNum(v);
    if (c > 0 && t >= 0 && v.trim()) setBPrice(String(Math.round((t / c) * 10000) / 10000));
  };

  const q = parseNum(qty);
  const t = parseNum(total);
  const cNum = parseNum(bCount);
  const btNum = parseNum(bTotal);
  const baseQty = effMode === 'buy' ? buyToBase(cNum, buy.size) : q;
  const effTotal = effMode === 'buy' ? btNum : t;
  const unitPrice = baseQty > 0 && effTotal >= 0 && (effMode === 'buy' ? bTotal.trim() : total.trim()) ? effTotal / baseQty : null;
  const standard = Number(ing?.standardPrice) || 0;
  const saved = unitPrice != null && standard > 0 && unitPrice < standard ? (standard - unitPrice) * baseQty : 0;

  const save = () => {
    if (!ing) return setError('Chọn nguyên liệu (thêm ở mục Kho nếu chưa có)');
    if (!(baseQty > 0)) return setError(effMode === 'buy' ? `Số ${buy.unit} chưa đúng` : 'Số lượng chưa đúng');
    if (!Number.isFinite(effTotal) || effTotal < 0 || !(effMode === 'buy' ? bTotal.trim() : total.trim())) return setError('Tổng tiền chưa đúng');
    const totalRounded = Math.round(effTotal * 100) / 100;
    if (effMode === 'buy') {
      onSave({
        date,
        ingredientId,
        qty: baseQty,
        total: totalRounded,
        supplier: supplier.trim(),
        // Lưu lại cách nhập gốc để đối chiếu hoá đơn: 7 thùng × $17 (1 thùng = 6 kg)
        buy: { count: cNum, unit: buy.unit, price: Math.round((effTotal / cNum) * 100) / 100, size: buy.size },
      });
    } else {
      onSave({ date, ingredientId, qty: q, total: totalRounded, supplier: supplier.trim() });
    }
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
          <select value={ingredientId} onChange={(e) => pickIngredient(e.target.value)} className={inputClass(false)}>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id} className="bg-card">
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
        </Field>
      </div>
      {buy && (
        <div className="flex rounded-2xl bg-slate-100 p-1 text-sm font-semibold">
          <button
            type="button"
            onClick={() => setMode('buy')}
            className={`flex-1 rounded-xl py-2 ${effMode === 'buy' ? 'bg-card text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Theo {buy.unit}
          </button>
          <button
            type="button"
            onClick={() => setMode('base')}
            className={`flex-1 rounded-xl py-2 ${effMode === 'base' ? 'bg-card text-slate-900 shadow-sm' : 'text-slate-500'}`}
          >
            Theo {ing.unit}
          </button>
        </div>
      )}
      {effMode === 'buy' ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Số lượng (${buy.unit})`}>
              <input inputMode="decimal" value={bCount} onChange={(e) => editCount(e.target.value)} placeholder="VD: 7" className={inputClass(false)} />
            </Field>
            <Field label={`Giá 1 ${buy.unit} ($)`}>
              <input inputMode="decimal" value={bPrice} onChange={(e) => editPrice(e.target.value)} placeholder="VD: 17" className={inputClass(false)} />
            </Field>
          </div>
          <Field
            label="Tổng tiền ($)"
            hint={
              baseQty > 0
                ? `= ${qtyText(baseQty)} ${ing.unit} · ${fmtPrice(effTotal / baseQty)} / ${ing.unit}${ing.unit === 'kg' ? ` · ${money(effTotal / baseQty / 10)} / 100 g` : ''} (${bdText})`
                : bdText
            }
          >
            <input inputMode="decimal" value={bTotal} onChange={(e) => editTotal(e.target.value)} placeholder="VD: 119" className={inputClass(false)} />
          </Field>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Field label={`Số lượng${ing ? ` (${ing.unit})` : ''}`}>
            <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="VD: 10" className={inputClass(false)} />
          </Field>
          <Field label="Tổng tiền ($)" hint={unitPrice != null && ing ? `= ${money(unitPrice)} / ${ing.unit}` : undefined}>
            <input inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="VD: 120" className={inputClass(false)} />
          </Field>
        </div>
      )}
      {saved > 0 && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          Rẻ hơn giá chuẩn {money(standard)}/{ing.unit}: tiết kiệm {money(saved)}
        </p>
      )}
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
  // Tiền tiết kiệm của 1 lần nhập so với giá chuẩn (mua được sale)
  const savedOf = (p) => {
    const std = Number(ingById.get(p.ingredientId)?.standardPrice) || 0;
    const qty = Number(p.qty) || 0;
    return std > 0 && qty > 0 ? Math.max(0, std * qty - Number(p.total || 0)) : 0;
  };
  const monthSaved = purchases.filter((p) => String(p.date).startsWith(monthKey)).reduce((s, p) => s + savedOf(p), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-500">Chi mua hàng tháng này</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">{money(monthTotal)}</p>
        {monthSaved > 0 && <p className="mt-1 text-sm font-semibold text-emerald-600">Tiết kiệm nhờ mua sale: {money(monthSaved)}</p>}
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
                    {fmtKey(p.date)} ·{' '}
                    {p.buy
                      ? `${qtyText(Number(p.buy.count))} ${p.buy.unit} × ${money(Number(p.buy.price))} · = ${qtyText(Number(p.qty))} ${ing?.unit ?? ''}`
                      : `${qtyText(Number(p.qty))} ${ing?.unit ?? ''}`}
                    {p.supplier ? ` · ${p.supplier}` : ''}
                    {savedOf(p) > 0 && <span className="font-semibold text-emerald-600"> · sale, tiết kiệm {money(savedOf(p))}</span>}
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
        Giá vốn nguyên liệu = giá nhập trung bình của từng tuần, có tính cả lần mua sale. Đặt "giá chuẩn" (giá thường) ở mục Kho để
        app báo tiền tiết kiệm khi mua sale. Mua nguyên liệu mới thì thêm ở mục Kho trước.
      </p>

      {open && <PurchaseSheet ingredients={ingredients} onSave={(d) => inventory.purchases.add(d)} onClose={() => setOpen(false)} />}
    </div>
  );
}
