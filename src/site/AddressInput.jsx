import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { formatMoney } from '../lib/stats';
import { suggestAddresses, suburbChips } from './addressSuggest';

// Ô địa chỉ giao hàng có gợi ý: gõ tên đường → chọn địa chỉ có sẵn khu + postcode.
// Gợi ý chỉ là tiện ích: mất mạng / dịch vụ bản đồ lỗi thì khách vẫn gõ tay như cũ.
const DEBOUNCE_MS = 350;

export default function AddressInput({ value, onChange, zones, zone, t, className, placeholder }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false); // chỉ gợi ý khi khách đang gõ, không gợi ý cho địa chỉ lưu từ lần trước

  useEffect(() => {
    if (!typed.current || value.trim().length < 4) {
      setItems([]);
      return undefined;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      suggestAddresses(value, zones, { signal: ctrl.signal })
        .then((list) => {
          setItems(list);
          setActive(-1);
        })
        .catch(() => setItems([]));
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [value, zones]);

  const pick = (label) => {
    typed.current = false;
    onChange(label);
    setItems([]);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      pick(items[active].label);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const showList = open && items.length > 0;
  // Có tên đường nhưng chưa có khu: cho bấm nhanh tên khu để thêm vào cuối
  const chips = !zone && value.trim().length >= 4 && !showList ? suburbChips(zones) : [];

  return (
    <div className="relative">
      <textarea
        id="order-address"
        rows={2}
        autoComplete="street-address"
        role="combobox"
        aria-expanded={showList}
        aria-controls="order-address-list"
        aria-autocomplete="list"
        value={value}
        onChange={(e) => {
          typed.current = true;
          setOpen(true);
          onChange(e.target.value);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={className}
      />
      {showList && (
        <ul
          id="order-address-list"
          role="listbox"
          aria-label={t.addressSuggestions}
          className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {items.map((it, i) => (
            <li
              key={it.label}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(it.label)}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2.5 text-[15px] ${
                i === active ? 'bg-slate-100' : 'active:bg-slate-100'
              }`}
            >
              <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0 flex-1 text-slate-800">{it.label}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {t.shipping} {formatMoney(Number(it.zone.fee) || 0)}
              </span>
            </li>
          ))}
          <li className="px-3 py-1 text-right text-[10px] text-slate-400">© OpenStreetMap</li>
        </ul>
      )}
      {chips.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{t.addSuburb}</span>
          {chips.map((c) => (
            <button
              key={c.text}
              type="button"
              onClick={() => pick(`${value.trim().replace(/,\s*$/, '')}, ${c.text}`)}
              className="rounded-full border border-slate-300 px-2.5 py-1 text-xs text-slate-700 active:bg-slate-100"
            >
              {c.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
