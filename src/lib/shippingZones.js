// Phí ship theo vùng, tự điền vào đơn giao hàng khi địa chỉ có tên khu (suburb) hoặc postcode của vùng.
// Chủ quán sửa được giá và danh sách khu ở Cài đặt app → Phí ship theo vùng.
import { normalizeText } from '../hooks/useCustomers';

export const DEFAULT_ZONES = [
  { id: 'wodonga', name: 'Wodonga – West Wodonga', fee: 2, places: ['Wodonga', 'West Wodonga', '3690'] },
  { id: 'albury', name: 'Albury', fee: 5, places: ['Albury', 'South Albury', 'East Albury', 'North Albury', '2640'] },
  { id: 'lavington', name: 'Lavington – Thurgoona', fee: 7, places: ['Lavington', 'Thurgoona', '2641'] },
];

// Chữ chỉ loại đường: "Wodonga Pl", "Albury St" là tên đường, không phải tên khu
const STREET = /^(st|street|rd|road|pl|place|ave|avenue|dr|drive|cres|crescent|ct|court|way|ln|lane|hwy|highway|pde|parade|cct|circuit|cl|close|tce|terrace|blvd|gr|grove)\b/;

// Tìm vùng của địa chỉ. Tên khu dài hơn thắng ("Thurgoona, Albury" là Thurgoona; "West Wodonga" thắng "Wodonga");
// không có tên khu nào thì mới xét postcode (Thurgoona và Albury chung postcode 2640).
export function matchZone(address, zones = DEFAULT_ZONES) {
  const text = ` ${normalizeText(address ?? '').replace(/[^a-z0-9]+/g, ' ')} `;
  if (!text.trim()) return null;
  let best = null;
  for (const zone of zones) {
    for (const place of zone.places ?? []) {
      const key = normalizeText(place).replace(/[^a-z0-9]+/g, ' ').trim();
      if (!key) continue;
      // Mọi chỗ xuất hiện của tên khu, bỏ những chỗ là tên đường
      let at = text.indexOf(` ${key} `);
      while (at >= 0 && STREET.test(text.slice(at + key.length + 2))) at = text.indexOf(` ${key} `, at + 1);
      if (at < 0) continue;
      const isPostcode = /^\d+$/.test(key);
      const score = isPostcode ? key.length / 100 : key.length;
      if (!best || score > best.score) best = { zone, score };
    }
  }
  return best?.zone ?? null;
}
