import { useState } from 'react';
import { Plus, Trash2, Truck } from 'lucide-react';
import { DEFAULT_ZONES, matchZone } from '../lib/shippingZones';
import { formatMoney } from '../lib/stats';

const inputClass =
  'w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

// Gõ tự do; lưu danh sách đã tách theo dấu phẩy
function PlacesInput({ places, onChange }) {
  const [text, setText] = useState(() => places.join(', '));
  return (
    <input
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value.split(',').map((p) => p.trim()).filter(Boolean));
      }}
      className={inputClass}
    />
  );
}

// Chủ quán đặt phí ship cho từng vùng; đơn giao hàng tự điền phí khi địa chỉ có tên khu / postcode của vùng
export default function ShippingZonesSettings({ settings, onUpdateSettings }) {
  const zones = settings.shippingZones ?? DEFAULT_ZONES;
  const [test, setTest] = useState('');
  const save = (next) => onUpdateSettings({ shippingZones: next });
  const update = (id, patch) => save(zones.map((z) => (z.id === id ? { ...z, ...patch } : z)));
  const found = test.trim() ? matchZone(test, zones) : undefined;

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Truck size={22} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Phí ship theo vùng</h2>
          <p className="text-sm text-slate-500">Tự cộng vào đơn giao hàng khi địa chỉ có tên khu hoặc postcode của vùng</p>
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {zones.map((z) => (
          <div key={z.id} className="space-y-2 rounded-2xl bg-slate-50 p-3">
            <div className="flex gap-2">
              <label className="min-w-0 flex-1">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Tên vùng</span>
                <input value={z.name} onChange={(e) => update(z.id, { name: e.target.value })} className={inputClass} />
              </label>
              <label className="w-24 shrink-0">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Phí (A$)</span>
                <input
                  inputMode="decimal"
                  value={z.fee}
                  onChange={(e) => {
                    const v = e.target.value.replace(',', '.');
                    update(z.id, { fee: v === '' ? 0 : Number.isFinite(Number(v)) ? Number(v) : z.fee });
                  }}
                  className={inputClass}
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-500">Tên khu, postcode (cách nhau bằng dấu phẩy)</span>
              <PlacesInput places={z.places} onChange={(places) => update(z.id, { places })} />
            </label>
            <button
              onClick={() => save(zones.filter((x) => x.id !== z.id))}
              className="flex items-center gap-1 text-sm font-semibold text-red-600"
            >
              <Trash2 size={14} /> Xoá vùng
            </button>
          </div>
        ))}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => save([...zones, { id: `zone-${Date.now()}`, name: 'Vùng mới', fee: 0, places: [] }])}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 active:bg-slate-100"
          >
            <Plus size={16} /> Thêm vùng
          </button>
          {settings.shippingZones && (
            <button
              onClick={() => save(null)}
              className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 active:bg-slate-100"
            >
              Về mặc định
            </button>
          )}
        </div>

        <label className="block border-t border-slate-100 pt-3">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Thử một địa chỉ</span>
          <input
            value={test}
            onChange={(e) => setTest(e.target.value)}
            placeholder="VD: 12 Smith St, Thurgoona NSW 2640"
            className={inputClass}
          />
          {found !== undefined && (
            <span className={`mt-1 block text-sm font-semibold ${found ? 'text-slate-900' : 'text-red-600'}`}>
              {found ? `${found.name}: ${formatMoney(found.fee)}` : 'Không thuộc vùng nào, phải nhập phí tay'}
            </span>
          )}
        </label>
      </div>
    </section>
  );
}
