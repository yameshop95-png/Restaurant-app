// Phiếu làm hàng: gom các đơn theo ngày lấy / giao để bếp biết hôm đó phải làm bao nhiêu mỗi món.
// "Cần làm" chỉ tính đơn Chờ xử lý; đơn đã Hoàn thành vẫn hiện trong danh sách đơn để đối chiếu.

const pad = (n) => String(n).padStart(2, '0');
export const dayKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

const whenOf = (o) => new Date(o.deliverAt ?? o.createdAt);
const ACTIVE = new Set(['pending', 'done']);

export function dayLabel(key, now = new Date()) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  const rel = diff === 0 ? 'Hôm nay' : diff === 1 ? 'Ngày mai' : WEEKDAYS[date.getDay()];
  return `${rel} ${pad(d)}/${pad(m)}`;
}

// Các ngày từ hôm nay trở đi có đơn chưa giao / chưa lấy, kèm số đơn còn chờ
export function prepDays(orders, now = new Date()) {
  const today = dayKeyOf(now);
  const days = new Map();
  for (const o of orders) {
    if (!ACTIVE.has(o.status)) continue;
    const key = dayKeyOf(whenOf(o));
    if (key < today && o.status !== 'pending') continue;
    // Đơn chờ của ngày đã qua (bị trễ) gộp vào hôm nay để không bị sót
    const k = key < today ? today : key;
    const d = days.get(k) ?? { key: k, pending: 0, done: 0 };
    d[o.status === 'pending' ? 'pending' : 'done'] += 1;
    days.set(k, d);
  }
  return [...days.values()].sort((a, b) => a.key.localeCompare(b.key)).map((d) => ({ ...d, label: dayLabel(d.key, now) }));
}

// Phiếu của một ngày: tổng phần mỗi món phải làm (đơn chờ), ghi chú món, danh sách đơn theo giờ
export function prepSheet(orders, key, now = new Date()) {
  const today = dayKeyOf(now);
  const list = orders
    .filter((o) => {
      if (!ACTIVE.has(o.status)) return false;
      const k = dayKeyOf(whenOf(o));
      return k === key || (key === today && k < today && o.status === 'pending');
    })
    .sort((a, b) => whenOf(a) - whenOf(b));
  const items = new Map();
  for (const o of list) {
    if (o.status !== 'pending') continue;
    for (const it of o.items ?? []) {
      const row = items.get(it.name) ?? { name: it.name, qty: 0, notes: new Map() };
      row.qty += Number(it.qty) || 0;
      const note = (it.note ?? '').trim();
      if (note) row.notes.set(note, (row.notes.get(note) ?? 0) + (Number(it.qty) || 0));
      items.set(it.name, row);
    }
  }
  const pending = list.filter((o) => o.status === 'pending');
  return {
    key,
    orders: list,
    items: [...items.values()]
      .map((r) => ({ ...r, notes: [...r.notes.entries()].map(([note, qty]) => ({ note, qty })) }))
      .sort((a, b) => b.qty - a.qty || a.name.localeCompare(b.name, 'vi')),
    pendingCount: pending.length,
    doneCount: list.length - pending.length,
    pickup: pending.filter((o) => o.type !== 'delivery').length,
    delivery: pending.filter((o) => o.type === 'delivery').length,
    portions: [...items.values()].reduce((s, r) => s + r.qty, 0),
  };
}

export const timeOf = (o) => {
  const d = whenOf(o);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
