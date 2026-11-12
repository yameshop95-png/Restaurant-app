import { Check, Mail, MessageSquare, Phone, Trash2 } from 'lucide-react';
import useCustomerActivity from '../hooks/useCustomerActivity';
import { smsLink } from '../lib/customerMessage';
import { formatMoney } from '../lib/stats';

const pct = (part, whole) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '—');

function ago(iso, now = Date.now()) {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (min < 60) return `${min} phút trước`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

function LiveCard({ label, value, hint, tone = '' }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-4xl font-extrabold tabular-nums ${tone || 'text-slate-900'}`}>{value ?? 0}</p>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
    </div>
  );
}

const PERIODS = [
  ['today', 'Hôm nay'],
  ['days7', '7 ngày'],
  ['days30', '30 ngày'],
];

function followUpMessage(a, shopName) {
  const shop = shopName?.trim() || 'Bánh Cuốn & Giò Chả';
  const name = a.name?.trim() || '';
  return a.lang === 'en'
    ? `${shop}: Hi ${name}, we saw you were putting an order together on our website. Can we help you finish it?`
    : `${shop}: Chào ${name}, quán thấy bạn đã chọn món trên website nhưng chưa đặt xong. Quán có thể giúp bạn hoàn tất đơn không ạ?`;
}

// Khách trên website: đang online, đang đặt, bỏ dở, tỉ lệ đặt món
export default function CustomerActivityPage({ settings }) {
  const { data, error, updatedAt, handleSession } = useCustomerActivity();
  const live = data?.live ?? {};
  const periods = data?.periods ?? {};
  const abandoned = data?.abandoned ?? [];
  const today = periods.today ?? {};
  const now = data?.now ? new Date(data.now).getTime() : Date.now();

  if (error?.missing && !data) {
    return (
      <div className="mx-auto max-w-2xl rounded-3xl border border-slate-200 bg-card p-6">
        <h2 className="text-lg font-bold text-slate-900">Chưa bật theo dõi khách</h2>
        <p className="mt-2 text-slate-600">
          Máy chủ chưa có phần theo dõi. Mở file <b>sql/customer_activity.sql</b> trong repo, dán vào SQL Editor của
          project quán và bấm Run một lần, rồi tải lại trang này.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <span className={`h-2.5 w-2.5 rounded-full ${error ? 'bg-red-500' : 'animate-pulse bg-emerald-500'}`} />
          {error
            ? `Chưa tải được: ${error.message}`
            : updatedAt
              ? `Cập nhật ${updatedAt.toLocaleTimeString('vi-VN')}, tự làm mới mỗi 10 giây`
              : 'Đang tải…'}
        </p>
      </div>

      <section aria-label="Khách đang trên website">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <LiveCard label="Đang online" value={live.online} hint="đang mở website" tone="text-emerald-600" />
          <LiveCard label="Đang xem menu" value={live.browsing} hint="chưa chọn món" />
          <LiveCard label="Đã chọn món" value={live.cart} hint="có món trong giỏ" />
          <LiveCard
            label="Đang đặt món"
            value={live.checkout}
            hint="ở trang đặt, chưa bấm Place order"
            tone="text-blue-500"
          />
          <LiveCard
            label="Bỏ dở hôm nay"
            value={today.abandoned}
            hint="chọn món nhưng không đặt"
            tone={today.abandoned > 0 ? 'text-red-500' : ''}
          />
        </div>
      </section>

      <section
        className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm"
        aria-label="Tỉ lệ đặt món"
      >
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-bold text-slate-900">Khách vào website và tỉ lệ đặt món</h2>
          <p className="text-sm text-slate-500">Mỗi lần mở website tính là một lượt vào.</p>
        </div>
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          {PERIODS.map(([key, label]) => {
            const p = periods[key] ?? {};
            const mini = [
              ['Lượt vào', p.visits],
              ['Chọn món', p.with_cart],
              ['Vào trang đặt', p.checkout],
              ['Đã đặt', p.ordered],
            ];
            return (
              <div key={key} className="bg-card p-5" data-period={key}>
                <p className="text-sm font-semibold text-slate-500">{label}</p>
                <p className="mt-1 text-4xl font-extrabold tabular-nums text-emerald-600">{pct(p.ordered, p.visits)}</p>
                <p className="text-xs text-slate-500">tỉ lệ đặt món</p>
                <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
                  {mini.map(([name, value]) => (
                    <div key={name}>
                      <dd className="text-lg font-bold tabular-nums text-slate-900">{value ?? 0}</dd>
                      <dt className="text-[11px] leading-tight text-slate-500">{name}</dt>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 flex justify-between gap-3 text-sm text-slate-700">
                  <span>
                    Vào không đặt <b className="tabular-nums">{pct((p.visits ?? 0) - (p.ordered ?? 0), p.visits)}</b>
                  </span>
                  <span>
                    Bỏ giỏ <b className="tabular-nums">{pct(p.abandoned, p.with_cart)}</b>
                  </span>
                </p>
              </div>
            );
          })}
        </div>
        <p className="border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
          <b>Tỉ lệ đặt</b> = đã đặt / lượt vào. <b>Vào không đặt</b> = lượt vào không đặt món. <b>Bỏ giỏ</b> = khách đã
          chọn món nhưng im lặng quá 10 phút mà không đặt, chia cho số khách đã chọn món. Khách chặn theo dõi có thể
          không được đếm. Đơn website hôm nay trong danh sách đơn: <b>{today.web_orders ?? 0}</b>.
        </p>
      </section>

      <section aria-label="Khách bỏ dở">
        <h2 className="mb-1 font-bold text-slate-900">Khách để lại thông tin nhưng chưa đặt</h2>
        <p className="mb-3 text-sm text-slate-500">
          Khách đã gõ số điện thoại hoặc email rồi bỏ đi. Gọi hoặc nhắn hỏi xem cần giúp gì. Quá 10 phút không hoạt động
          mới hiện ở đây.
        </p>
        {abandoned.length === 0 ? (
          <p className="rounded-3xl bg-card px-5 py-10 text-center text-slate-400">Chưa có khách nào bỏ dở</p>
        ) : (
          <ul className="space-y-3">
            {abandoned.map((a) => (
              <li key={a.sid} className="rounded-3xl border border-slate-200 bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{a.name || 'Khách chưa để tên'}</p>
                    <p className="text-xs text-slate-500">
                      {ago(a.last_seen, now)}
                      {a.lang === 'en' && ' · tiếng Anh'}
                    </p>
                  </div>
                  {a.cart_total > 0 && (
                    <p className="shrink-0 font-bold text-gold">{formatMoney(Number(a.cart_total))}</p>
                  )}
                </div>
                {a.items && <p className="mt-2 text-sm text-slate-700">{a.items}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {a.phone && (
                    <a
                      href={`tel:${a.phone}`}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-500 px-3 py-2 font-semibold text-white active:bg-blue-600"
                    >
                      <Phone size={15} /> {a.phone}
                    </a>
                  )}
                  {a.phone && (
                    <a
                      href={smsLink(a.phone, followUpMessage(a, settings?.shopName))}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 active:bg-slate-200"
                    >
                      <MessageSquare size={15} /> Nhắn
                    </a>
                  )}
                  {a.email && (
                    <a
                      href={`mailto:${a.email}`}
                      className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 font-semibold text-slate-700 active:bg-slate-200"
                    >
                      <Mail size={15} /> {a.email}
                    </a>
                  )}
                  <span className="ml-auto flex gap-2">
                    <button
                      onClick={() => handleSession(a.sid, 'handled')}
                      className="flex items-center gap-1 rounded-xl border border-slate-300 px-3 py-2 font-semibold text-slate-700 active:bg-slate-50"
                    >
                      <Check size={15} /> Đã xử lý
                    </button>
                    <button
                      onClick={() => window.confirm('Xoá thông tin khách này?') && handleSession(a.sid, 'delete')}
                      aria-label="Xoá thông tin khách"
                      className="rounded-xl bg-red-50 p-2 text-red-600 active:bg-red-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
