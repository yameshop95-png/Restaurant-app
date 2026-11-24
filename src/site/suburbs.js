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
  leneva: ['VIC', '3690'],
  baranduda: ['VIC', '3691'],
  'hamilton valley': ['NSW', '2641'],
};

// Danh sách khu cho ô chọn: chỉ những khu có tên trong vùng giao của quán
// [{ key, label: 'West Wodonga VIC 3690', zone }]
export function suburbOptions(zones) {
  const out = [];
  const seen = new Set();
  for (const z of zones) {
    for (const place of z.places ?? []) {
      const rawName = String(place).trim();
      const rawKey = rawName.toLowerCase();
      if (!rawName || /^\d+$/.test(rawName)) continue;
      // matchLabel = nhan theo dung cach cu (ten goc + bang/postcode neu co san):
      // chuoi nay gui kem dia chi de may chu khop vung, PHAI giu nguyen 100%
      // vi cac mau nhu "2640 - Baranduda VIC 3691" khop theo cum chinh xac.
      const matchLabel = [rawName, ...(KNOWN[rawKey] ?? [])].filter(Boolean).join(' ');
      // Ten HIEN cho khach chon phai sach: ten trong Cai dat co the lan
      // postcode/bang ("3690 Leneva") vi do la mau khop dia chi, khong phai ten dep.
      const name = rawName
        .replace(/\b\d{4}\b/g, ' ')
        .replace(/\b(vic|nsw|act|qld|sa|wa|tas|nt)\b/gi, ' ')
        .replace(/[\u2013\u2014|/-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const label = [name, ...(KNOWN[key] ?? [])].filter(Boolean).join(' ');
      // Vung tinh tu matchLabel — dung chuoi may chu se nhan, nhu cach cu
      out.push({ key, rawKey, label, matchLabel, zone: matchZone(matchLabel, zones) ?? z });
    }
  }
  return out;
}

// Ghép 3 ô thành địa chỉ gửi máy chủ: "12 Kiewa St, South Albury NSW 2640"
export function joinAddress({ houseNo, street, suburb }, options) {
  const opt = options.find((o) => o.key === suburb || o.rawKey === suburb);
  const sub = opt?.matchLabel ?? opt?.label ?? '';
  const line = [houseNo.trim(), street.trim()].filter(Boolean).join(' ');
  return [line, sub].filter(Boolean).join(', ');
}
