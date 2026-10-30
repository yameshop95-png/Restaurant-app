import { useState } from 'react';
import { Copy, MessageSquare, X } from 'lucide-react';
import { customerMessage, defaultKind, defaultLang, MESSAGE_KINDS, smsLink } from '../lib/customerMessage';

const LANGS = [
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'en', label: 'English' },
];

// Soạn tin cho khách rồi mở app Tin nhắn của điện thoại (nhân viên bấm Gửi). Không tốn phí, gửi từ số của quán.
export default function MessageCustomerSheet({ order, shopName, onClose }) {
  const [kind, setKind] = useState(() => defaultKind(order));
  const [lang, setLang] = useState(() => defaultLang(order));
  const [edited, setEdited] = useState(null);
  const [copied, setCopied] = useState(false);
  const text = edited ?? customerMessage(order, kind, lang, shopName);
  const phone = order.customer?.phone ?? '';

  const choose = (setter) => (value) => {
    setter(value);
    setEdited(null);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  const tabs = (list, value, onChange) => (
    <div className="grid grid-cols-2 gap-2">
      {list.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${
            value === o.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="w-full rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Nhắn khách · #{order.number}</h2>
            <p className="text-sm text-slate-500">
              {order.customer?.name} · {phone}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {tabs(MESSAGE_KINDS, kind, choose(setKind))}
          {tabs(LANGS, lang, choose(setLang))}
          {order.source === 'web' && (
            <p className="text-xs text-slate-500">
              Khách đặt trên website bằng {order.lang === 'en' ? 'tiếng Anh' : order.lang === 'vi' ? 'tiếng Việt' : '—'}
            </p>
          )}
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Nội dung (sửa được)</span>
            <textarea
              value={text}
              onChange={(e) => setEdited(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-[15px] leading-relaxed outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <p className="text-xs text-slate-500">
            Bấm "Mở Tin nhắn" trên điện thoại có SIM của quán, kiểm tra rồi bấm Gửi. Trên máy tính thì bấm "Copy".
          </p>
        </div>

        <div className="flex gap-2 border-t border-slate-200 px-5 py-4">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 rounded-2xl border-2 border-slate-300 px-4 py-3.5 font-semibold text-slate-700 active:bg-slate-50"
          >
            <Copy size={18} /> {copied ? 'Đã copy' : 'Copy'}
          </button>
          <a
            href={smsLink(phone, text)}
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3.5 font-semibold text-white active:bg-blue-600"
          >
            <MessageSquare size={18} /> Mở Tin nhắn
          </a>
        </div>
      </div>
    </div>
  );
}
