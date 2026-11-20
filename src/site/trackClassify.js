// Phân loại nguồn truy cập + thiết bị cho bộ theo dõi khách website (tracker.js).
// Hàm thuần, không đụng DOM — tracker truyền dữ liệu thô vào; test chạy thẳng bằng Node
// (tests/track-classify). Mọi giá trị lạ đều rơi về 'other' / 'desktop' chứ không văng lỗi.

// Ánh xạ utm_source thường gặp → nhóm nguồn. So khớp lỏng (chứa chuỗi) để chịu được
// các biến thể như 'fb', 'facebook.com', 'ig_ads', 'GoogleAds'…
const UTM_RULES = [
  ['facebook', /facebook|meta|^fb([._-]|$)|fb_/],
  ['instagram', /instagram|^ig([._-]|$)|ig_/],
  ['google', /google|adwords|gads/],
  ['zalo', /zalo/],
];

// Host của referrer → nhóm nguồn. l.facebook.com / lm.facebook.com là host bọc link
// ra ngoài của Facebook; chat.zalo.me là nơi khách bấm link trong Zalo.
const HOST_RULES = [
  // "google" phải là nhãn tên miền chính ngay trước TLD (google.com, google.com.au,
  // google.co.uk…) — tránh nhận nhầm app như com.google.android.gm thành Google.
  ['google', /(^|\.)google\.(com\.[a-z]{2}|co\.[a-z]{2}|com|[a-z]{2})$/],
  ['facebook', /(^|\.)facebook\.com$|(^|\.)fb\.com$/],
  ['instagram', /(^|\.)instagram\.com$/],
  ['zalo', /(^|\.)zalo\.me$|(^|\.)zalo\.app$/],
];

function hostOf(referrer) {
  try {
    return new URL(referrer).hostname.toLowerCase();
  } catch {
    return '';
  }
}

// Nguồn của một phiên: ưu tiên utm_source của URL đáp (quảng cáo gắn thẻ thì tin thẻ),
// không có mới nhìn referrer; trống cả hai = khách gõ thẳng địa chỉ / mở bookmark.
export function classifySource({ referrer = '', utmSource = '' } = {}) {
  const utm = String(utmSource ?? '').trim().toLowerCase();
  if (utm) {
    for (const [group, re] of UTM_RULES) if (re.test(utm)) return group;
    return 'other';
  }
  const ref = String(referrer ?? '').trim();
  if (!ref) return 'direct';
  const host = hostOf(ref);
  if (host) {
    for (const [group, re] of HOST_RULES) if (re.test(host)) return group;
  }
  return 'other';
}

// Thiết bị theo userAgent: iPad / máy tính bảng Android (không có chữ Mobile) = tablet;
// điện thoại = mobile; còn lại = desktop. iPad đời mới giả dạng Mac thì không tách
// được bằng UA — chấp nhận tính là desktop.
export function classifyDevice(userAgent = '') {
  const ua = String(userAgent ?? '');
  if (/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) return 'tablet';
  if (/Mobi|iPhone|iPod|Windows Phone|BlackBerry/i.test(ua)) return 'mobile';
  return 'desktop';
}
