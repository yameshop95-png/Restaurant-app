import { X } from 'lucide-react';
import { formatMoney } from '../../lib/stats';

export const inputClass = (error) =>
  `w-full rounded-xl border bg-transparent px-4 py-3 text-base outline-none focus:ring-2 ${
    error ? 'border-red-400 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-blue-100'
  }`;

export const money = (n) => (n < 0 ? `-${formatMoney(-n)}` : formatMoney(n));
// Nhập số kiểu Việt hoặc Úc: "12,5" và "12.5" đều được
export const parseNum = (s) => Number(String(s ?? '').trim().replace(',', '.'));
export const qtyText = (n) => String(Math.round(n * 1000) / 1000);

export function Field({ label, hint, error, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-sm text-red-600">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
    </label>
  );
}

export function Sheet({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] sm:max-w-lg sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={22} />
          </button>
        </div>
        <div className="space-y-4 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex shrink-0 gap-2 border-t border-slate-200 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export const Card = ({ title, right, children, className = '' }) => (
  <section className={`overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm ${className}`}>
    {(title || right) && (
      <div className="flex items-center justify-between gap-2 px-5 pt-4">
        <h2 className="text-[15px] font-semibold text-slate-500">{title}</h2>
        {right}
      </div>
    )}
    {children}
  </section>
);

export const PrimaryButton = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`rounded-2xl bg-blue-500 py-3.5 font-semibold text-white active:bg-blue-600 disabled:opacity-50 ${className}`}
  >
    {children}
  </button>
);
