// In bill của một đơn bằng máy in của điện thoại / máy tính (AirPrint, máy in bill, hoặc lưu PDF).
// Bill chỉ gồm: tiêu đề ĐẾN LẤY / GIAO HÀNG, tên khách, từng món kèm giá, phí ship, tổng tiền.
// Khổ giấy 80mm; máy in A4 cũng in được (bill nằm ở góc trên).
import { formatMoney, orderTotal } from './stats';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function billHtml(order) {
  const isDelivery = order.type === 'delivery';
  const rows = order.items
    .map(
      (i) => `<tr><td class="qty">${i.qty} ×</td><td>${esc(i.name)}${i.note ? `<div class="note">${esc(i.note)}</div>` : ''}</td><td class="money">${formatMoney(i.qty * i.price)}</td></tr>`
    )
    .join('');
  return `
    <div class="bill-title">${isDelivery ? 'GIAO HÀNG' : 'ĐẾN LẤY'}</div>
    <div class="bill-name">${esc(order.customer?.name ?? order.note ?? '')}</div>
    <table class="bill-items">${rows}</table>
    <table class="bill-sum">
      ${isDelivery || order.shippingFee > 0 ? `<tr><td>Phí ship</td><td class="money">${formatMoney(order.shippingFee || 0)}</td></tr>` : ''}
      <tr class="total"><td>TỔNG</td><td class="money">${formatMoney(orderTotal(order))}</td></tr>
    </table>`;
}

export function printBill(order) {
  document.querySelector('.print-bill')?.remove();
  const el = document.createElement('div');
  el.className = 'print-bill';
  el.innerHTML = billHtml(order);
  document.body.appendChild(el);
  document.body.classList.add('printing-bill');
  const done = () => {
    document.body.classList.remove('printing-bill');
    el.remove();
    window.removeEventListener('afterprint', done);
  };
  window.addEventListener('afterprint', done);
  // Chờ trình duyệt vẽ bill xong rồi mới mở bảng in
  requestAnimationFrame(() => setTimeout(() => window.print(), 50));
}
