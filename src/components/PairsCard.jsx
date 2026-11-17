import { useMemo, useState } from 'react';
import { Link2 } from 'lucide-react';
import { pairLift, pairsForWebsite } from '../lib/customerInsights';

// Món hay mua kèm (tab Báo cáo). Chủ quán bấm để hiện gợi ý "Khách hay mua kèm" ở trang đặt món của website.
export default function PairsCard({ orders, menu, settings, onUpdateSettings }) {
  const pairs = useMemo(() => pairLift(orders), [orders]);
  const [msg, setMsg] = useState(null);
  const web = settings.webOrdering ?? {};
  const live = web.pairs && Object.keys(web.pairs).length > 0;
  // Mỗi cặp chỉ hiện một chiều (chiều có độ tin cao hơn)
  const shown = [];
  const seen = new Set();
  for (const p of [...pairs].sort((a, b) => b.conf - a.conf)) {
    const key = [p.from, p.to].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    shown.push(p);
  }

  const publish = (on) => {
    onUpdateSettings({ webOrdering: { ...web, pairs: on ? pairsForWebsite(pairs, menu) : null } });
    setMsg(on ? 'Đã bật gợi ý "Khách hay mua kèm" trên website' : 'Đã tắt gợi ý trên website');
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center gap-2 px-5 pt-4">
        <Link2 size={18} className="text-blue-500" aria-hidden="true" />
        <h2 className="text-[15px] text-slate-500">Món hay mua kèm</h2>
      </div>
      {shown.length === 0 ? (
        <p className="px-5 pb-4 pt-2 text-sm text-slate-500">
          Chưa đủ dữ liệu: cần một cặp món cùng xuất hiện ít nhất 3 đơn và được mua cùng nhau nhiều hơn mức bình thường.
        </p>
      ) : (
        <>
          <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
            {shown.slice(0, 8).map((p) => (
              <li key={`${p.from}|${p.to}`} className="px-5 py-2.5">
                <p className="font-semibold text-slate-900">
                  {p.fromName} + {p.toName}
                </p>
                <p className="text-xs text-slate-500">
                  {Math.round(p.conf * 100)}% khách mua {p.fromName} cũng mua {p.toName} · gấp {p.lift.toFixed(1)} lần bình thường ·{' '}
                  {p.both} đơn
                </p>
              </li>
            ))}
          </ul>
          <div className="space-y-2 px-5 pb-4 pt-2">
            <p className="text-xs text-slate-500">
              Dùng để làm combo, hoặc hiện gợi ý ở trang đặt món: khách chọn {shown[0].fromName} sẽ thấy "Khách hay mua kèm:{' '}
              {shown[0].toName}".
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => publish(true)}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white active:bg-blue-600"
              >
                {live ? 'Cập nhật gợi ý trên website' : 'Hiện gợi ý trên website'}
              </button>
              {live && (
                <button
                  onClick={() => publish(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 active:bg-slate-100"
                >
                  Tắt gợi ý
                </button>
              )}
            </div>
            {msg && <p className="text-sm font-semibold text-slate-700">{msg}</p>}
          </div>
        </>
      )}
    </section>
  );
}
