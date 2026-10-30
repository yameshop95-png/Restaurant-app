import { useMemo, useState } from 'react';
import { Archive, Loader2, Send } from 'lucide-react';
import { BACKUP_REMINDER_DAYS, daysSinceBackup } from '../lib/backup';
import { shareText } from '../lib/shareOrder';
import { dailyCollection, formatDate, formatDay, formatMoney, summarize } from '../lib/stats';

function Card({ title, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm backdrop-blur ${className}`}
    >
      {title && <h2 className="px-5 pt-4 text-[15px] text-slate-500">{title}</h2>}
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
    <section className="rounded-3xl border border-slate-200 bg-card px-5 py-4 text-slate-800">
      <p className="flex items-center gap-2 font-bold">
        <Archive size={18} className="shrink-0" />
        {days == null ? 'Chưa sao lưu dữ liệu lần nào' : `Đã ${days} ngày chưa sao lưu dữ liệu`}
      </p>
      <p className="mt-1 text-sm">
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

function ShiftClose({ orders, now, shopName }) {
  const day = dailyCollection(orders, now);
  const [msg, setMsg] = useState(null);
  const rows = SHIFT_ROWS.filter(([key]) => key !== 'unknown' || day.unknown.count);

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
      <ul className="mt-2 divide-y divide-slate-100 border-t border-slate-200">
        {rows.map(([key, label, hint]) => (
          <li key={key} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <span>
              <span className="font-semibold text-slate-900">{label}</span>
              {hint && <span className="block text-xs text-slate-400">{hint}</span>}
            </span>
            <span className="text-right">
              <span className="block font-bold text-slate-900">{formatMoney(day[key].total)}</span>
              <span className="text-xs text-slate-500">{day[key].count} đơn</span>
            </span>
          </li>
        ))}
        <li className="flex items-center justify-between px-5 py-2.5 font-bold">
          <span className="text-slate-700">Tổng đã thu</span>
          <span className="text-emerald-600">{formatMoney(day.total)}</span>
        </li>
        {day.unpaid.count > 0 && (
          <li className="flex items-center justify-between px-5 py-2.5 font-bold text-red-600">
            <span>Còn phải thu hôm nay</span>
            <span>
              {formatMoney(day.unpaid.total)} <span className="text-xs font-semibold">({day.unpaid.count} đơn)</span>
            </span>
          </li>
        )}
      </ul>
      <div className="px-5 pb-4">
        <button
          onClick={share}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 active:bg-slate-200"
        >
          <Send size={16} /> Gửi báo cáo chốt ca
        </button>
        {msg && <p className="mt-2 text-center text-sm font-semibold text-blue-700">{msg}</p>}
      </div>
    </Card>
  );
}

// Nhân viên không thấy doanh thu: chỉ số đơn và số phần từng món
export default function HomePage({ orders, now, settings, isOwner, onBackupNow }) {
  const stats = useMemo(() => summarize(orders, now), [orders, now]);
  const maxQty = stats.weekItems[0]?.qty ?? 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {isOwner && needsBackup(orders, settings.lastBackupAt, now) && (
        <BackupReminder lastBackupAt={settings.lastBackupAt} onBackupNow={onBackupNow} />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Tổng tuần này</h1>
          <p className="mt-1 text-sm text-slate-500">Từ thứ Hai {formatDate(stats.weekStart)}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold capitalize text-slate-800">{formatDay(now)}</p>
          <p className="text-slate-500">{formatDate(now)}</p>
        </div>
      </div>

      {isOwner ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card title="Đã thanh toán">
              <div className="px-5 pb-4 pt-1">
                <p className="text-2xl font-bold tracking-tight text-emerald-600">{formatMoney(stats.weekPaid.total)}</p>
                <p className="text-sm text-slate-500">{stats.weekPaid.count} đơn</p>
              </div>
            </Card>
            <section
              className={`rounded-3xl px-5 pb-4 pt-4 shadow-sm ${
                stats.weekUnpaid.count ? 'border border-red-500/60 bg-card text-red-600' : 'border border-slate-200 bg-card text-slate-500'
              }`}
            >
              <h2 className="text-[15px] text-slate-500">Chưa thanh toán</h2>
              <p className={`mt-1 text-2xl font-bold tracking-tight ${stats.weekUnpaid.count ? 'text-red-600' : 'text-slate-900'}`}>
                {formatMoney(stats.weekUnpaid.total)}
              </p>
              <p className="text-sm text-slate-500">{stats.weekUnpaid.count} đơn</p>
            </section>
          </div>
          {stats.olderUnpaid.count > 0 && (
            <p className="-mt-1 rounded-2xl bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">
              + {formatMoney(stats.olderUnpaid.total)} chưa thu từ các tuần trước ({stats.olderUnpaid.count} đơn)
            </p>
          )}

          <section className="rounded-3xl border border-gold/40 bg-card px-5 pb-5 pt-4 text-white">
            <h2 className="text-[15px] text-slate-500">Tiền tuần này</h2>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-4xl font-bold tracking-tight text-gold sm:text-5xl">{formatMoney(stats.weekRevenue)}</p>
              <span className="shrink-0 rounded-full bg-slate-100 px-4 py-1.5 font-semibold text-slate-800">
                {stats.weekOrderCount} đơn
              </span>
            </div>
          </section>

          <ShiftClose orders={orders} now={now} shopName={settings.shopName} />

          <Card title="Tổng cộng dồn">
            <div className="flex items-end justify-between px-5 pb-5 pt-1">
              <p className="text-3xl font-bold tracking-tight text-slate-900">{formatMoney(stats.allTimeRevenue)}</p>
              <span className="text-sm text-slate-500">{stats.allTimeOrderCount} đơn từ trước tới nay</span>
            </div>
          </Card>
        </>
      ) : (
        <Card title="Đơn tuần này">
          <div className="flex items-end justify-between px-5 pb-5 pt-1">
            <p className="text-4xl font-bold tracking-tight text-slate-900">{stats.weekOrderCount} đơn</p>
            {stats.weekUnpaid.count > 0 && (
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-semibold text-red-600">
                {stats.weekUnpaid.count} đơn chưa thanh toán
              </span>
            )}
          </div>
        </Card>
      )}

      <Card title="Món bán trong tuần">
        {stats.weekItems.length === 0 ? (
          <p className="px-5 py-6 text-center text-slate-400">Chưa có đơn nào trong tuần này</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200">
            {stats.weekItems.map((item) => (
              <li key={item.name} className="px-5 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-slate-900">{item.name}</span>
                  {isOwner && <span className="shrink-0 font-semibold text-slate-900">{formatMoney(item.revenue)}</span>}
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
  );
}
