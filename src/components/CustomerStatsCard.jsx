import { useMemo } from 'react';
import { periodInsights } from '../lib/reportInsights';

// Thẻ "Khách hàng trong kỳ" ở tab Báo cáo: trong đúng kỳ đang chọn (trang truyền
// `range` của buildReport xuống), bao nhiêu khách đã mua, bao
// nhiêu khách MỚI (đơn đầu tiên trong lịch sử rơi vào kỳ này) và bao nhiêu khách
// QUAY LẠI (đã từng mua trước kỳ này). Định nghĩa + khoá định danh khách (SĐT,
// không có SĐT thì tên) nằm ở lib/reportInsights — dùng chung customerKey với
// danh bạ khách. Đơn huỷ không tính là lần mua; đơn không có thông tin khách
// được loại khỏi thống kê và ghi rõ số lượng ở cuối thẻ.
export default function CustomerStatsCard({ orders, range }) {
  const stats = useMemo(() => (range ? periodInsights(orders, range).customers : null), [orders, range]);

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="font-bold text-slate-900">Khách hàng trong kỳ</h2>
        {stats && stats.total > 0 && (
          <span className="text-sm text-slate-500">
            {Math.round((stats.returningRate ?? 0) * 100)}% là khách quay lại
          </span>
        )}
      </div>

      {!stats || stats.total === 0 ? (
        <p className="px-5 py-8 text-center text-slate-400">Chưa có khách nào trong kỳ này</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 px-5 py-4 text-center">
            <div>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">tổng khách</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{stats.newCount}</p>
              <p className="text-xs text-slate-500">khách mới</p>
            </div>
            <div>
              <p className="text-xl font-bold text-slate-900">{stats.returningCount}</p>
              <p className="text-xs text-slate-500">khách quay lại</p>
            </div>
          </div>
          <div className="space-y-1.5 px-5 pb-4">
            <p className="text-xs leading-relaxed text-slate-400">
              Khách mới: lần mua đầu tiên (không tính đơn huỷ) rơi vào kỳ này. Khách quay lại: đã từng mua trước kỳ
              này. Khách được nhận diện theo số điện thoại, không có SĐT thì theo tên — giống danh bạ khách của app.
            </p>
            {stats.anonymousOrders > 0 && (
              <p className="text-xs text-slate-400">
                Không tính {stats.anonymousOrders} đơn trong kỳ vì không có thông tin khách.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
