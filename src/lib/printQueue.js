// Gửi bill vào hàng đợi để máy tính ở quán (print-bridge) in ra máy Uniwell.
import { supabase } from './supabase';
import { billBase64 } from './escpos';

export async function sendToShopPrinter(order, shopName) {
  const { error } = await supabase.from('print_jobs').insert({
    payload: billBase64(order, shopName),
    note: `#${order.number}${order.customer?.name ? ' · ' + order.customer.name : ''}`,
  });
  if (error) throw error;
}
