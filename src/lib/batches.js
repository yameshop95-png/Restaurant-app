// Gom đợt giao tự động cho hàng "Chờ nấu" (Giai đoạn 2 của quy trình giao hàng).
// Nguyên tắc Paul đã chốt: code tự tính và sắp sẵn, Paul chỉ nhìn danh sách và làm theo —
// ưu tiên giờ giao trước, rồi đến địa chỉ tiện giao, mỗi đợt tối đa 15 đơn.
// Thứ tự trong ngày tái dùng đúng thuật toán lộ trình của planRoute (khung giờ → vùng →
// điểm gần trước), nên thứ tự bếp nấu theo đợt khớp thứ tự xe chạy sau đó.
import { planRoute } from './route.js';

// Mỗi đợt giao tối đa 15 đơn (Paul gom tầm 10–15 đơn tiện đường một chuyến)
export const BATCH_MAX = 15;
// Giờ chốt đơn của một ngày giao: đơn đặt sau 22:00 tối hôm trước ngày giao là "đơn trễ".
// Thực tế vận hành của quán: tới 22:00 tối thứ Sáu đã có ~95% đơn của tuần; ~5% khách đặt
// sáng thứ Bảy là đơn trễ, xử lý kiểu "nhận luôn giao luôn", không trộn vào các đợt đã sắp.
export const LATE_CUTOFF_HOUR = 22;

const pad = (n) => String(n).padStart(2, '0');
// Khoá ngày theo giờ máy: 'YYYY-MM-DD'
export const dayKeyOf = (iso) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Đơn thuộc hàng "Chờ nấu": đang chờ xử lý và đã xác nhận.
// Đơn web chỉ vào hàng nấu sau khi đã bấm "Xác nhận & nhắn khách" (có confirmedAt);
// đơn nhân viên tự nhập coi như đã xác nhận ngay từ đầu. Đơn web chưa xác nhận
// chỉ hiện ở mục "Chờ xử lý".
export const isCookingOrder = (o) => o.status === 'pending' && (o.source !== 'web' || !!o.confirmedAt);

// Hai trạm "Chờ xử lý" và "Chờ nấu" tách hẳn nhau, một đơn chờ chỉ nằm ở đúng một trạm:
// "Chờ xử lý" là hộp thư đến (đơn web chưa xác nhận — đang làm bước Nhận đơn / Nhắn khách);
// xác nhận xong đơn rời hẳn sang "Chờ nấu" và nằm chờ ở đó tới khi bếp bấm "Hoàn thành".
// Đơn nhân viên tự nhập đã xác nhận ngay từ đầu nên vào thẳng "Chờ nấu", không qua hộp thư đến.
export const isInboxOrder = (o) => o.status === 'pending' && !isCookingOrder(o);

// Đơn trễ (chỉ đơn giao hàng): giờ giao rơi vào ngày D mà đơn được tạo sau giờ chốt
// 22:00 của tối D−1. Đơn chưa có giờ giao không xếp loại trễ (đã có chip "Thiếu giờ giao").
export function isLateOrder(order) {
  if (order.type !== 'delivery' || !order.deliverAt || !order.createdAt) return false;
  const d = new Date(order.deliverAt);
  const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, LATE_CUTOFF_HOUR, 0, 0, 0);
  return new Date(order.createdAt).getTime() > cutoff.getTime();
}

// Tính đợt giao cho các đơn trong hàng chờ nấu.
// orders: danh sách đơn chờ nấu (đã lọc bằng isCookingOrder ở nơi gọi).
// geo: Map orderId -> { lat, lng, zone } | null như planRoute dùng (toạ độ đã tra sẵn
// trên máy); đơn chưa có toạ độ vẫn được xếp theo khung giờ như điểm chưa định vị.
// Trả về:
//   byOrder: Map orderId -> { dayKey, batchIndex, positionInBatch } (chỉ đơn có đợt)
//   batches: [{ dayKey, batchIndex, count, firstTime, lastTime, orderIds }] theo ngày → đợt
//   lateIds: Set orderId của đơn trễ (không vào đợt nào, hiện ở nhóm riêng)
//   lateCount: số đơn trễ
// Đơn đến lấy không bao giờ vào đợt; đơn giao thiếu giờ giao không vào đợt.
export function computeBatches(orders, geo = new Map()) {
  const eligible = orders.filter((o) => o.type === 'delivery' && o.deliverAt);
  const lateIds = new Set(eligible.filter(isLateOrder).map((o) => o.id));

  const byDay = new Map();
  for (const o of eligible) {
    if (lateIds.has(o.id)) continue;
    const key = dayKeyOf(o.deliverAt);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(o);
  }

  const byOrder = new Map();
  const batches = [];
  for (const dayKey of [...byDay.keys()].sort()) {
    const dayOrders = byDay.get(dayKey);
    // "now" của planRoute = đầu ngày giao, để khung giờ tính thuần theo giờ hẹn của
    // ngày đó (không dính khung "Đã trễ giờ" theo giờ xem) — thứ tự ổn định cả khi
    // xem trước từ tối hôm trước.
    const dayStart = new Date(dayOrders[0].deliverAt);
    dayStart.setHours(0, 0, 0, 0);
    const plan = planRoute(dayOrders, geo, null, dayStart);
    const ordered = plan.slots.flatMap((s) => s.stops.map((st) => st.order));
    for (let i = 0, batchIndex = 1; i < ordered.length; i += BATCH_MAX, batchIndex += 1) {
      const chunk = ordered.slice(i, i + BATCH_MAX);
      chunk.forEach((o, j) => byOrder.set(o.id, { dayKey, batchIndex, positionInBatch: j + 1 }));
      const times = chunk.map((o) => o.deliverAt).sort();
      batches.push({
        dayKey,
        batchIndex,
        count: chunk.length,
        firstTime: times[0],
        lastTime: times[times.length - 1],
        orderIds: chunk.map((o) => o.id),
      });
    }
  }
  return { byOrder, batches, lateIds, lateCount: lateIds.size };
}
