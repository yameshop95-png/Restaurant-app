// Bill cho máy in nhiệt ESC/POS (máy Uniwell UP-A1, khổ 80mm, 48 ký tự / dòng).
// Máy in nhiệt không có dấu tiếng Việt nên bỏ dấu, giữ nguyên chữ cái và số. Trả về chuỗi base64 để lưu vào hàng đợi in.
import { formatMoney, orderTotal } from './stats';

const WIDTH = 48;
const ESC = 0x1b;
const GS = 0x1d;

const ascii = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^\x20-\x7e]/g, '?');

// Một dòng: chữ bên trái, số tiền bên phải
const line = (left, right = '') => {
  const l = ascii(left);
  const r = ascii(right);
  const room = WIDTH - r.length - 1;
  const cut = l.length > room ? l.slice(0, Math.max(0, room)) : l;
  return cut + ' '.repeat(Math.max(1, WIDTH - cut.length - r.length)) + r;
};

const wrap = (text, width = WIDTH) => {
  const words = ascii(text).split(/\s+/).filter(Boolean);
  const out = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > width) {
      if (cur) out.push(cur);
      cur = w;
    } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  return out;
};

export function billBytes(order, shopName = '') {
  const isDelivery = order.type === 'delivery';
  const bytes = [];
  const text = (s) => bytes.push(...new TextEncoder().encode(s + '\n'));
  const cmd = (...b) => bytes.push(...b);

  cmd(ESC, 0x40); // khởi tạo máy
  cmd(GS, 0x4c, 32, 0); // lề trái 32 chấm (4mm): chữ không bị cắt sát mép giấy
  cmd(GS, 0x57, 0x40, 0x02); // vùng in rộng 576 chấm
  // Tiêu đề chữ trắng nền đen (GS B), chữ to gấp đôi: 24 ký tự mỗi dòng
  const title = isDelivery ? 'DELIVERY' : 'PICK UP';
  const pad = Math.floor((24 - title.length) / 2);
  cmd(GS, 0x42, 1);
  cmd(GS, 0x21, 0x11);
  text(' '.repeat(pad) + title + ' '.repeat(24 - pad - title.length));
  cmd(GS, 0x21, 0x00);
  cmd(GS, 0x42, 0);
  cmd(ESC, 0x61, 0); // căn trái

  if (shopName) text(ascii(shopName));
  text('#' + order.number + '  ' + ascii(order.createdBy ?? ''));
  text('-'.repeat(WIDTH));

  cmd(ESC, 0x45, 1);
  for (const w of wrap(order.customer?.name ?? order.note ?? '')) text(w);
  cmd(ESC, 0x45, 0);
  if (isDelivery && order.customer?.address) {
    for (const w of wrap(order.customer.address)) text(w);
  }
  if (order.deliverAt) {
    const d = new Date(order.deliverAt);
    const when = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}  ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    text((isDelivery ? 'Deliver ' : 'Pick up ') + when);
  }
  text('-'.repeat(WIDTH));

  for (const i of order.items ?? []) {
    text(line(`${i.qty} x ${i.name}`, formatMoney(i.qty * i.price).replace('A$', '')));
    if (i.note) for (const w of wrap('   ' + i.note)) text(w);
  }
  text('-'.repeat(WIDTH));
  if (isDelivery || order.shippingFee > 0)
    text(line('Delivery fee', formatMoney(order.shippingFee || 0).replace('A$', '')));
  cmd(ESC, 0x45, 1);
  text(line('TOTAL', formatMoney(orderTotal(order)).replace('A$', '')));
  cmd(ESC, 0x45, 0);

  text('');
  text('');
  cmd(GS, 0x56, 0x42, 0x00); // cắt giấy
  return Uint8Array.from(bytes);
}

export function billBase64(order, shopName) {
  const bin = String.fromCharCode(...billBytes(order, shopName));
  return btoa(bin);
}
