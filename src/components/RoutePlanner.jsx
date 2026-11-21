import { useMemo, useState } from 'react';
import { AlarmClock, Check, Loader2, LocateFixed, MapPin, Navigation, Phone, Route, Send, Store } from 'lucide-react';
import { dueInfo, formatDue } from '../lib/due';
import { cachedGeocode, currentPosition, directionsUrl, geocode, MAX_ROUTE_STOPS } from '../lib/geo';
import { mapsUrl, routeText, shareText } from '../lib/shareOrder';
import { planRoute, SLOT_OPTIONS } from '../lib/route';
import { formatMoney, orderTotal } from '../lib/stats';

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (iso) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Đơn thuộc về chuyến giao hôm nay: giờ giao rơi vào hôm nay hoặc sớm hơn — đơn đang giao tồn từ hôm trước vẫn hiện (tránh sót đơn); đơn hẹn giao sau hôm nay thì chưa hiện (giờ máy)
const isTodayOrEarlier = (iso, now) => {
  const d = new Date(iso);
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  return day(d) <= day(now);
};

// Lộ trình giao cho các đơn đang đi giao (trạng thái "Đang giao"): đơn của hôm nay và đơn tồn từ hôm trước
export default function RoutePlanner({ orders, now, settings, onSetStatus }) {
  const [start, setStart] = useState(null); // { lat, lng, label, kind: 'gps' | 'shop' }
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [state, setState] = useState({ status: 'idle' });
  // Tăng sau mỗi lần tra địa chỉ để đọc lại kết quả đã lưu
  const [geoVersion, setGeoVersion] = useState(0);
  const [shareMsg, setShareMsg] = useState(null);

  // Đơn đang giao có giờ giao hôm nay hoặc sớm hơn (đơn tồn hôm trước rơi vào khung "Đã trễ giờ"); đơn đang giao mà chưa có giờ giao vẫn hiện (không giấu đơn đang trên xe)
  const active = useMemo(
    () => orders.filter((o) => o.status === 'delivering' && (!o.deliverAt || isTodayOrEarlier(o.deliverAt, now))),
    [orders, now]
  );
  // planRoute cần giờ giao để chia khung giờ; đơn chưa có giờ giao xếp vào một nhóm riêng ở cuối
  const plannable = useMemo(() => active.filter((o) => o.deliverAt), [active]);
  const noTime = useMemo(() => active.filter((o) => !o.deliverAt), [active]);

  // Toạ độ lấy từ kết quả đã lưu trên máy; địa chỉ chưa tra thì chưa có
  const geo = useMemo(() => {
    const map = new Map();
    for (const o of active) {
      if (!o.customer?.address) {
        map.set(o.id, null);
        continue;
      }
      const hit = cachedGeocode(o.customer.address);
      map.set(o.id, hit && !hit.notFound ? hit : null);
    }
    return map;
  }, [active, geoVersion]);
  const unchecked = active.filter((o) => o.customer?.address && cachedGeocode(o.customer.address) === undefined);

  const plan = useMemo(() => {
    const base = planRoute(plannable, geo, start, now, slotMinutes);
    if (!noTime.length) return base;
    const firstIndex = base.slots.reduce((n, s) => n + s.stops.length, 0);
    const extra = {
      label: 'Chưa có giờ giao',
      overdue: false,
      stops: noTime.map((o, i) => ({ order: o, geo: geo.get(o.id) ?? null, distanceKm: null, index: firstIndex + i + 1 })),
    };
    return { slots: [...base.slots, extra], totalKm: base.totalKm };
  }, [plannable, noTime, geo, start, now, slotMinutes]);
  const stops = plan.slots.flatMap((s) => s.stops);
  const located = stops.filter((s) => s.geo);

  // Điểm bắt đầu của từng chặng chỉ đường: điểm có toạ độ ngay trước đó trong lộ trình;
  // điểm đầu tiên lấy điểm xuất phát (chưa có thì app bản đồ tự dùng vị trí hiện tại)
  const legOrigin = useMemo(() => {
    const map = new Map();
    let prev = start;
    for (const s of stops) {
      if (!s.geo) continue;
      map.set(s.order.id, prev);
      prev = s.geo;
    }
    return map;
  }, [stops, start]);

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

    const todo = active.filter((o) => o.customer?.address && cachedGeocode(o.customer.address) === undefined);
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

  const shareRoute = async () => {
    try {
      const result = await shareText(routeText(plan, start, settings.shopName, settings.mapsApp));
      if (result === 'copied') setShareMsg('Đã copy lộ trình, dán vào Zalo / Messenger cho shipper');
    } catch {
      setShareMsg('Không copy được, hãy thử lại');
    }
    setTimeout(() => setShareMsg(null), 4000);
  };

  if (!active.length) {
    return (
      <p className="rounded-3xl bg-card px-5 py-12 text-center text-slate-400">
        Chưa có đơn nào đang giao — khi bắt đầu đi giao, bấm “Đã mang đi” trên thẻ đơn
      </p>
    );
  }

  const working = state.status === 'working';

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
        <p className="text-sm text-slate-600">
          Thứ tự giao: <b>giờ sớm trước</b> (theo khung giờ) → <b>giao hết từng vùng</b> → <b>điểm gần trước, xa sau</b>.
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Khung giờ:</span>
          {SLOT_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setSlotMinutes(m)}
              className={`rounded-full px-3 py-1 font-semibold ${slotMinutes === m ? 'bg-slate-900 text-slate-50' : 'bg-slate-100 text-slate-600'}`}
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
          <>
            {/* Mặc định mở Apple Maps; Google Maps là lựa chọn phụ */}
            <a
              href={directionsUrl(start, located.map((s) => s.geo), 'apple')}
              target="_blank"
              rel="noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-blue-500 py-3 font-semibold text-blue-600 active:bg-blue-50"
            >
              <Navigation size={18} />
              Mở lộ trình trên Apple Maps
              {located.length > MAX_ROUTE_STOPS ? ` (${MAX_ROUTE_STOPS} điểm đầu)` : ''}
            </a>
            <a
              href={directionsUrl(start, located.map((s) => s.geo), 'google')}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm font-semibold text-slate-500 underline-offset-2 active:underline"
            >
              hoặc mở lộ trình bằng Google Maps
              {located.length > MAX_ROUTE_STOPS ? ` (${MAX_ROUTE_STOPS} điểm đầu)` : ''}
            </a>
          </>
        )}
        <button
          onClick={shareRoute}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-50 py-3 font-semibold text-blue-700 active:bg-blue-100"
        >
          <Send size={18} /> Gửi lộ trình cho shipper ({stops.length} điểm)
        </button>
        {shareMsg && <p className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{shareMsg}</p>}
        {plan.totalKm > 0 && (
          <p className="text-center text-xs text-slate-400">
            Tổng ~{plan.totalKm.toFixed(1)} km đường chim bay · đường thật thường dài hơn
          </p>
        )}
      </section>

      {plan.slots.map((slot) => (
        <section key={slot.label} className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
          <h2
            className={`flex items-center gap-2 px-5 py-3 font-bold ${slot.overdue ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-800'}`}
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
                        {order.deliverAt ? (
                          <span className="font-semibold text-blue-700">Giao {hhmm(order.deliverAt)}</span>
                        ) : (
                          <span className="font-semibold text-amber-700">Chưa có giờ giao</span>
                        )}
                        {due && (
                          <span className={due.level === 'overdue' ? 'font-semibold text-red-600' : 'font-semibold text-slate-900'}>
                            {formatDue(due)}
                          </span>
                        )}
                        {distanceKm != null && <span className="text-slate-500">~{distanceKm.toFixed(1)} km</span>}
                      </p>
                      {order.customer.address ? (
                        <a
                          href={mapsUrl(order.customer.address, settings.mapsApp)}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-sm text-blue-700 underline decoration-blue-200 underline-offset-2"
                        >
                          {order.customer.address}
                        </a>
                      ) : (
                        <p className="text-sm font-semibold text-amber-700">Thiếu địa chỉ giao</p>
                      )}
                      {!g && order.customer.address && (
                        <p className="text-xs font-semibold text-amber-700">
                          {cachedGeocode(order.customer.address)?.notFound
                            ? 'Không tìm thấy địa chỉ trên bản đồ – kiểm tra lại địa chỉ'
                            : 'Chưa tìm trên bản đồ'}
                        </p>
                      )}
                      <p className="text-xs text-slate-500">
                        {order.items.map((it) => `${it.qty}× ${it.name}${it.note ? ` (${it.note})` : ''}`).join(', ')} · {formatMoney(orderTotal(order))}
                        {!order.paid && <b className="text-red-600"> · thu tiền</b>}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 pl-11">
                    {order.customer.phone && (
                      <a
                        href={`tel:${order.customer.phone}`}
                        className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-600"
                      >
                        <Phone size={14} /> Gọi
                      </a>
                    )}
                    {g && (
                      <>
                        {/* Chỉ đường từng chặng (điểm trước → điểm này) để không dính giới hạn 10 điểm của link cả lộ trình.
                            Mặc định Apple Maps, Google Maps là phụ */}
                        <a
                          href={directionsUrl(legOrigin.get(order.id) ?? null, [g], 'apple')}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-700 active:bg-blue-100"
                        >
                          <Navigation size={14} /> Chỉ đường (Apple Maps)
                        </a>
                        <a
                          href={directionsUrl(legOrigin.get(order.id) ?? null, [g], 'google')}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-slate-500 underline-offset-2 active:underline"
                        >
                          Google Maps
                        </a>
                      </>
                    )}
                    <button
                      onClick={() => onSetStatus(order.id, 'shipped')}
                      className="flex items-center gap-1 rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white active:bg-blue-600"
                    >
                      <Check size={14} /> Đã giao xong
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
