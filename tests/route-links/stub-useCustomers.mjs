// Bản rút gọn của hooks/useCustomers cho test: lib/geo.js chỉ dùng normalizeText.
// normalizeText lấy thẳng từ src/lib/text.js (đúng nguồn mà useCustomers cũng re-export);
// customerKey chép đúng định nghĩa trong hooks/useCustomers phòng khi cần tới.
// Nếu customerKey trong hooks/useCustomers đổi, phải sửa cả ở đây.
import { normalizeText } from '../../src/lib/text.js';

export { normalizeText };

const phoneKey = (phone) => phone.replace(/\\D/g, '');
export const customerKey = (c) => phoneKey(c.phone ?? '') || `name:${normalizeText(c.name)}`;
