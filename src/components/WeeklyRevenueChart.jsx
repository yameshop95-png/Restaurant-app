// Biểu đồ "Doanh thu theo tuần giao" ở tab Theo kỳ (PR #82) — thay biểu đồ doanh
// thu theo ngày khi kỳ là Tháng: quán chỉ bán thứ Bảy nên mỗi cột là một đợt giao.
// Import recharts ở đây (nạp lazy cùng chunk của tab Báo cáo), không vào chunk chính.
import { useMemo } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { weeklyRevenue } from '../lib/currentRun';
import { formatMoney } from '../lib/stats';

function WeekTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-card px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-900">
        Thứ Bảy {d.label}: {formatMoney(d.revenue)} · {d.orders} đơn
      </p>
    </div>
  );
}

const COARSE = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

export default function WeeklyRevenueChart({ orders, anchor }) {
  const data = useMemo(() => weeklyRevenue(orders, anchor, new Date()), [orders, anchor]);
  return (
    <div className="px-2 pb-3 pt-2">
      <div style={{ height: 180 }} data-no-swipe>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip content={<WeekTip />} cursor={{ fill: '#f1f5f9' }} trigger={COARSE ? 'click' : 'hover'} />
            <Bar dataKey="revenue" radius={[5, 5, 0, 0]} maxBarSize={44}>
              {data.map((d) => (
                <Cell key={d.label} fill={d.isCurrent ? '#ea580c' : '#fb923c'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="px-3 pt-1 text-xs text-slate-400">
        Mỗi cột là doanh thu của một đợt giao thứ Bảy (tính theo ngày giao). Cột đậm nhất là đợt hiện tại. Chạm vào cột để xem số tiền và số đơn.
      </p>
    </div>
  );
}
