import { startOfWeek } from '../lib/stats';

// Dữ liệu giả để xem giao diện. Thay bằng dữ liệu từ API/backend khi tích hợp.
const MENU = {
  pho: { name: 'Phở bò', price: 15 },
  bunCha: { name: 'Bún chả', price: 14 },
  comTam: { name: 'Cơm tấm', price: 13 },
  banhMi: { name: 'Bánh mì', price: 9 },
  goiCuon: { name: 'Gỏi cuốn', price: 8 },
  traDa: { name: 'Trà đá', price: 3 },
};

const line = (key, qty) => ({ ...MENU[key], qty });

// `at`: vị trí trong khoảng từ đầu tuần tới hiện tại (0..1). `daysAgo`: đơn của tuần trước trở về trước.
const SEED = [
  { daysAgo: 40, items: [line('comTam', 1)] },
  { daysAgo: 12, items: [line('pho', 2), line('traDa', 2)] },
  { daysAgo: 9, items: [line('bunCha', 1), line('goiCuon', 2)] },
  { at: 0.1, items: [line('pho', 1), line('traDa', 1)] },
  { at: 0.25, items: [line('comTam', 2)] },
  { at: 0.4, items: [line('banhMi', 3), line('traDa', 3)] },
  { at: 0.55, items: [line('pho', 2), line('goiCuon', 1)] },
  { at: 0.7, items: [line('bunCha', 2), line('traDa', 2)] },
  { at: 0.9, items: [line('pho', 1), line('comTam', 1)] },
];

export function createMockOrders(now = new Date()) {
  const weekStart = startOfWeek(now).getTime();
  const span = now.getTime() - weekStart;
  return SEED.map((seed, i) => ({
    id: `DH${String(i + 1).padStart(3, '0')}`,
    createdAt: new Date(
      seed.daysAgo != null ? weekStart - seed.daysAgo * 86400000 : weekStart + seed.at * span
    ).toISOString(),
    items: seed.items,
  }));
}
