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

export default function WeekRhythmCard({ orders }) {
  const rhythm = useMemo(() => weekOfMonthRhythm(orders, new Date()), [orders]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="font-bold text-slate-900">Nhịp tuần trong tháng</h2>
        {rhythm.enough && <span className="text-sm text-slate-500">{rhythm.weeksConsidered} tuần đã qua</span>}
      </div>

      {!rhythm.enough ? (
        <div className="px-5 py-6">
          <p className="text-center text-sm leading-relaxed text-slate-400">
            Chưa đủ dữ liệu để thấy quy luật: cần khoảng 3 tháng đơn hàng (từ {RHYTHM_MIN_WEEKS} tuần đã kết thúc trở
            lên), hiện mới có {rhythm.weeksConsidered} tuần trong 6 tháng gần nhất.
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {rhythm.positions.map((p) => {
              const isBusiest = rhythm.busiest?.position === p.position;
              const isQuietest = rhythm.quietest?.position === p.position && rhythm.busiest?.position !== p.position;
              return (
                <li key={p.position} className="flex items-baseline justify-between gap-3 px-5 py-3">
                  <span className="font-semibold text-slate-900">
                    Tuần {p.position}
                    {isBusiest && <span className="ml-2 text-xs font-semibold text-emerald-600">đông nhất</span>}
                    {isQuietest && <span className="ml-2 text-xs font-semibold text-red-600">vắng nhất</span>}
                  </span>
                  {p.occurrences === 0 ? (
                    <span className="shrink-0 text-sm text-slate-400">chưa xuất hiện trong 6 tháng qua</span>
                  ) : (
                    <span className="shrink-0 text-sm text-slate-500">
                      TB <b className="text-slate-900">{fmtAvg(p.avgOrders)} đơn</b> · xuất hiện {p.occurrences} lần ·{' '}
                      <span
                        className={`font-semibold ${
                          p.diff == null ? 'text-slate-400' : p.diff >= 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}
                      >
                        {fmtDiff(p.diff)}
                      </span>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="space-y-1.5 px-5 pb-4 pt-3">
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
      )}
    </section>
  );
}
