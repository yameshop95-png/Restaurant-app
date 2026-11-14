// Gửi bill vào hàng đợi để máy tính ở quán (print-bridge) in ra máy Uniwell.
import { supabase } from './supabase';
import { billBase64 } from './escpos';
import { billImageBase64 } from './escposImage';

// In dạng hình ảnh (có đủ dấu tiếng Việt); nếu trình duyệt không vẽ được thì in chữ không dấu
function payloadFor(order, shopName) {
  try {
    return billImageBase64(order, shopName);
  } catch {
    return billBase64(order, shopName);
  }
}

export async function sendToShopPrinter(order, shopName) {
  const { error } = await supabase.from('print_jobs').insert({
    payload: payloadFor(order, shopName),
    note: `#${order.number}${order.customer?.name ? ' · ' + order.customer.name : ''}`,
  });
  if (error) throw error;
}
