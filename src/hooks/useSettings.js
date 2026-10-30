import { useEffect, useState } from 'react';

// Thông tin quán và tuỳ chọn app, lưu trong localStorage.
const STORAGE_KEY = 'restaurant-app.settings';

const DEFAULTS = {
  shopName: '',
  shopPhone: '',
  shopAddress: '', // điểm xuất phát lộ trình giao khi không lấy được GPS
  logo: null, // ảnh dạng data URL, đã thu nhỏ
  dueSound: true, // kêu + rung khi đơn sắp tới giờ giao / trễ giờ
  lastBackupAt: null,
  // Ứng dụng bản đồ khi bấm địa chỉ / mở lộ trình: iPhone, iPad mặc định Apple Maps, máy khác Google Maps
  mapsApp: /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent)) ? 'apple' : 'google',
};

function load() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return DEFAULTS;
  }
}

export default function useSettings() {
  const [settings, setSettings] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Không lưu được (bộ nhớ đầy, chế độ ẩn danh...): vẫn dùng được trong phiên hiện tại.
    }
  }, [settings]);

  useEffect(() => {
    document.title = settings.shopName ? `${settings.shopName} – Nhận order` : 'Nhận order';
    // Tên dưới icon khi iPhone "Thêm vào MH chính"
    document.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', settings.shopName || 'Nhận order');
  }, [settings.shopName]);

  const updateSettings = (patch) => setSettings((s) => ({ ...s, ...patch }));
  return { settings, updateSettings };
}
