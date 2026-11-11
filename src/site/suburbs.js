import { matchZone } from '../lib/shippingZones';

// Bang + postcode của các khu quanh Albury–Wodonga, để khách chọn khu thay vì tự gõ.
// Khu chủ quán thêm ở Cài đặt app → Phí ship theo vùng mà chưa có ở đây vẫn hiện, chỉ không kèm bang / postcode.
const KNOWN = {
  wodonga: ['VIC', '3690'],
  'west wodonga': ['VIC', '3690'],
  albury: ['NSW', '2640'],
  'south albury': ['NSW', '2640'],
  'east albury': ['NSW', '2640'],
  'north albury': ['NSW', '2640'],
  'west albury': ['NSW', '2640'],
  glenroy: ['NSW', '2640'],
  thurgoona: ['NSW', '2640'],
  lavington: ['NSW', '2641'],
  'springdale heights': ['NSW', '2641'],
  'hamilton valley': ['NSW', '2641'],
};

// Danh sách khu cho ô chọn: chỉ những khu có tên trong vùng giao của quán
// [{ key, label: 'West Wodonga VIC 3690', zone }]
export function suburbOptions(zones) {
  const out = [];
  const seen = new Set();
  for (const z of zones) {
    for (const place of z.places ?? []) {
      const name = String(place).trim();
      const key = name.toLowerCase();
      if (!name || /^\d+$/.test(name) || seen.has(key)) continue;
      seen.add(key);
      const [state, postcode] = KNOWN[key] ?? [];
      const label = [name, state, postcode].filter(Boolean).join(' ');
      // Vùng tính đúng như máy chủ sẽ tính cho chuỗi địa chỉ này
      out.push({ key, label, zone: matchZone(label, zones) ?? z });
    }
  }
  return out;
}

// Ghép 3 ô thành địa chỉ gửi máy chủ: "12 Kiewa St, South Albury NSW 2640"
export function joinAddress({ houseNo, street, suburb }, options) {
  const sub = options.find((o) => o.key === suburb)?.label ?? '';
  const line = [houseNo.trim(), street.trim()].filter(Boolean).join(' ');
  return [line, sub].filter(Boolean).join(', ');
}
