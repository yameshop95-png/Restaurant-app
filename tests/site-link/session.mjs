// Test: link gửi cho khách luôn là domain chính thức wodovn.xyz.
// Lỗi gốc (Paul báo 25/11/2026): Cài đặt → Website đặt món hiện link theo
// window.location.origin — app nhân viên chạy ở vercel.app nên link copy ra
// là link cũ. Cùng lỗi ở tin nhắc khách quen (customerMessage.reminderMessage).
process.env.TZ = 'Australia/Melbourne';
import fs from 'node:fs';
import path from 'node:path';
import { CUSTOMER_ORDER_LINK, CUSTOMER_SITE_URL } from '../../src/lib/siteLink.js';
import { reminderMessage } from '../../src/lib/customerMessage.js';

let failures = 0;
const check = (label, cond) => {
  if (cond) console.log('ok -', label);
  else { failures += 1; console.log('FAIL -', label); }
};

check('CUSTOMER_ORDER_LINK = https://www.wodovn.xyz/order', CUSTOMER_ORDER_LINK === 'https://www.wodovn.xyz/order');
check('CUSTOMER_SITE_URL = https://www.wodovn.xyz', CUSTOMER_SITE_URL === 'https://www.wodovn.xyz');

const customer = { name: 'Chị Lan', phone: '0400000000' };
const profile = { dishes: [{ name: 'Bánh cuốn' }] };
const vi = reminderMessage(customer, profile, 'vi', 'Bánh Cuốn & Giò Chả');
const en = reminderMessage(customer, profile, 'en', 'Bánh Cuốn & Giò Chả');
check('Tin nhắc tiếng Việt chứa link wodovn.xyz/order', vi.includes('https://www.wodovn.xyz/order'));
check('Tin nhắc tiếng Anh chứa link wodovn.xyz/order', en.includes('https://www.wodovn.xyz/order'));
check('Tin nhắc không chứa link vercel.app', !vi.includes('vercel') && !en.includes('vercel'));

const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
check('WebOrderingSettings không còn location.origin, dùng CUSTOMER_ORDER_LINK',
  !read('src/components/WebOrderingSettings.jsx').includes('location.origin') &&
  read('src/components/WebOrderingSettings.jsx').includes('CUSTOMER_ORDER_LINK'));
check('customerMessage không còn location.origin',
  !read('src/lib/customerMessage.js').includes('location.origin'));

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
