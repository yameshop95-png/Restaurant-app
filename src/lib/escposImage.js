// Bill in ra máy nhiệt dưới dạng HÌNH ẢNH (ESC/POS raster, khổ 80mm = 576 chấm), nên in được đủ dấu tiếng Việt
// mà không phụ thuộc bảng mã chữ của máy. Vẽ bằng canvas trong trình duyệt rồi đổi thành ảnh đen trắng.
import { formatMoney, orderTotal } from './stats';

const WIDTH = 576; // 72mm in được ở 203 dpi
const PAD = 10;
const FONT = "'Inter', Arial, 'Segoe UI', sans-serif";
const BAND = 128; // gửi từng dải 128 dòng cho máy khỏi tràn bộ nhớ

const ESC = 0x1b;
const GS = 0x1d;

function wrapLines(ctx, text, maxWidth) {
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

// Vẽ bill lên canvas, trả về canvas đã cắt đúng chiều cao
export function drawBill(order, shopName = '') {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = 2600;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  ctx.fillStyle = '#000';
  ctx.textBaseline = 'top';

  const isDelivery = order.type === 'delivery';
  let y = 4;
  const font = (px, weight = 400, italic = false) => {
    ctx.font = `${italic ? 'italic ' : ''}${weight} ${px}px ${FONT}`;
  };
  const centered = (text, px, weight = 700) => {
    font(px, weight);
    for (const line of wrapLines(ctx, text, WIDTH - PAD * 2)) {
      ctx.fillText(line, (WIDTH - ctx.measureText(line).width) / 2, y);
      y += px + 8;
    }
  };
  const dashed = () => {
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y + 4);
    ctx.lineTo(WIDTH - PAD, y + 4);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 14;
  };
  const row = (left, right, px, weight = 400) => {
    font(px, weight);
    const rightWidth = ctx.measureText(right).width;
    const lines = wrapLines(ctx, left, WIDTH - PAD * 2 - rightWidth - 16);
    lines.forEach((line, i) => {
      ctx.fillText(line, PAD, y);
      if (i === 0) ctx.fillText(right, WIDTH - PAD - rightWidth, y);
      y += px + 8;
    });
    if (!lines.length) y += px + 8;
  };

  // Tiêu đề: khối đen chữ trắng
  const titleHeight = 62;
  ctx.fillRect(0, y, WIDTH, titleHeight);
  ctx.fillStyle = '#fff';
  font(40, 800);
  const title = isDelivery ? 'GIAO HÀNG' : 'ĐẾN LẤY';
  ctx.fillText(title, (WIDTH - ctx.measureText(title).width) / 2, y + 10);
  ctx.fillStyle = '#000';
  y += titleHeight + 10;

  if (shopName) centered(shopName, 24, 500);
  centered(`#${order.number}`, 28, 700);
  centered(order.customer?.name ?? order.note ?? '', 34, 700);
  if (isDelivery && order.customer?.address) {
    font(26, 400);
    for (const line of wrapLines(ctx, order.customer.address, WIDTH - PAD * 2)) {
      ctx.fillText(line, (WIDTH - ctx.measureText(line).width) / 2, y);
      y += 34;
    }
  }
  if (order.deliverAt) {
    const d = new Date(order.deliverAt);
    const p2 = (n) => String(n).padStart(2, '0');
    centered(
      `${isDelivery ? 'Giao' : 'Lấy'} ${p2(d.getHours())}:${p2(d.getMinutes())}  ${p2(d.getDate())}/${p2(d.getMonth() + 1)}`,
      28,
      600,
    );
  }
  dashed();

  for (const i of order.items ?? []) {
    row(`${i.qty} ×  ${i.name}`, formatMoney(i.qty * i.price), 28, 500);
    if (i.note) {
      font(24, 400, true);
      for (const line of wrapLines(ctx, i.note, WIDTH - PAD * 2 - 40)) {
        ctx.fillText(line, PAD + 40, y);
        y += 30;
      }
    }
  }
  dashed();
  if (isDelivery || order.shippingFee > 0) row('Phí ship', formatMoney(order.shippingFee || 0), 26);
  ctx.fillRect(PAD, y + 2, WIDTH - PAD * 2, 3);
  y += 12;
  row('TỔNG', formatMoney(orderTotal(order)), 40, 800);
  y += 24;

  // Cắt phần canvas thừa
  const out = document.createElement('canvas');
  out.width = WIDTH;
  out.height = Math.ceil(y / 8) * 8;
  out.getContext('2d').drawImage(canvas, 0, 0);
  return out;
}

// Ảnh → lệnh ESC/POS: khởi tạo, các dải ảnh GS v 0, đẩy giấy, cắt
export function canvasToEscpos(canvas) {
  const w = canvas.width;
  const h = canvas.height;
  const px = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const bytesPerRow = w / 8;
  const bytes = [ESC, 0x40];
  for (let top = 0; top < h; top += BAND) {
    const rows = Math.min(BAND, h - top);
    bytes.push(GS, 0x76, 0x30, 0x00, bytesPerRow & 0xff, bytesPerRow >> 8, rows & 0xff, rows >> 8);
    for (let r = 0; r < rows; r++) {
      for (let bx = 0; bx < bytesPerRow; bx++) {
        let b = 0;
        for (let bit = 0; bit < 8; bit++) {
          const i = ((top + r) * w + bx * 8 + bit) * 4;
          const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
          if (px[i + 3] > 40 && lum < 150) b |= 0x80 >> bit; // bit 1 = chấm đen
        }
        bytes.push(b);
      }
    }
  }
  bytes.push(ESC, 0x64, 0x04); // đẩy giấy 4 dòng
  bytes.push(GS, 0x56, 0x42, 0x00); // cắt giấy
  return Uint8Array.from(bytes);
}

export function billImageBase64(order, shopName) {
  const bytes = canvasToEscpos(drawBill(order, shopName));
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
