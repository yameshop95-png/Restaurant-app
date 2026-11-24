import { useMemo } from 'react';
import { RHYTHM_MIN_WEEKS, weekOfMonthRhythm } from '../lib/reportInsights';

// Thẻ "Nhịp tuần trong tháng" ở tab Báo cáo: vị trí tuần trong tháng (tuần 1 → tuần 5)
// nào thường đông / vắng đơn, tính trên các tuần ĐÃ KẾT THÚC trong tối đa 6 tháng gần
// nhất (tuần đang chạy không tính để khỏi lệch). Vị trí tuần dùng đúng định nghĩa của
// dự báo trong app (lib/forecast weekOfMonth: ngày thứ Năm của tuần Thứ Hai–Chủ nhật
// quyết định đó là tuần thứ mấy của tháng). Số liệu ở lib/reportInsights.
// Chưa đủ ~3 tháng dữ liệu thật (dưới RHYTHM_MIN_WEEKS tuần) thì thẻ chỉ hiện ghi chú,
// không hiện số — tránh kết luận từ quá ít mẫu.
const fmtDiff = (diff) => (diff == null ? '—' : `${diff >= 0 ? '+' : '−'}${Math.round(Math.abs(diff) * 100)}%`);
const fmtAvg = (v) => (v == null ? '—' : `${Math.round(v * 10) / 10}`.replace('.', ','));


// Phần nội dung của thẻ nhịp tuần (chart cột + câu nhận xét + ghi chú), tách riêng để
// thẻ gộp "Nhịp tuần" ở trang Báo cáo dùng lại mà không lồng thẻ trong thẻ.
export function WeekRhythmBars({ rhythm }) {
  if (!rhythm.enough) {
    return (
      <div className="py-6">
        <p className="text-center text-sm leading-relaxed text-slate-400">
          Chưa đủ dữ liệu để thấy quy luật: cần khoảng 3 tháng đơn hàng (từ {RHYTHM_MIN_WEEKS} tuần đã kết thúc trở
          lên), hiện mới có {rhythm.weeksConsidered} tuần trong 6 tháng gần nhất.
        </p>
      </div>
    );
  }
  return (
    <>
      <div className="mt-4 flex items-end gap-3">
        {rhythm.positions.map((p) => {
          const isBusiest = rhythm.busiest?.position === p.position;
          const isQuietest = rhythm.quietest?.position === p.position && rhythm.busiest?.position !== p.position;
          const maxAvg = Math.max(...rhythm.positions.map((x) => x.avgOrders ?? 0), 0);
          const color = isBusiest ? '#10b981' : isQuietest ? '#f43f5e' : 'var(--chart-series)';
          return (
            <div key={p.position} className="flex h-40 min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div className="text-center leading-tight">
                <div className="text-sm font-bold text-slate-900">{p.occurrences === 0 ? '—' : `${fmtAvg(p.avgOrders)} đơn`}</div>
                <div className={`text-xs font-semibold ${p.diff == null ? 'text-slate-400' : p.diff >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {p.occurrences === 0 ? '' : fmtDiff(p.diff)}
                </div>
              </div>
              <div
                className="w-full max-w-16 rounded-t-lg"
                style={{
                  height: `${maxAvg && p.avgOrders ? Math.max((p.avgOrders / maxAvg) * 100, 3) : 0}%`,
                  background: color,
                  opacity: isBusiest || isQuietest ? 1 : 0.55,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-3 border-t border-slate-100 pt-2">
        {rhythm.positions.map((p) => {
          const isBusiest = rhythm.busiest?.position === p.position;
          const isQuietest = rhythm.quietest?.position === p.position && rhythm.busiest?.position !== p.position;
          return (
            <div key={p.position} className="min-w-0 flex-1 text-center">
              <div className="text-sm font-semibold text-slate-900">Tuần {p.position}</div>
              {isBusiest && <div className="text-xs font-semibold text-emerald-600">đông nhất</div>}
              {isQuietest && <div className="text-xs font-semibold text-red-600">vắng nhất</div>}
              <div className="mt-0.5 text-xs text-slate-500">
                {p.occurrences === 0 ? 'chưa xuất hiện' : `xuất hiện ${p.occurrences} lần`}
              </div>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 pt-3">
        {rhythm.busiest && rhythm.quietest && rhythm.busiest.position !== rhythm.quietest.position && (
          <p className="text-sm leading-relaxed text-slate-700">
            Tuần {rhythm.quietest.position} thường ít đơn nhất: {fmtDiff(rhythm.quietest.diff)} so với trung bình
            một tuần. Tuần {rhythm.busiest.position} thường đông nhất: {fmtDiff(rhythm.busiest.diff)}.
          </p>
        )}
        <p className="text-xs leading-relaxed text-slate-400">
          % chênh so với số đơn trung bình của một tuần thường ({fmtAvg(rhythm.overallAvg)} đơn/tuần). Chỉ tính
          các tuần đã kết thúc trong 6 tháng gần nhất, đơn huỷ không tính. Vị trí tuần tính theo ngày thứ Năm
          của tuần — cùng cách mục Dự báo của app xác định "tuần thứ mấy trong tháng".
        </p>
      </div>
    </>
  );
}

export default function WeekRhythmCard({ orders }) {
  const rhythm = useMemo(() => weekOfMonthRhythm(orders, new Date()), [orders]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="font-bold text-slate-900">Nhịp tuần trong tháng</h2>
        {rhythm.enough && <span className="text-sm text-slate-500">{rhythm.weeksConsidered} tuần đã qua</span>}
      </div>

      <div className="px-5 pb-4"><WeekRhythmBars rhythm={rhythm} /></div>
    </section>
  );
}
