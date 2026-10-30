import { useEffect, useRef, useState } from 'react';
import useCloudList from './useCloudList';
import { supabase } from '../lib/supabase';

// Thông tin quán (tên, SĐT, địa chỉ, logo) lưu trên máy chủ, mọi máy dùng chung; chỉ chủ quán sửa được.
// Tuỳ chọn riêng từng máy (âm báo, ứng dụng bản đồ, lần sao lưu gần nhất) lưu trong localStorage của máy đó.
const STORAGE_KEY = 'restaurant-app.settings';

export const SHOP_KEYS = ['shopName', 'shopPhone', 'shopAddress', 'logo'];

const SHOP_DEFAULTS = {
  shopName: '',
  shopPhone: '',
  shopAddress: '', // điểm xuất phát lộ trình giao khi không lấy được GPS
  logo: null, // ảnh dạng data URL, đã thu nhỏ
};

const DEVICE_DEFAULTS = {
  dueSound: true, // kêu + rung khi đơn sắp tới giờ giao / trễ giờ
  lastBackupAt: null,
  // Ứng dụng bản đồ khi bấm địa chỉ / mở lộ trình: iPhone, iPad mặc định Apple Maps, máy khác Google Maps
  mapsApp:
    /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent))
      ? 'apple'
      : 'google',
};

// Đọc cài đặt cũ trên máy (bản trước lưu cả thông tin quán ở đây)
export function loadLocalSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

const fromRow = (row) => ({ ...row.data, id: row.id });
const write = ({ changed }) =>
  changed.map(([, next]) => {
    const data = Object.fromEntries(SHOP_KEYS.map((k) => [k, next[k] ?? SHOP_DEFAULTS[k]]));
    return {
      rowId: next.id,
      run: () => supabase.from('shop_settings').update({ data }).eq('id', next.id),
      onDone: () => {},
    };
  });

export default function useSettings() {
  const [device, setDevice] = useState(() => {
    const saved = loadLocalSettings();
    return Object.fromEntries(Object.keys(DEVICE_DEFAULTS).map((k) => [k, saved[k] ?? DEVICE_DEFAULTS[k]]));
  });
  const { list, setList } = useCloudList('shop_settings', { fromRow, write });
  const [draft, setDraft] = useState(null); // thông tin quán đang gõ, gửi lên sau khi ngừng gõ
  const timer = useRef(null);

  const shop = {
    ...SHOP_DEFAULTS,
    ...Object.fromEntries(SHOP_KEYS.filter((k) => list[0]?.[k] != null).map((k) => [k, list[0][k]])),
    ...draft,
  };
  const settings = { ...shop, ...device };

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadLocalSettings(), ...device }));
    } catch {
      // Không lưu được (bộ nhớ đầy, chế độ ẩn danh...): vẫn dùng được trong phiên hiện tại.
    }
  }, [device]);

  useEffect(() => {
    document.title = settings.shopName ? `${settings.shopName} – Nhận order` : 'Nhận order';
    // Tên dưới icon khi iPhone "Thêm vào MH chính"
    document
      .querySelector('meta[name="apple-mobile-web-app-title"]')
      ?.setAttribute('content', settings.shopName || 'Nhận order');
  }, [settings.shopName]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const updateSettings = (patch) => {
    const devicePatch = Object.fromEntries(Object.entries(patch).filter(([k]) => !SHOP_KEYS.includes(k)));
    const shopPatch = Object.fromEntries(Object.entries(patch).filter(([k]) => SHOP_KEYS.includes(k)));
    if (Object.keys(devicePatch).length) setDevice((d) => ({ ...d, ...devicePatch }));
    if (!Object.keys(shopPatch).length) return;
    const nextDraft = { ...draft, ...shopPatch };
    setDraft(nextDraft);
    // Gõ tên / SĐT / địa chỉ: chờ ngừng gõ 0,6 giây rồi mới lưu, tránh gửi từng chữ
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setList((rows) => (rows[0] ? [{ ...rows[0], ...nextDraft }, ...rows.slice(1)] : rows));
      setDraft(null);
    }, 600);
  };

  return { settings, updateSettings };
}
