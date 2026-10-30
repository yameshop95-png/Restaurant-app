// Vị trí GPS + đổi địa chỉ thành toạ độ (OpenStreetMap Nominatim, miễn phí, không cần key).
// Quy định của Nominatim: tối đa 1 yêu cầu / giây và phải lưu lại kết quả, nên mỗi địa chỉ chỉ tìm một lần.
import { normalizeText } from '../hooks/useCustomers';

const CACHE_KEY = 'restaurant-app.geocache';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const COUNTRY = 'au'; // quán ở Úc: chỉ tìm địa chỉ trong nước Úc cho chính xác
const RETRY_NOT_FOUND_MS = 7 * 86400000; // địa chỉ không tìm thấy: thử lại sau 7 ngày

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? {};
  } catch {
    return {};
  }
}
function saveCache(cache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // bộ nhớ đầy: lần sau tìm lại
  }
}

const cacheKey = (address) => normalizeText(address).replace(/\s+/g, ' ');

// Kết quả đã lưu: { lat, lng, zone } | { notFound: true } | undefined (chưa tìm)
export function cachedGeocode(address) {
  const hit = loadCache()[cacheKey(address)];
  if (hit?.notFound && Date.now() - hit.at > RETRY_NOT_FOUND_MS) return undefined;
  return hit;
}

// Vùng = suburb + postcode, VD "Haymarket 2000"
function zoneOf(a = {}) {
  const area = a.suburb || a.city_district || a.town || a.village || a.city || a.county || '';
  return [area, a.postcode].filter(Boolean).join(' ') || null;
}

let lastRequestAt = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function geocode(address) {
  const cached = cachedGeocode(address);
  if (cached) return cached.notFound ? null : cached;

  const wait = lastRequestAt + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();

  const url = `${NOMINATIM}?format=jsonv2&addressdetails=1&limit=1&countrycodes=${COUNTRY}&q=${encodeURIComponent(address)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Không tra được bản đồ (lỗi ${res.status}), thử lại sau`);
  const [hit] = await res.json();

  const result = hit ? { lat: Number(hit.lat), lng: Number(hit.lon), zone: zoneOf(hit.address) } : null;
  const cache = loadCache();
  cache[cacheKey(address)] = result ?? { notFound: true, at: Date.now() };
  saveCache(cache);
  return result;
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Máy không hỗ trợ GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) =>
        reject(
          new Error(err.code === 1 ? 'Chưa cho phép app dùng vị trí' : 'Không lấy được vị trí GPS, thử lại ngoài trời')
        ),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  });
}

// Khoảng cách đường chim bay (km)
export function distanceKm(a, b) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Mở Google Maps chỉ đường qua các điểm theo thứ tự (Google cho tối đa 9 điểm dừng giữa đường)
export function directionsUrl(start, points) {
  const fmt = (p) => `${p.lat},${p.lng}`;
  const stops = points.slice(0, 10);
  const params = new URLSearchParams({ api: '1', travelmode: 'driving', destination: fmt(stops[stops.length - 1]) });
  if (start) params.set('origin', fmt(start));
  if (stops.length > 1) params.set('waypoints', stops.slice(0, -1).map(fmt).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}
