// Gửi bill vào hàng đợi để máy tính ở quán (print-bridge) in ra máy Uniwell.
import { supabase } from './supabase';
import { billBase64 } from './escpos';
import { billImageBase64 } from './escposImage';

// In dạng hình ảnh (có đủ dấu tiếng Việt); nếu trình duyệt không vẽ được thì in chữ không dấu
function payloadFor(order, shopName) {
  try {
    return { payload: billImageBase64(order, shopName), mode: 'image' };
  } catch {
    return { payload: billBase64(order, shopName), mode: 'text' };
  }
}

export async function sendToShopPrinter(order, shopName) {
  const { payload, mode } = payloadFor(order, shopName);
  const { error } = await supabase.from('print_jobs').insert({
    payload,
    note: `#${order.number}${order.customer?.name ? ' · ' + order.customer.name : ''}`,
  });
  if (error) throw error;
  return mode; // 'image' (có dấu) hoặc 'text' (không dấu)
}

// In lần lượt nhiều bill: gửi từng bill vào hàng đợi theo đúng thứ tự (máy tính ở quán in theo thứ tự gửi).
// Trả về số bill đã gửi; dừng ngay khi có lỗi.
export async function sendManyToShopPrinter(orders, shopName, onProgress) {
  let sent = 0;
  for (const order of orders) {
    await sendToShopPrinter(order, shopName);
    sent += 1;
    onProgress?.(sent, orders.length);
  }
  return sent;
}
