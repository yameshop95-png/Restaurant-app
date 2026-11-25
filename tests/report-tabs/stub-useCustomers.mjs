// Bản rút gọn của hooks/useCustomers cho test (giống tests/report-insights, thêm các
// export mà các thẻ con của ReportPage cần).
import { normalizeText } from '../../src/lib/text.js';

export { normalizeText };
const phoneKey = (phone) => (phone ?? '').replace(/\D/g, '');
export const customerKey = (c) => phoneKey(c?.phone) || `name:${normalizeText(c?.name ?? '')}`;
export const mergeInto = (base) => base;
export const sameCustomer = (a, b) => customerKey(a) === customerKey(b);
export const matchesCustomer = () => false;
export const searchCustomers = () => [];
export default function useCustomers() {
  return { list: [], ready: true };
}
