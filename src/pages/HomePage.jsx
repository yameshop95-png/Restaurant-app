import { useMemo, useState } from 'react';
import { Archive, ChevronRight, Loader2, Send } from 'lucide-react';
import { NAV_ITEMS } from '../components/navigation';
import ForecastCard from '../components/ForecastCard';
import CountUp, { formatCount } from '../components/CountUp';
import { BACKUP_REMINDER_DAYS, daysSinceBackup } from '../lib/backup';
import { dueInfo, upcomingOrders } from '../lib/due';
import { shareText } from '../lib/shareOrder';
import { dailyCollection, formatDate, formatDay, formatMoney, summarize } from '../lib/stats';
import { donutSegments } from '../lib/donut';

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm ${className}`}
    >
      {title && <h2 className="px-5 pt-4 text-[13px] font-medium text-slate-500">{title}</h2>}
      {children}
    </section>
  );
}

// Nhắc sao lưu khi đã quá 7 ngày, hoặc chưa sao lưu lần nào mà đã dùng app hơn 1 ngày
function needsBackup(orders, lastBackupAt, now) {
  if (!orders.length) return false;
  const days = daysSinceBackup(lastBackupAt, now);
  if (days != null) return days >= BACKUP_REMINDER_DAYS;
  const firstOrderAt = orders.reduce((min, o) => (o.createdAt < min ? o.createdAt : min), orders[0].createdAt);
  return now - new Date(firstOrderAt) >= 86400000;
}

function BackupReminder({ lastBackupAt, onBackupNow }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const days = daysSinceBackup(lastBackupAt);

  const backup = async () => {
    setBusy(true);
    setError(null);
    try {
      await onBackupNow();
    } catch (err) {
      setError(err.message || 'Không tải được file, thử lại nhé');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-card px-5 py-5 text-slate-800">
      <p className="flex items-center gap-2 font-bold">
        <Archive size={18} className="shrink-0" />
        {days == null ? 'Chưa sao lưu dữ liệu lần nào' : `Đã ${days} ngày chưa sao lưu dữ liệu`}
      </p>
      <p className="mt-1 text-base leading-relaxed">
        Dữ liệu đã lưu trên máy chủ, nhưng vẫn nên giữ 1 file Excel dự phòng trong Drive / Zalo phòng khi có sự cố.
      </p>
      <button
        onClick={backup}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600 disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />} Sao lưu ngay
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    </section>
  );
}

const SHIFT_ROWS = [
  ['cash', 'Tiền mặt', 'shipper / thu ngân đang giữ'],
  ['transfer', 'Chuyển khoản', 'đối chiếu tài khoản ngân hàng'],
  ['payid', 'PayID', 'đối chiếu tài khoản ngân hàng'],
  ['unknown', 'Chưa ghi cách trả', null],
];

// Màu từng lát của vòng tròn chốt ca (khớp palette app: emerald = đã thu,
// xanh dương = chuyển khoản, đỏ nhạt = còn phải thu cần chú ý)
const SHIFT_COLORS = {
  cash: '#059669',
  transfer: '#3b82f6',
  payid: '#8b5cf6',
  unknown: '#94a3b8',
  unpaid: '#f87171',
};

// Vòng tròn vẽ bằng stroke-dasharray trên <circle>, cùng kiểu vòng tròn thiết bị
// ở tab Customer Active: tâm (72, 72), bán kính 60, bề dày 16.
const DONUT_R = 60;
const DONUT_CIRC = 2 * Math.PI * DONUT_R;

function ShiftClose({ orders, now, shopName }) {
  // Chốt ca quét toàn bộ đơn: chỉ tính lại khi đơn hoặc mốc giờ đổi, render khác thì dùng lại
  const day = useMemo(() => dailyCollection(orders, now), [orders, now]);
  const [msg, setMsg] = useState(null);
  const rows = SHIFT_ROWS.filter(([key]) => key !== 'unknown' || day.unknown.count);

  // Các lát của vòng tròn: đã thu theo từng cách trả + phần còn phải thu.
  // Mẫu số = đã thu + còn phải thu nên ngày chưa thu đồng nào (đã thu $0)
  // vòng tròn vẫn hiện trọn phần còn phải thu thay vì trống rỗng.
  const entries = [
    ...rows.map(([key, label, hint]) => ({
      key,
      label,
      hint,
      color: SHIFT_COLORS[key],
      total: day[key].total,
      count: day[key].count,
    })),
    {
      key: 'unpaid',
      label: 'Còn phải thu',
      hint: null,
      color: SHIFT_COLORS.unpaid,
      total: day.unpaid.total,
      count: day.unpaid.count,
    },
  ];
  const segs = donutSegments(
    entries.map((e) => e.total),
    DONUT_CIRC,
  );
  const totalText = formatMoney(day.total);
  const totalSize = totalText.length <= 8 ? 'text-[21px]' : totalText.length <= 10 ? 'text-lg' : 'text-[15px]';

  const share = async () => {
    const lines = [
      `${shopName ? `[${shopName}] ` : ''}Chốt ca ${formatDate(now)}`,
      ...rows.map(([key, label]) => `${label}: ${formatMoney(day[key].total)} (${day[key].count} đơn)`),
      `Tổng đã thu: ${formatMoney(day.total)}`,
      day.unpaid.count > 0 && `Còn phải thu: ${formatMoney(day.unpaid.total)} (${day.unpaid.count} đơn)`,
    ];
    try {
      if ((await shareText(lines.filter(Boolean).join('\n'))) === 'copied') setMsg('Đã copy báo cáo chốt ca');
    } catch {
      setMsg('Không copy được, hãy thử lại');
    }
    setTimeout(() => setMsg(null), 4000);
  };

  return (
    <Card title="Chốt ca hôm nay">
      <div className="px-5 pb-4 pt-1">
        <div className="flex flex-col items-center gap-4 min-[500px]:flex-row">
          <svg
            viewBox="0 0 144 144"
            className="h-40 w-40 shrink-0"
            role="img"
            aria-label={`Đã thu ${totalText} hôm nay: ${entries
              .map((e, i) => `${e.label} ${formatMoney(e.total)}, ${e.count} đơn, ${segs[i].percent}%`)
              .join('; ')}`}
          >
            <circle cx="72" cy="72" r={DONUT_R} fill="none" stroke="#e2e8f0" strokeWidth="16" />
            {entries.map((e, i) => {
              const s = segs[i];
              if (s.length <= 0) return null;
              // Lát chiếm trọn vòng: vẽ vòng tròn đầy, không chừa khe dasharray
              if (s.fraction >= 0.999) {
                return (
                  <circle key={e.key} cx="72" cy="72" r={DONUT_R} fill="none" stroke={e.color} strokeWidth="16" />
                );
              }
              return (
                <circle
                  key={e.key}
                  cx="72"
                  cy="72"
                  r={DONUT_R}
                  fill="none"
                  stroke={e.color}
                  strokeWidth="16"
                  strokeDasharray={`${Math.max(0, s.length - 2).toFixed(1)} ${(DONUT_CIRC - s.length + 2).toFixed(1)}`}
                  strokeDashoffset={(-s.offset).toFixed(1)}
                  transform="rotate(-90 72 72)"
                />
              );
            })}
            <text x="72" y="71" textAnchor="middle" className={`fill-emerald-600 font-bold tabular-nums ${totalSize}`}>
              {totalText}
            </text>
            <text x="72" y="90" textAnchor="middle" className="fill-slate-400 text-[11px]">
              đã thu hôm nay
            </text>
          </svg>
          <ul className="w-full min-w-0 flex-1 space-y-2">
            {entries.map((e, i) => (
              <li key={e.key} title={e.hint ?? undefined} className="flex items-center gap-2 text-sm">
                <i className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: e.color }} />
                <span
                  className={`min-w-0 flex-1 truncate ${e.key === 'unpaid' ? 'font-medium text-red-600' : 'text-slate-600'}`}
                >
                  {e.label}
                </span>
                <span className={`shrink-0 font-bold tabular-nums ${e.key === 'unpaid' ? 'text-red-600' : 'text-slate-900'}`}>
                  {formatMoney(e.total)}
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-slate-500">
                  {e.count} đơn · {segs[i].percent}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={share}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-200"
          >
            <Send size={15} aria-hidden="true" /> Gửi chốt ca
          </button>
        </div>
        {msg && <p className="mt-2 text-center text-sm font-semibold text-blue-700">{msg}</p>}
      </div>
    </Card>
  );
}

// Ô bảng điều khiển: mỗi ô là một mục trong menu (cùng tên, cùng biểu tượng), bấm vào là chuyển sang tab đó.
// Thẻ "Tiền tuần này" dạng vòng tròn theo hình mẫu Paul gửi: lát dày, hai đầu
// bo tròn, có khe hở nhỏ giữa các lát; tâm là tổng tiền tuần + nhãn + số đơn.
// Số liệu lấy thẳng từ summarize() (src/lib/stats.js) — cùng cơ chế với chốt ca:
// đơn trong tuần là đơn chưa huỷ tạo từ đầu tuần (thứ Hai); "đã thanh toán" là
// các đơn có paid, "chưa thanh toán" là phần còn lại của tổng tuần. Toán lát ở
// src/lib/donut.js (bản có khe hở).
const WEEK_DONUT_R = 55;
const WEEK_DONUT_CIRC = 2 * Math.PI * WEEK_DONUT_R;
const WEEK_DONUT_STROKE = 24;
const WEEK_DONUT_GAP = 8;

function WeekMoneyDonut({ stats }) {
  const entries = [
    { key: 'paid', label: 'Đã thanh toán', color: '#3b82f6', total: stats.weekPaid.total, count: stats.weekPaid.count },
    { key: 'unpaid', label: 'Chưa thanh toán', color: '#f87171', total: stats.weekUnpaid.total, count: stats.weekUnpaid.count },
  ];
  const segs = donutSegments(
    entries.map((e) => e.total),
    WEEK_DONUT_CIRC,
    { gap: WEEK_DONUT_GAP, strokeWidth: WEEK_DONUT_STROKE },
  );
  const totalText = formatMoney(stats.weekRevenue);
  const totalSize = totalText.length <= 8 ? 'text-[20px]' : totalText.length <= 10 ? 'text-[15px]' : 'text-[13px]';

  return (
    <section className="rounded-3xl border border-gold/40 bg-card px-5 pb-5 pt-4 shadow-sm">
      <div className="flex flex-col items-center gap-4 min-[500px]:flex-row">
        <svg
          viewBox="0 0 144 144"
          className="h-44 w-44 shrink-0"
          role="img"
          aria-label={`Tiền tuần này ${totalText}: ${entries
            .map((e, i) => `${e.label} ${formatMoney(e.total)}, ${e.count} đơn, ${segs[i].percent}%`)
            .join('; ')}`}
        >
          <circle cx="72" cy="72" r={WEEK_DONUT_R} fill="none" stroke="#e2e8f0" strokeWidth={WEEK_DONUT_STROKE} />
          {entries.map((e, i) => {
            const s = segs[i];
            if (e.total <= 0) return null;
            // Lát chiếm trọn vòng (chỉ một phía có tiền): vẽ vòng đầy, không khe
            if (s.drawLength >= WEEK_DONUT_CIRC - 0.01) {
              return (
                <circle key={e.key} cx="72" cy="72" r={WEEK_DONUT_R} fill="none" stroke={e.color} strokeWidth={WEEK_DONUT_STROKE} />
              );
            }
            return (
              <circle
                key={e.key}
                cx="72"
                cy="72"
                r={WEEK_DONUT_R}
                fill="none"
                stroke={e.color}
                strokeWidth={WEEK_DONUT_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${Math.max(0, s.drawLength).toFixed(1)} ${(WEEK_DONUT_CIRC - s.drawLength).toFixed(1)}`}
                strokeDashoffset={(-s.drawOffset).toFixed(1)}
                transform="rotate(-90 72 72)"
              />
            );
          })}
          <text x="72" y="67" textAnchor="middle" className={`fill-slate-900 font-bold tabular-nums ${totalSize}`}>
            {totalText}
          </text>
          <text x="72" y="86" textAnchor="middle" className="fill-slate-400 text-[11px]">
            Tiền tuần này
          </text>
          <text x="72" y="102" textAnchor="middle" className="fill-slate-400 text-[11px]">
            {stats.weekOrderCount} đơn
          </text>
        </svg>
        <ul className="w-full min-w-0 flex-1 space-y-2">
          {entries.map((e, i) => (
            <li key={e.key} className="flex items-center gap-2 text-sm">
              <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
              <span className={`min-w-0 flex-1 truncate ${e.key === 'unpaid' ? 'font-medium text-red-600' : 'text-slate-600'}`}>
                {e.label}
              </span>
              <span className={`shrink-0 font-bold tabular-nums ${e.key === 'unpaid' ? 'text-red-600' : 'text-slate-900'}`}>
                {formatMoney(e.total)}
              </span>
              <span className="w-24 shrink-0 text-right tabular-nums text-slate-500">
                {e.count} đơn · {segs[i].percent}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function DashTile({ item, value, note, tone = 'normal', onOpen }) {
  const Icon = item.icon;
  const valueColor = tone === 'alert' ? 'text-red-600' : tone === 'warn' ? 'text-amber-500' : tone === 'good' ? 'text-emerald-600' : 'text-slate-900';
  return (
    <button
      type="button"
      onClick={() => onOpen(item.id)}
      className="staff-press group flex min-h-[6.75rem] flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-card p-4 text-left shadow-sm"
    >
      <span className="flex items-center gap-2 text-sm font-medium text-slate-500">
        <Icon size={20} strokeWidth={2} className="shrink-0 text-slate-600" aria-hidden="true" />
        <span className="min-w-0 flex-1 leading-tight">{item.label}</span>
        <ChevronRight size={16} className="shrink-0 opacity-40 transition group-hover:translate-x-[3px] group-hover:opacity-100" aria-hidden="true" />
      </span>
      <span className="block">
        {value != null && <span className={`block text-lg font-bold leading-tight tracking-tight sm:text-xl ${valueColor}`}>{value}</span>}
        {note && <span className="mt-0.5 block text-xs text-slate-500">{note}</span>}
      </span>
    </button>
  );
}

function DashTiles({ orders, counts, customers, menu, settings, now, isOwner, weekRevenue, onNavigate }) {
  // Đơn sắp tới giờ cũng quét toàn bộ đơn: memo như trên, tránh quét lại mỗi lần vẽ
  const dueSoon = useMemo(() => upcomingOrders(orders, now, 60), [orders, now]);
  if (!onNavigate) return null;
  const pending = counts ?? { pendingAll: 0, pendingDelivery: 0, pendingPickup: 0, cookingCount: 0 };
  const overdue = dueSoon.filter((o) => dueInfo(o, now)?.level === 'overdue').length;
  const menuList = menu ?? [];
  const soldOut = menuList.filter((m) => m.available === false).length;
  const webOn = settings.webOrdering?.enabled !== false;

  const info = {
    orders: {
      value: `${pending.pendingAll} đơn chờ`,
      note: overdue ? `${overdue} đơn đã trễ giờ` : dueSoon.length ? `${dueSoon.length} đơn tới giờ trong 1 giờ` : `${pending.pendingPickup} đến lấy · ${pending.pendingDelivery} giao`,
      tone: overdue ? 'alert' : dueSoon.length ? 'warn' : 'normal',
    },
    cooking: { value: `${pending.cookingCount ?? 0} đơn chờ nấu`, note: 'Đã xác nhận, đang chờ bếp nấu' },
    delivery: { value: `${pending.pendingDelivery} đơn chờ giao`, note: 'Lộ trình và đơn ship' },
    activity: { value: null, note: 'Khách đang xem website' },
    customers: { value: `${(customers ?? []).length} khách`, note: 'Danh bạ khách hàng' },
    menu: {
      value: `${menuList.length} món`,
      note: soldOut ? `${soldOut} món đang hết` : 'Tất cả đang còn',
      tone: soldOut ? 'warn' : 'normal',
    },
    report: { value: formatMoney(weekRevenue), note: 'Doanh thu tuần này', tone: 'good' },
    inventory: { value: null, note: 'Kho, nhập hàng, chi phí' },
    settings: { value: webOn ? 'Web đang mở' : 'Web tạm tắt', note: 'Giờ nhận đơn, nhân viên, máy in', tone: webOn ? 'good' : 'warn' },
  };

  const items = NAV_ITEMS.filter((it) => it.id !== 'home' && (isOwner || !it.ownerOnly));
  return (
    <nav aria-label="Các mục chính" className="staff-stagger grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-6 xl:grid-cols-4">
      {items.map((it) => (
        <DashTile key={it.id} item={it} {...(info[it.id] ?? {})} onOpen={onNavigate} />
      ))}
    </nav>
  );
}

// Nhân viên không thấy doanh thu: chỉ số đơn và số phần từng món. Quản lý thấy tiền tuần này, không thấy tổng cộng dồn / lợi nhuận
export default function HomePage({ orders, now, settings, isOwner, isManager, onBackupNow, counts, customers, menu, onNavigate, onUpdateSettings }) {
  const stats = useMemo(() => summarize(orders, now, menu), [orders, now, menu]);
  // weekItems sắp theo DOANH THU (PR #84) nên món đầu không còn là món nhiều phần
  // nhất — thanh tỉ lệ phải chia cho số phần lớn nhất thật, kẻo dài quá 100% (A1, issue #89)
  const maxQty = Math.max(0, ...stats.weekItems.map((i) => i.qty));
  // Quản lý xem được tiền tuần này, không xem tổng cộng dồn và lợi nhuận
  const seeWeekMoney = isOwner || isManager;

  return (
    // Điện thoại / máy tính thường: một cột. Màn hình rộng (xl): hai cột, trái là tổng tiền, phải là món bán trong tuần.
    <div className="mx-auto max-w-2xl space-y-6 xl:grid xl:max-w-6xl xl:grid-cols-2 xl:items-start xl:gap-8 xl:space-y-0">
      {/* Hàng trên cùng (trải hết bề ngang): nhắc sao lưu, tên quán, các ô bảng điều khiển */}
      <div className="space-y-6 xl:col-span-2">
      <div className="staff-stagger space-y-6">
      {isOwner && needsBackup(orders, settings.lastBackupAt, now) && (
        <BackupReminder lastBackupAt={settings.lastBackupAt} onBackupNow={onBackupNow} />
      )}

      {/* Logo + tên quán (logo riêng tải ở Cài đặt app, không có thì dùng logo mặc định) */}
      <div className="flex items-center gap-4">
        <img
          src={settings.logo || '/logo-round.svg'}
          alt=""
          className="h-20 w-20 shrink-0 rounded-full object-cover sm:h-24 sm:w-24"
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-bold text-slate-900 sm:text-2xl">{settings.shopName || 'Quán của bạn'}</p>
          <p className="text-sm text-slate-500">
            <span className="capitalize">{formatDay(now)}</span>, {formatDate(now)}
          </p>
        </div>
      </div>
      </div>

      <DashTiles
        orders={orders}
        counts={counts}
        customers={customers}
        menu={menu}
        settings={settings}
        now={now}
        isOwner={isOwner}
        weekRevenue={stats.weekRevenue}
        onNavigate={onNavigate}
      />
      </div>

      <div className="staff-stagger space-y-6">
      {/* Chốt ca hôm nay đứng đầu cột (trên cả thẻ Tiền tuần này) — việc cuối ngày cần thấy trước tiên.
          Chỉ quản lý/chủ quán thấy, đúng điều kiện cũ của thẻ. */}
      {seeWeekMoney && <ShiftClose orders={orders} now={now} shopName={settings.shopName} />}

      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tổng tuần này</h2>
        <p className="mt-1 text-base text-slate-500">Từ thứ Hai {formatDate(stats.weekStart)}</p>
      </div>

      {seeWeekMoney ? (
        <>
          {/* Đã/Chưa thanh toán đã gộp vào chú thích của WeekMoneyDonut bên dưới
              (đủ số tiền + số đơn + %) — bỏ 2 ô riêng ở đây để khỏi trùng thông tin. */}
          {stats.olderUnpaid.count > 0 && (
            <p className="-mt-1 rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              {isOwner
                ? `+ ${formatMoney(stats.olderUnpaid.total)} chưa thu từ các tuần trước (${stats.olderUnpaid.count} đơn)`
                : `+ ${stats.olderUnpaid.count} đơn tuần trước chưa thu tiền`}
            </p>
          )}

          <WeekMoneyDonut stats={stats} />

          {isOwner && (
          <Card title="Tổng cộng dồn">
            <div className="flex items-end justify-between px-5 pb-5 pt-1">
              <p className="text-3xl font-bold tracking-tight text-slate-900">
                <CountUp value={stats.allTimeRevenue} format={formatMoney} />
              </p>
              <span className="text-sm text-slate-500">{stats.allTimeOrderCount} đơn từ trước tới nay</span>
            </div>
          </Card>
          )}
        </>
      ) : (
        <Card title="Đơn tuần này">
          <div className="flex items-end justify-between px-5 pb-5 pt-1">
            <p className="text-4xl font-bold tracking-tight text-slate-900">
              <CountUp value={stats.weekOrderCount} format={formatCount} /> đơn
            </p>
            {stats.weekUnpaid.count > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-600">
                {stats.weekUnpaid.count} đơn chưa thanh toán
              </span>
            )}
          </div>
        </Card>
      )}

      </div>

      {/* Cột phải: dự báo và món bán trong tuần (số liệu lợi nhuận tuần xem ở mục Báo cáo) */}
      <div className="staff-stagger space-y-6">
      <ForecastCard
        orders={orders}
        now={now}
        settings={settings}
        isOwner={isOwner}
        onUpdateSettings={onUpdateSettings}
      />
      <Card title="Món bán trong tuần">
        {stats.weekItems.length === 0 ? (
          <p className="px-5 py-6 text-center text-slate-400">Chưa có đơn nào trong tuần này</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {stats.weekItems.map((item) => (
              <li key={item.name} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-900">{item.name}</span>
                  {seeWeekMoney && <span className="shrink-0 font-semibold text-slate-900">{formatMoney(item.revenue)}</span>}
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                    <div
                      className="h-full rounded-full bg-slate-600"
                      style={{ width: `${(item.qty / maxQty) * 100}%` }}
                    />
                  </div>
                  <span className="w-14 shrink-0 text-right text-sm text-slate-500">{item.qty} phần</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      </div>
    </div>
  );
}
