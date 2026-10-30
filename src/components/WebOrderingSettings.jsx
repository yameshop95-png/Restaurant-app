import { useState } from 'react';
import { Copy, ExternalLink, Globe } from 'lucide-react';

const LEAD_OPTIONS = [15, 30, 45, 60, 90, 120, 180];

// Chủ quán bật / tắt website đặt món và chọn khách phải đặt trước bao lâu
export default function WebOrderingSettings({ settings, onUpdateSettings }) {
  const web = { enabled: true, leadMinutes: 30, ...settings.webOrdering };
  const link = `${window.location.origin}/order`;
  const [copied, setCopied] = useState(null);
  const save = (patch) => onUpdateSettings({ webOrdering: { ...web, ...patch } });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied('Đã copy link, dán vào Facebook / Google / tin nhắn cho khách');
    } catch {
      setCopied('Không copy được, giữ ngón tay lên link để copy');
    }
    setTimeout(() => setCopied(null), 4000);
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Globe size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-slate-900">Website đặt món</h2>
          <p className="text-sm text-slate-500">Khách đặt trước, trả tiền khi nhận. Đơn hiện ngay trong app với nhãn Online.</p>
        </div>
        <button
          role="switch"
          aria-checked={web.enabled}
          aria-label="Nhận đơn online"
          onClick={() => save({ enabled: !web.enabled })}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${web.enabled ? 'bg-blue-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${web.enabled ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      <div className="space-y-4 px-5 py-4">
        <p className={`text-sm font-semibold ${web.enabled ? 'text-emerald-600' : 'text-red-600'}`}>
          {web.enabled ? 'Đang nhận đơn online' : 'Đang tạm ngưng: khách vào website sẽ thấy lời nhắn gọi quán'}
        </p>
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Khách phải đặt trước ít nhất</span>
          <div className="flex flex-wrap gap-2">
            {LEAD_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => save({ leadMinutes: m })}
                aria-pressed={web.leadMinutes === m}
                className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                  web.leadMinutes === m ? 'border-blue-500 bg-blue-50 text-white' : 'border-slate-300 text-slate-700'
                }`}
              >
                {m < 60 ? `${m} phút` : `${m / 60} giờ`}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block text-sm font-semibold text-slate-700">Link gửi cho khách</span>
          <p className="select-all break-all rounded-xl bg-slate-50 px-3 py-2.5 font-mono text-sm text-slate-900">{link}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={copy}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 active:bg-slate-100"
            >
              <Copy size={16} /> Copy link
            </button>
            <a
              href="/order"
              target="_blank"
              rel="noreferrer"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 py-2.5 text-sm font-semibold text-slate-800 active:bg-slate-100"
            >
              <ExternalLink size={16} /> Mở website
            </a>
          </div>
          {copied && <p className="mt-2 text-sm font-semibold text-slate-800">{copied}</p>}
        </div>
        <p className="text-xs text-slate-500">
          Website dùng thực đơn (món Hết sẽ không đặt được), tên, SĐT, địa chỉ, logo và phí ship theo vùng ở trên. Giá và phí ship do máy chủ tính, khách không sửa được.
        </p>
      </div>
    </section>
  );
}
