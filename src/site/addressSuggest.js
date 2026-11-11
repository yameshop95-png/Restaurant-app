// Gợi ý địa chỉ khi khách gõ (trang đặt món, giao hàng).
// Dùng Photon (komoot, dữ liệu OpenStreetMap): miễn phí, không cần key, cho phép gợi ý khi đang gõ.
// (Nominatim cấm dùng để gợi ý khi gõ, nên không dùng ở đây.) Dữ liệu OSM cần ghi "© OpenStreetMap".
// OSM ở Albury–Wodonga gần như không có số nhà, nên gợi ý tên đường + khu + postcode và giữ số nhà khách đã gõ.
import { matchZone } from '../lib/shippingZones';

const PHOTON = 'https://photon.komoot.io/api/';
// Khung tìm quanh Albury–Wodonga (kinh độ trái, vĩ độ dưới, kinh độ phải, vĩ độ trên)
const BBOX = '146.75,-36.20,147.10,-35.95';
const STATES = { Victoria: 'VIC', 'New South Wales': 'NSW' };

// "12/3 Smith St" → { number: '12/3', rest: 'Smith St' }
export function splitNumber(input) {
  const m = String(input ?? '').match(/^\s*((?:unit\s*)?\d+[a-z]?(?:\s*[/-]\s*\d+[a-z]?)?)\s+(.*)$/i);
  return m ? { number: m[1].replace(/\s+/g, ''), rest: m[2] } : { number: '', rest: String(input ?? '').trim() };
}

const cache = new Map();

// Trả về tối đa `limit` địa chỉ trong khu giao hàng: [{ label, zone }]
export async function suggestAddresses(input, zones, { signal, limit = 5 } = {}) {
  const { number, rest } = splitNumber(input);
  const q = rest.trim();
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  let features = cache.get(key);
  if (!features) {
    const url = `${PHOTON}?q=${encodeURIComponent(q)}&limit=15&lang=en&bbox=${BBOX}`;
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`photon ${res.status}`);
    features = (await res.json()).features ?? [];
    cache.set(key, features);
  }
  const seen = new Set();
  const out = [];
  for (const f of features) {
    const p = f.properties ?? {};
    const street = p.street || (p.type === 'street' ? p.name : null);
    const suburb = p.district || p.city || p.locality;
    if (!street || !suburb) continue;
    const state = STATES[p.state] ?? '';
    const tail = [suburb, state, p.postcode].filter(Boolean).join(' ');
    const num = number || p.housenumber || '';
    const label = `${num ? `${num} ` : ''}${street}, ${tail}`;
    const zone = matchZone(label, zones);
    if (!zone || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ label, zone });
    if (out.length >= limit) break;
  }
  return out;
}

// Tên khu (không phải postcode) của các vùng giao, để khách bấm thêm vào cuối địa chỉ
export function suburbChips(zones) {
  const out = [];
  for (const z of zones) {
    for (const p of z.places ?? []) {
      if (!/^\d+$/.test(String(p).trim())) out.push({ text: String(p), zone: z });
    }
  }
  return out;
}
