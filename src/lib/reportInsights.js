// Số liệu phụ cho tab Báo cáo, tính trên đúng kỳ đang chọn (range của buildReport):
// tỉ lệ đơn huỷ và khách mới / khách quay lại — cộng thêm nhịp tuần trong tháng.
// Quy ước chung của tab Báo cáo: đơn huỷ (status 'cancelled', xem lib/orderStatus)
// không tính là lần mua; thời điểm của đơn = lúc tạo đơn (createdAt).
import { customerKey } from '../hooks/useCustomers';
import { normalizeText } from './text';
import { weekOfMonth } from './forecast';
import { startOfWeek } from './stats';

// Khoá định danh khách của một đơn: dùng đúng customerKey mà danh bạ khách dùng
// (theo SĐT — chỉ lấy chữ số; không có SĐT thì theo tên đã chuẩn hoá). Đơn không có
// khách, hoặc khách không có cả SĐT lẫn tên → null (đơn "không định danh").
export function orderCustomerKey(order) {
  const c = order?.customer;
  if (!c) return null;
  const hasPhone = (c.phone ?? '').replace(/\D/g, '').length > 0;
  const hasName = normalizeText(c.name ?? '').length > 0;
  if (!hasPhone && !hasName) return null;
  return customerKey(c);
}

// Thống kê cho một kỳ [range.start, range.end):
// - cancellation: tổng đơn trong kỳ (gồm cả đơn huỷ), số đơn huỷ, tỉ lệ huỷ
//   (null khi kỳ không có đơn nào — tránh chia 0).
// - customers: chỉ tính đơn KHÔNG huỷ có định danh khách. Khách MỚI = đơn đầu tiên
//   trong toàn bộ lịch sử (không huỷ) của khách rơi vào kỳ này; khách QUAY LẠI =
//   có đơn trong kỳ này và đã có đơn (không huỷ) trước kỳ này. anonymousOrders =
//   số đơn không huỷ trong kỳ không có định danh khách (loại khỏi thống kê khách).
export function periodInsights(orders, range) {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  const inPeriod = (o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= startMs && t < endMs;
  };

  const period = orders.filter(inPeriod);
  const totalOrders = period.length;
  const cancelledOrders = period.filter((o) => o.status === 'cancelled').length;

  const active = orders.filter((o) => o.status !== 'cancelled');
  const firstAt = new Map(); // khoá khách → thời điểm đơn (không huỷ) đầu tiên trong lịch sử
  for (const o of active) {
    const key = orderCustomerKey(o);
    if (!key) continue;
    const t = new Date(o.createdAt).getTime();
    if (!firstAt.has(key) || t < firstAt.get(key)) firstAt.set(key, t);
  }
  const inPeriodKeys = new Set();
  let anonymousOrders = 0;
  for (const o of active) {
    if (!inPeriod(o)) continue;
    const key = orderCustomerKey(o);
    if (!key) {
      anonymousOrders += 1;
      continue;
    }
    inPeriodKeys.add(key);
  }
  let newCount = 0;
  let returningCount = 0;
  for (const key of inPeriodKeys) {
    const first = firstAt.get(key);
    if (first >= startMs && first < endMs) newCount += 1;
    else returningCount += 1;
  }

  return {
    cancellation: {
      totalOrders,
      cancelledOrders,
      cancelRate: totalOrders ? cancelledOrders / totalOrders : null,
    },
    customers: {
      total: inPeriodKeys.size,
      newCount,
      returningCount,
      returningRate: inPeriodKeys.size ? returningCount / inPeriodKeys.size : null,
      anonymousOrders,
    },
  };
}

// Số tuần dữ liệu thật tối thiểu để kết luận nhịp tuần trong tháng (~3 tháng).
export const RHYTHM_MIN_WEEKS = 12;

// Nhịp tuần trong tháng: các tuần Thứ Hai–Chủ nhật lặp lại theo VỊ TRÍ trong tháng có
// đông / vắng đơn hơn mặt bằng chung không. Vị trí của một tuần lấy đúng hàm
// weekOfMonth của lib/forecast (vị trí do ngày thứ Năm của tuần quyết định:
// ceil(ngày của thứ Năm / 7), tối đa 5) — cùng định nghĩa mà dự báo của app dùng.
// Chỉ tính các TUẦN ĐÃ KẾT THÚC trong tối đa 6 tháng gần nhất; nếu lịch sử bán thật
// ngắn hơn cửa sổ thì chỉ dùng phần có dữ liệu (từ tuần của đơn đầu tiên). Đơn huỷ
// không tính. Chỉ số chính là SỐ ĐƠN mỗi lần vị trí xuất hiện.
export function weekOfMonthRhythm(orders, now = new Date(), lookbackMonths = 6) {
  const currentStart = startOfWeek(now);
  const windowDate = new Date(currentStart);
  windowDate.setMonth(windowDate.getMonth() - lookbackMonths);
  const windowStart = startOfWeek(windowDate);

  const active = orders.filter((o) => o.status !== 'cancelled' && o.createdAt);
  let firstOrderStart = null;
  const byWeek = new Map(); // mốc Thứ Hai (ms) → số đơn trong tuần đó
  for (const o of active) {
    const ws = startOfWeek(new Date(o.createdAt)).getTime();
    if (firstOrderStart == null || ws < firstOrderStart) firstOrderStart = ws;
    if (ws >= windowStart.getTime() && ws < currentStart.getTime()) {
      byWeek.set(ws, (byWeek.get(ws) ?? 0) + 1);
    }
  }

  // Liệt kê mọi tuần đã kết thúc từ max(đầu cửa sổ, tuần của đơn đầu tiên) tới trước
  // tuần hiện tại — kể cả tuần 0 đơn trong khoảng đó (vẫn là một "lần xuất hiện").
  const weeks = [];
  if (firstOrderStart != null) {
    const from = Math.max(windowStart.getTime(), firstOrderStart);
    for (let t = from; t < currentStart.getTime(); ) {
      const start = new Date(t);
      weeks.push({ start, position: weekOfMonth(start), orders: byWeek.get(t) ?? 0 });
      const next = new Date(start);
      next.setDate(next.getDate() + 7);
      t = next.getTime();
    }
  }

  const totalOrders = weeks.reduce((s, w) => s + w.orders, 0);
  const overallAvg = weeks.length ? totalOrders / weeks.length : 0;
  const positions = [1, 2, 3, 4, 5].map((position) => {
    const list = weeks.filter((w) => w.position === position);
    const posTotal = list.reduce((s, w) => s + w.orders, 0);
    const avgOrders = list.length ? posTotal / list.length : null;
    return {
      position,
      occurrences: list.length,
      totalOrders: posTotal,
      avgOrders,
      diff: avgOrders != null && overallAvg > 0 ? avgOrders / overallAvg - 1 : null,
    };
  });

  // Đông / vắng nhất chỉ kết luận trên vị trí có ≥ 2 lần xuất hiện cho đỡ nhiễu.
  const reliable = positions.filter((p) => p.occurrences >= 2 && p.avgOrders != null);
  const busiest = reliable.length ? reliable.reduce((a, b) => (b.avgOrders > a.avgOrders ? b : a)) : null;
  const quietest = reliable.length ? reliable.reduce((a, b) => (b.avgOrders < a.avgOrders ? b : a)) : null;

  return {
    // Đủ dữ liệu = có ít nhất ~3 tháng (12 tuần) lịch sử thật trong cửa sổ và có đơn.
    enough: weeks.length >= RHYTHM_MIN_WEEKS && totalOrders > 0,
    weeksConsidered: weeks.length,
    totalOrders,
    overallAvg,
    positions,
    busiest,
    quietest,
  };
}
