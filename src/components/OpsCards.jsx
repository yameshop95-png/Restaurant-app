// Bốn thẻ vận hành ở tab Theo kỳ của Báo cáo (PR #83): Đơn theo vùng, Giao hàng,
// Công nợ, Xử lý đơn web. Số liệu từ lib/opsReport (thuần, có test riêng); các thẻ
// này chỉ hiển thị + lo tương tác (gọi điện, đánh dấu đã thu).
import { useMemo } from 'react';
import { Phone } from 'lucide-react';
import { cachedGeocode } from '../lib/geo';
import { storedGeoOf } from '../lib/orderGeo';
import { debtReport, deliveryReport, regionReport, webReport } from '../lib/opsReport';
import { formatMinutes, sideOf } from '../lib/route';
import { DEFAULT_ZONES } from '../lib/shippingZones';
import { formatMoney } from '../lib/stats';

function Section({ title, children }) {
  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="px-5 pt-4">
        <h2 className="font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const fmtRate = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const fmtHours = (ms) => {
  if (ms == null) return '—';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} phút`;
  return `${Math.floor(mins / 60)} giờ${mins % 60 ? ` ${String(mins % 60).padStart(2, '0')} phút` : ''}`;
};

// --- Thẻ F: Đơn theo vùng ---
export function RegionCard({ orders, range, settings }) {
  const zones = settings?.shippingZones ?? DEFAULT_ZONES;
  const data = useMemo(() => regionReport(orders, range, zones), [orders, range, zones]);
  const max = Math.max(...data.rows.map((r) => r.revenue), 0);
  return (
    <Section title="Đơn theo vùng">
      <div className="px-5 pb-5 pt-1">
        <p className="text-xs text-slate-400">
          Chỉ tính đơn giao hàng · {data.pickupOrders} đơn đến lấy không tính theo vùng
        </p>
        {data.deliveryOrders === 0 ? (
          <p className="py-6 text-center text-slate-400">Chưa có đơn giao hàng trong kỳ này</p>
        ) : (
          <>
            <ul className="mt-3 space-y-2.5">
              {data.rows.map((r) => (
                <li key={r.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={`font-medium ${r.name === 'Chưa rõ vùng' ? 'text-slate-400' : 'text-slate-800'}`}>{r.name}</span>
                    <span className="shrink-0 text-slate-600">
                      <b className="text-slate-900">{formatMoney(r.revenue)}</b> · {r.orders} đơn · {fmtRate(r.share)}
                    </span>
                  </div>
                  <div className={`mt-1 h-2 overflow-hidden rounded-full bg-slate-100 ${r.name === 'Chưa rõ vùng' ? 'border border-dashed border-slate-300' : ''}`}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${max ? (r.revenue / max) * 100 : 0}%`, background: r.name === 'Chưa rõ vùng' ? '#cbd5e1' : 'var(--chart-series)' }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Dựa trên {data.withZone}/{data.deliveryOrders} đơn giao có vùng
            </p>
            {data.warn && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Nhiều đơn thiếu địa chỉ, tỉ lệ các vùng có thể chưa chính xác
              </p>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

// --- Thẻ C: Giao hàng ---
export function DeliveryOpsCard({ orders, range, settings }) {
  const zones = settings?.shippingZones ?? DEFAULT_ZONES;
  const fuelPerKm = Number(settings?.fuelCostPerKm) > 0 ? Number(settings.fuelCostPerKm) : 0.25;
  const data = useMemo(() => {
    // Toạ độ chỉ từ dữ liệu đã có: lưu trên đơn trước, cache của máy sau — không tra mạng
    const geo = new Map();
    for (const o of orders) {
      const g = storedGeoOf(o) ?? (o.customer?.address ? cachedGeocode(o.customer.address) : null);
      if (g) geo.set(o.id, g);
    }
    const start = settings?.shopAddress ? cachedGeocode(settings.shopAddress) : null;
    const homeSide = sideOf(settings?.shopAddress) ?? 'vic';
    return deliveryReport(orders, range, { geo, start, homeSide, fuelPerKm, zones });
  }, [orders, range, settings, zones, fuelPerKm]);

  return (
    <Section title="Giao hàng">
      <div className="px-5 pb-5 pt-1">
        {data.runs === 0 ? (
          <p className="py-6 text-center text-slate-400">Chưa có đơn giao hàng trong kỳ này</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 py-2.5">
                <p className="text-lg font-bold text-slate-900">{data.stops}</p>
                <p className="text-[11px] text-slate-500">điểm dừng · {data.runs} đợt</p>
              </div>
              <div className="rounded-2xl bg-slate-50 py-2.5">
                <p className="text-lg font-bold text-slate-900">{data.km.toFixed(1)} km</p>
                <p className="text-[11px] text-slate-500">ước tính đường chim bay × 1,4</p>
              </div>
              <div className="rounded-2xl bg-slate-50 py-2.5">
                <p className="text-lg font-bold text-slate-900">{formatMinutes(data.minutes)}</p>
                <p className="text-[11px] text-slate-500">thời gian chạy xe + dừng</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li className="flex justify-between">
                <span>Giao đúng giờ (trễ tối đa 30 phút)</span>
                <b className="text-slate-900">{data.onTime.rate == null ? '—' : `${fmtRate(data.onTime.rate)} (n = ${data.onTime.n})`}</b>
              </li>
              <li className="flex justify-between">
                <span>Đơn giao không được</span>
                <b className="text-slate-900">{data.failedNow}</b>
              </li>
              <li className="flex justify-between">
                <span>Phí ship đã thu</span>
                <b className="text-slate-900">{formatMoney(data.shippingCollected)}</b>
              </li>
              <li className="flex justify-between">
                <span>Chi phí xăng ước tính ({formatMoney(fuelPerKm)}/km)</span>
                <b className="text-slate-900">{formatMoney(data.fuelCost)}</b>
              </li>
            </ul>
            <p className="mt-1 text-xs text-slate-400">Đơn giao không được chỉ đếm đơn đang ở trạng thái này.</p>
            {data.byZone.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="text-xs font-semibold text-slate-500">Theo vùng phí — đối chiếu phí thu với xăng xe</p>
                <ul className="mt-1.5 space-y-1 text-sm text-slate-600">
                  {data.byZone.map((z) => (
                    <li key={z.zone} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{z.zone}</span>
                      <span className="shrink-0">
                        thu <b className="text-slate-900">{formatMoney(z.shipping)}</b> · xăng ≈ {formatMoney(z.fuel)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}

// --- Thẻ D: Công nợ ---
export function DebtCard({ orders, onSetPaid }) {
  const data = useMemo(() => debtReport(orders, new Date()), [orders]);
  return (
    <Section title="Công nợ">
      <div className="px-5 pb-5 pt-1">
        <p className="text-xs text-slate-400">Không phụ thuộc kỳ đang chọn — mọi đơn chưa thu quá 7 ngày</p>
        {data.groups.length === 0 ? (
          <p className="py-6 text-center text-slate-400">Không có đơn chưa thu quá 7 ngày</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {data.groups.map((g) => (
              <li key={g.key} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-medium text-slate-800">{g.name || 'Khách không tên'}</span>
                  <span className="shrink-0 font-bold text-red-600">{formatMoney(g.total)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {g.count} đơn · đơn cũ nhất {g.ageDays} ngày{g.phone ? ` · ${g.phone}` : ''}
                </p>
                <div className="mt-1.5 flex gap-2">
                  {g.phone && (
                    <a
                      href={`tel:${g.phone.replace(/\s/g, '')}`}
                      className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 active:bg-slate-200"
                    >
                      <Phone size={13} /> Gọi
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Đã thu đủ ${formatMoney(g.total)} của ${g.name || 'khách này'} (${g.count} đơn)?`)) {
                        for (const id of g.orderIds) onSetPaid?.(id, true);
                      }
                    }}
                    className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 active:bg-emerald-200"
                  >
                    Đã thu
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

// --- Thẻ E: Xử lý đơn web ---
export function WebOpsCard({ orders, range }) {
  const data = useMemo(() => webReport(orders, range), [orders, range]);
  return (
    <Section title="Xử lý đơn web">
      <div className="px-5 pb-5 pt-1">
        {data.web === 0 ? (
          <p className="py-6 text-center text-slate-400">Chưa có đơn web trong kỳ này</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-2xl bg-slate-50 py-2.5">
                <p className="text-lg font-bold text-slate-900">{fmtHours(data.meanMs)}</p>
                <p className="text-[11px] text-slate-500">xác nhận trung bình</p>
              </div>
              <div className="rounded-2xl bg-slate-50 py-2.5">
                <p className="text-lg font-bold text-slate-900">{fmtHours(data.medianMs)}</p>
                <p className="text-[11px] text-slate-500">trung vị (n = {data.n} đơn)</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              <li className="flex justify-between">
                <span>Đơn web / đơn nhập tay</span>
                <b className="text-slate-900">{data.web} / {data.manual}</b>
              </li>
              {data.skipped > 0 && (
                <li className="flex justify-between">
                  <span>Đơn thiếu mốc thời gian (bỏ qua)</span>
                  <b className="text-slate-900">{data.skipped}</b>
                </li>
              )}
            </ul>
            {data.slow.length > 0 && (
              <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                Xác nhận chậm hơn 2 giờ: {data.slow.map((s) => `đơn #${s.number} (${fmtHours(s.hours * 3600000)})`).join(' · ')}
              </p>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
