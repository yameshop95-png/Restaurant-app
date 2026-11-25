// Bản rút gọn của hooks/useCustomers cho test: report.js chỉ dùng normalizeText,
// reportInsights.js dùng thêm customerKey. Cả hai đều là hàm thuần — normalizeText lấy
// thẳng từ src/lib/text.js (đúng nguồn mà useCustomers cũng re-export), customerKey chép
// đúng định nghĩa trong hooks/useCustomers (SĐT chỉ lấy chữ số; trống thì theo tên đã
// chuẩn hoá) vì bản thật nằm trong hook kéo theo supabase, không bundle vào test được.
// Nếu customerKey trong hooks/useCustomers đổi, phải sửa cả ở đây.
import { normalizeText } from '../../src/lib/text.js';

export { normalizeText };

const phoneKey = (phone) => phone.replace(/\D/g, '');
export const customerKey = (c) => phoneKey(c.phone ?? '') || `name:${normalizeText(c.name)}`;
