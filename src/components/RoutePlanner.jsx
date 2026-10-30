import { useMemo, useState } from 'react';
import { AlarmClock, Loader2, LocateFixed, MapPin, Navigation, Phone, Route, Store, Truck } from 'lucide-react';
import { dueInfo, formatDue } from '../lib/due';
import { cachedGeocode, currentPosition, directionsUrl, geocode } from '../lib/geo';
import { mapsUrl } from '../lib/shareOrder';
import { planRoute, SLOT_OPTIONS } from '../lib/route';
import { formatMoney, orderTotal } from '../lib/stats';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Lộ trình giao cho các đơn ship chưa giao (Chờ xử lý / Hoàn thành)
export default function RoutePlanner({ orders, now, settings, onSetStatus }) {
  const [start, setStart] = useState(null); // { lat, lng, label, kind: 'gps' | 'shop' }
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [state, setState] = useState({ status: 'idle' });
  // Tăng sau mỗi lần tra địa chỉ để đọc lại kết quả đã lưu
  const [geoVersion, setGeoVersion] = useState(0);

  const active = useMemo(
    () => orders.filter((o) => o.deliverAt && o.customer?.address && (o.status === 'pending' || o.status === 'done')),
    [orders]
  );

  // Toạ độ lấy từ kết quả đã lưu trên máy; địa chỉ chưa tra thì chưa có
  const geo = useMemo(() => {
    const map = new Map();
    for (const o of active) {
      const hit = cachedGeocode(o.customer.address);
      map.set(o.id, hit && !hit.notFound ? hit : null);
    }
    return map;
  }, [active, geoVersion]);
  const unchecked = active.filter((o) => cachedGeocode(o.customer.address) === undefined);

  const plan = useMemo(() => planRoute(active, geo, start, now, slotMinutes), [active, geo, start, now, slotMinutes]);
  const stops = plan.slots.flatMap((s) => s.stops);
  const located = stops.filter((s) => s.geo);

  const run = async () => {
    const warnings = [];
    setState({ status: 'working', text: 'Đang lấy vị trí GPS…' });
    let origin = null;
    try {
      origin = { ...(await currentPosition()), label: 'Vị trí hiện tại (GPS)', kind: 'gps' };
    } catch (err) {
      if (settings.shopAddress) {
        try {
          const shop = await geocode(settings.shopAddress);
          if (shop) origin = { ...shop, label: `Quán: ${settings.shopAddress}`, kind: 'shop' };
        } catch {
          // không tra được địa chỉ quán: bắt đầu từ đơn sớm nhất
        }
      }
      warnings.push(
        `${err.message}. ${origin ? 'Đang tính từ địa chỉ quán.' : 'Bắt đầu từ đơn sớm nhất (nhập "Địa chỉ quán" trong Cài đặt app để có điểm xuất phát).'}`
      );
    }
    setStart(origin);

    const todo = active.filter((o) => cachedGeocode(o.customer.address) === undefined);
    try {
      for (const [i, o] of todo.entries()) {
        setState({ status: 'working', text: `Đang tìm địa chỉ trên bản đồ ${i + 1}/${todo.length}…` });
        await geocode(o.customer.address);
        setGeoVersion((v) => v + 1);
      }
    } catch (err) {
      warnings.push(err.message);
    }
    setGeoVersion((v) => v + 1);
    setState({ status: 'ready', warnings });
  };

  if (!active.length) {
    return <p className="rounded-3xl bg-white/60 px-5 py-12 text-center text-slate-400">Không có đơn ship nào cần giao</p>;
  }

  const working = state.status === 'working';

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-white/80 bg-white/80 p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Thứ tự giao: <b>giờ sớm trước</b> (theo khung giờ) → <b>giao hết từng vùng</b> → <b>điểm gần trước, xa sau</b>.
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Khung giờ:</span>
          {SLOT_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setSlotMinutes(m)}
              className={`rounded-full px-3 py-1 font-semibold ${slotMinutes === m ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
            >
              {m} phút
            </button>
          ))}
        </div>
        <button
          onClick={run}
          disabled={working}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white active:bg-blue-600 disabled:opacity-60"
        >
          {working ? <Loader2 size={19} className="animate-spin" /> : <LocateFixed size={19} />}
          {working ? state.text : start ? 'Cập nhật vị trí & sắp xếp lại' : 'Lấy vị trí GPS & sắp xếp'}
        </button>
        {start && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            {start.kind === 'shop' ? <Store size={15} /> : <LocateFixed size={15} />} Xuất phát: {start.label}
          </p>
        )}
        {unchecked.length > 0 && !working && (
          <p className="text-sm font-semibold text-amber-700">
            {unchecked.length} địa chỉ chưa tìm trên bản đồ – bấm nút trên để sắp xếp đủ.
          </p>
        )}
        {state.warnings?.map((w, i) => (
          <p key={i} className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {w}
          </p>
        ))}
        {located.length > 0 && (
          <a
            href={directionsUrl(start, located.map((s) => s.geo))}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-500 py-3 font-semibold text-blue-600 active:bg-blue-50"
          >
            <Navigation size={18} />
            Mở lộ trình trên Google Maps{located.length > 10 ? ' (10 điểm đầu)' : ''}
          </a>
        )}
        {plan.totalKm > 0 && (
          <p className="text-center text-xs text-slate-400">
            Tổng ~{plan.totalKm.toFixed(1)} km đường chim bay · đường thật thường dài hơn
          </p>
        )}
      </section>

      {plan.slots.map((slot) => (
        <section key={slot.label} className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
          <h2
            className={`flex items-center gap-2 px-5 py-3 font-bold ${slot.overdue ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-800'}`}
          >
            <AlarmClock size={17} /> {slot.label}
          </h2>
          <ol className="divide-y divide-slate-100">
            {slot.stops.map(({ order, geo: g, distanceKm, index }, i) => {
              const due = dueInfo(order, now);
              const newZone = g?.zone && slot.stops[i - 1]?.geo?.zone !== g.zone;
              return (
                <li key={order.id} className="px-4 py-3">
                  {newZone && (
                    <p className="mb-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                      <MapPin size={12} /> {g.zone}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 font-bold text-white">
                      {index}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-900">
                        #{order.number} · {order.customer.name}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 text-sm">
                        <span className="font-semibold text-blue-700">Giao {hhmm(order.deliverAt)}</span>
                        {due && (
                          <span className={due.level === 'overdue' ? 'font-semibold text-red-600' : 'font-semibold text-orange-600'}>
                            {formatDue(due)}
                          </span>
                        )}
                        {distanceKm != null && <span className="text-slate-500">~{distanceKm.toFixed(1)} km</span>}
                      </p>
                      <a
                        href={mapsUrl(order.customer.address)}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-sm text-blue-700 underline decoration-blue-200 underline-offset-2"
                      >
                        {order.customer.address}
                      </a>
                      {!g && (
                        <p className="text-xs font-semibold text-amber-700">
                          {cachedGeocode(order.customer.address)?.notFound
                            ? 'Không tìm thấy địa chỉ trên bản đồ – kiểm tra lại địa chỉ'
                            : 'Chưa tìm trên bản đồ'}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {order.items.map((it) => `${it.qty}× ${it.name}`).join(', ')} · {formatMoney(orderTotal(order))}
                        {!order.paid && <b className="text-red-600"> · thu tiền</b>}
                        {order.status === 'pending' && <span className="text-amber-700"> · chưa nấu xong</span>}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2 pl-11">
                    {order.customer.phone && (
                      <a
                        href={`tel:${order.customer.phone}`}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600"
                      >
                        <Phone size={14} /> Gọi
                      </a>
                    )}
                    <button
                      onClick={() => onSetStatus(order.id, 'shipped')}
                      className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white active:bg-blue-600"
                    >
                      <Truck size={14} /> Đã ship
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}

      <p className="flex items-center justify-center gap-1 text-xs text-slate-400">
        <Route size={12} /> Bản đồ: © OpenStreetMap
      </p>
    </div>
  );
}
