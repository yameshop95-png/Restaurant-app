import { useState } from 'react';
import { Copy } from 'lucide-react';
import { shareText } from '../../lib/shareOrder';
import { Card, money, qtyText } from './ui';

// Danh sách đi chợ cho các đơn đang chờ xử lý: món nào cần làm thêm, nguyên liệu nào cần mua, khoảng bao nhiêu tiền
export default function ShoppingTab({ list, shopName, onGo }) {
  const [msg, setMsg] = useState(null);
  const buy = list.rows.filter((r) => r.toBuy > 0);

  const copy = async () => {
    const lines = [
      `${shopName ? `[${shopName}] ` : ''}Đi chợ (${list.pendingOrders} đơn chờ xử lý)`,
      ...list.makeMore.map((p) => `Làm thêm: ${p.menuItem.name} ${qtyText(p.toMake)} phần`),
      ...buy.map((r) => `- ${r.ingredient.name}: ${qtyText(r.toBuy)} ${r.ingredient.unit}`),
      list.estTotal > 0 && `Ước tính: ${money(list.estTotal)}`,
    ].filter(Boolean);
    try {
      const res = await shareText(lines.join('\n'));
      if (res === 'copied') setMsg('Đã copy danh sách, dán vào ghi chú hoặc tin nhắn');
    } catch {
      setMsg('Không copy được, thử lại nhé');
    }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm text-slate-500">Cần mua cho {list.pendingOrders} đơn chờ xử lý</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-900">
          {buy.length ? `${buy.length} nguyên liệu` : 'Kho đủ'}
          {list.estTotal > 0 && <span className="ml-2 text-base font-semibold text-slate-500">≈ {money(list.estTotal)}</span>}
        </p>
        {list.unknownPrice.length > 0 && (
          <p className="mt-1 text-xs text-slate-500">Chưa có giá nhập nên chưa ước tính: {list.unknownPrice.join(', ')}</p>
        )}
      </Card>

      {list.makeMore.length > 0 && (
        <Card title="Món cần làm thêm cho đơn">
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {list.makeMore.map((p) => (
              <li key={p.menuItem.id} className="flex justify-between px-5 py-2.5">
                <span className="font-semibold text-slate-900">{p.menuItem.name}</span>
                <span className="font-bold text-red-500">{qtyText(p.toMake)} phần</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {list.rows.length === 0 ? (
        <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">
          Không có gì cần mua. Danh sách tính từ đơn đang chờ xử lý, công thức món và tồn kho.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
          {list.rows.map((r) => (
            <li key={r.ingredient.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{r.ingredient.name}</p>
                <p className="text-xs text-slate-500">
                  Cần cho đơn {qtyText(r.needOrders)} {r.ingredient.unit} · làm xong còn {qtyText(r.after)} {r.ingredient.unit}
                </p>
              </div>
              {r.toBuy > 0 ? (
                <div className="shrink-0 text-right">
                  <p className="font-bold text-red-500">
                    Mua {qtyText(r.toBuy)} {r.ingredient.unit}
                  </p>
                  <p className="text-xs text-slate-500">{r.estCost != null ? `≈ ${money(r.estCost)}` : ''}</p>
                </div>
              ) : (
                <span className="shrink-0 font-semibold text-emerald-600">Đủ</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {buy.length > 0 && (
        <button
          onClick={copy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 py-3 font-semibold text-slate-800 active:bg-slate-100"
        >
          <Copy size={18} /> Copy danh sách đi chợ
        </button>
      )}
      {msg && <p className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-800">{msg}</p>}
      <p className="px-1 text-xs text-slate-500">
        Mua đủ để làm hết đơn chờ xử lý và vẫn còn mức "Báo khi còn ≤" của từng nguyên liệu (đặt ở mục Kho). Món chưa có công thức thì
        chưa tính được, nhập ở mục{' '}
        <button onClick={() => onGo('recipes')} className="font-semibold text-blue-600">
          Công thức
        </button>
        . Mua xong nhớ ghi ở mục Nhập hàng.
      </p>
    </div>
  );
}
