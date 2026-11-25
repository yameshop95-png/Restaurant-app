// Số liệu "đợt thứ Bảy này" cho tab Đợt này của Báo cáo (PR #82, docs/bao-cao-plan.md).
// Hàm thuần, component chỉ hiển thị. Mọi số tính từ danh sách đơn trong bộ nhớ —
// không truy vấn thêm, không polling riêng (trang tự làm mới theo nhịp của app).
//
// Quy ước đợt: đợt là TUẦN GIAO Thứ Hai 00:00 → Chủ nhật 24:00 chứa ngày giao thứ
// Bảy. Thứ Hai → thứ Bảy: đợt là thứ Bảy của tuần này. Từ Chủ nhật 00:00: đợt đã
// chuyển sang thứ Bảy tuần sau (đợt vừa giao xong không còn là "đợt này").
// Đơn thuộc đợt theo ngày bán (saleDate = ngày giao), nhịp nhận đơn theo createdAt.
import { isCookingOrder, isInboxOrder } from './batches';
import { dishKey } from './dishKey';
import { saleDate } from './saleDate';
import { orderTotal, startOfWeek } from './stats';
import { sideOf } from './route';

const DAY = 86400000;
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

// Thứ Bảy của đợt hiện tại (00:00) + mốc Thứ Hai đầu tuần giao của đợt.
export function runSaturdayOf(now = new Date()) {
  const monday = startOfWeek(now);
  if (now.getDay() === 0) return new Date(monday.getTime() + 12 * DAY); // Chủ nhật → thứ Bảy tuần sau
  return new Date(monday.getTime() + 5 * DAY);
}

const saturdayOfWeek = (d) => new Date(startOfWeek(d).getTime() + 5 * DAY);

const inWeekOf = (orders, saturday) => {
  const start = saturday.getTime() - 5 * DAY;
  const end = saturday.getTime() + 2 * DAY;
  return orders.filter((o) => {
    if (o.status === 'cancelled') return false;
    const d = saleDate(o).getTime();
    return d >= start && d < end;
  });
};

export function currentRun(orders, now = new Date(), { forecast = null, homeSide = 'vic' } = {}) {
  const saturday = runSaturdayOf(now);
  const runOrders = inWeekOf(orders, saturday);
  const received = runOrders.length;

  // --- Nhịp nhận đơn: so với 4 đợt trước ở CÙNG khoảng cách tới ngày giao ---
  // Đợt trước k: đếm đơn của đợt đó đã tạo trước mốc (thứ Bảy của đợt đó − khoảng
  // cách từ now tới thứ Bảy đợt này). Chỉ tính các đợt trước có thật đơn (quán có
  // bán); dưới 2 đợt trước thì không so sánh. Chênh dưới 3 đơn thì ẩn %.
  const distance = saturday.getTime() - now.getTime();
  const prevCounts = [];
  const prevCumulative = [];
  for (let k = 1; k <= 4; k++) {
    const satK = new Date(saturday.getTime() - 7 * k * DAY);
    const weekOrders = inWeekOf(orders, satK);
    if (!weekOrders.length) continue;
    const cutoff = satK.getTime() - distance;
    prevCounts.push(weekOrders.filter((o) => new Date(o.createdAt).getTime() <= cutoff).length);
    prevCumulative.push({ satK: satK.getTime(), weekOrders });
  }
  const pace =
    prevCounts.length >= 2
      ? (() => {
          const avg = prevCounts.reduce((a, b) => a + b, 0) / prevCounts.length;
          const delta = received - avg;
          return {
            avg,
            delta,
            pct: Math.abs(delta) < 3 || avg === 0 ? null : delta / avg,
            prevRuns: prevCounts.length,
          };
        })()
      : null;

  // --- Tích luỹ theo ngày trong tuần giao: T2 → hôm nay (tối đa tới thứ Bảy) ---
  const monday = new Date(saturday.getTime() - 5 * DAY);
  const todayIdx = Math.min(Math.max(Math.floor((now.getTime() - monday.getTime()) / DAY), 0), 5);
  const cumulative = [];
  for (let i = 0; i <= todayIdx; i++) {
    const dayEnd = monday.getTime() + (i + 1) * DAY;
    const cur = runOrders.filter((o) => new Date(o.createdAt).getTime() < dayEnd).length;
    let avg = null;
    if (prevCumulative.length >= 2) {
      const vals = prevCumulative.map(({ satK, weekOrders }) => {
        const endK = satK - 5 * DAY + (i + 1) * DAY;
        return weekOrders.filter((o) => new Date(o.createdAt).getTime() < endK).length;
      });
      avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    cumulative.push({ label: WEEKDAYS[i], current: cur, avg });
  }

  // --- Tiến độ đợt: 6 ô là một phân hoạch — mỗi đơn chưa huỷ của đợt nằm đúng 1 ô ---
  // Chờ xử lý / Chờ nấu dùng đúng isInboxOrder / isCookingOrder của lib/batches.
  // "Đã giao" gồm đơn giao đã shipped và đơn đến lấy done + đã thu tiền; đơn đến lấy
  // done chưa thu tiền vẫn ở ô "Nấu xong". Tổng 6 ô luôn bằng received.
  const progress = {
    inbox: runOrders.filter(isInboxOrder).length,
    cooking: runOrders.filter(isCookingOrder).length,
    done: runOrders.filter((o) => o.status === 'done' && !(o.type !== 'delivery' && o.paid)).length,
    delivering: runOrders.filter((o) => o.status === 'delivering').length,
    shipped: runOrders.filter(
      (o) => o.status === 'shipped' || (o.type !== 'delivery' && o.status === 'done' && o.paid),
    ).length,
    failed: runOrders.filter((o) => o.status === 'failed').length,
  };

  // --- Tiền của đợt ---
  const expected = runOrders.reduce((s, o) => s + orderTotal(o), 0);
  const collected = runOrders.filter((o) => o.paid).reduce((s, o) => s + orderTotal(o), 0);
  const money = { expected, collected, outstanding: expected - collected };

  // --- Cơ cấu đơn ---
  const delivery = runOrders.filter((o) => o.type === 'delivery');
  let wodonga = 0;
  let albury = 0;
  let unknown = 0;
  for (const o of delivery) {
    const side = sideOf(o.customer?.address);
    if (side == null) unknown += 1;
    else if (side === homeSide) wodonga += 1;
    else albury += 1;
  }
  const mix = { pickup: received - delivery.length, delivery: delivery.length, wodonga, albury, unknown };

  // --- Đặt hàng so với dự báo (thẻ B) ---
  // "Đã đặt" gộp bằng dishKey từ chính đơn của đợt (khớp tổng đợt ở trên); dự báo lấy
  // từ weeklyForecast mà nơi gọi truyền vào (cách gọi như ForecastCard).
  const orderedByKey = new Map();
  const rawNames = new Map();
  for (const o of runOrders) {
    for (const it of o.items ?? []) {
      const key = dishKey(it.name ?? '');
      if (!key) continue;
      orderedByKey.set(key, (orderedByKey.get(key) ?? 0) + (Number(it.qty) || 0));
      if (!rawNames.has(key)) rawNames.set(key, it.name);
    }
  }
  const forecastByKey = new Map((forecast?.items ?? []).map((it) => [it.key, it]));
  const keys = new Set([...orderedByKey.keys(), ...forecastByKey.keys()]);
  const dishRows = [...keys].map((key) => {
    const f = forecastByKey.get(key);
    const ordered = orderedByKey.get(key) ?? 0;
    const expectedQty = f ? f.expected : null;
    return {
      key,
      name: f?.name ?? rawNames.get(key) ?? key,
      ordered,
      forecast: expectedQty,
      remaining: expectedQty == null ? null : Math.max(0, expectedQty - ordered),
    };
  });
  // Sắp theo dự báo giảm dần; món có đơn mà chưa có dự báo xuống cuối
  dishRows.sort((a, b) => (b.forecast ?? -1) - (a.forecast ?? -1) || b.ordered - a.ordered);

  return {
    saturday,
    received,
    pace,
    cumulative,
    progress,
    money,
    mix,
    forecastReady: !!forecast?.ready,
    dishRows,
  };
}

// Doanh thu theo tuần giao cho biểu đồ ở tab Theo kỳ (kỳ Tháng): 8 đợt thứ Bảy gần
// nhất tính tới thứ Bảy cuối cùng của tháng đang xem (hoặc đợt hiện tại nếu tháng
// đang xem là tháng này). Mỗi cột: nhãn ngày thứ Bảy, doanh thu, số đơn, có phải
// đợt hiện tại không.
export function weeklyRevenue(orders, anchor = new Date(), now = new Date()) {
  const active = orders.filter((o) => o.status !== 'cancelled');
  const bySaturday = new Map();
  for (const o of active) {
    const sat = saturdayOfWeek(saleDate(o)).getTime();
    const row = bySaturday.get(sat) ?? { revenue: 0, orders: 0 };
    row.revenue += orderTotal(o);
    row.orders += 1;
    bySaturday.set(sat, row);
  }
  // Cột cuối = thứ Bảy cuối cùng nằm trong tháng của anchor
  const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  let lastSat = saturdayOfWeek(monthEnd);
  if (lastSat.getMonth() !== anchor.getMonth()) lastSat = new Date(lastSat.getTime() - 7 * DAY);
  const currentSat = runSaturdayOf(now).getTime();
  const out = [];
  for (let i = 7; i >= 0; i--) {
    const sat = new Date(lastSat.getTime() - 7 * i * DAY);
    const row = bySaturday.get(sat.getTime()) ?? { revenue: 0, orders: 0 };
    out.push({
      saturday: sat,
      label: `${String(sat.getDate()).padStart(2, '0')}/${String(sat.getMonth() + 1).padStart(2, '0')}`,
      revenue: row.revenue,
      orders: row.orders,
      isCurrent: sat.getTime() === currentSat,
    });
  }
  return out;
}
