// Test issue #79 — Đơn ship sau PR #75:
//   (a) Badge Đơn ship: App.jsx tính deliveryAction = deliveringDelivery +
//       doneDelivery (KHÔNG còn pendingDelivery); BottomNav dùng badgeKey
//       'deliveryAction' và render đúng số đó (render SSR thật với counts mẫu:
//       deliveryAction 5, pendingDelivery 99 → huy hiệu phải là 5, không phải 99).
//   (b) Khối "Nấu xong, chờ mang đi" ở chế độ khu vực: planRouteByArea (cơ chế khối
//       này dùng) xếp đơn Wodonga trước đơn Albury dù đơn Albury hẹn sớm hơn.
//   (c) OrdersPage.jsx: nút nổi "Tạo đơn" bọc trong {!routeAllowed && (...)} nên
//       trang Đơn ship không render nút này; RoutePlanner.jsx có dòng chú thích
//       thứ tự giao + số thứ tự.
// Chạy qua run.mjs (npm run test:shippage) với TZ=Australia/Melbourne.
process.env.TZ = 'Australia/Melbourne';

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import BottomNav from '../../src/components/BottomNav.jsx';
import { planRouteByArea } from '../../src/lib/route.js';

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const read = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

// --- (a) badge ---
const appSrc = read('src/App.jsx');
check('App.jsx: deliveryAction = deliveringDelivery + doneDelivery',
  appSrc.includes('deliveryAction: deliveringDelivery + doneDelivery,'));
check('App.jsx: biến pendingDelivery vẫn còn (Tổng quan dùng)',
  appSrc.includes('pendingDelivery,') || appSrc.includes('pendingDelivery:'));
const navSrc = read('src/components/BottomNav.jsx');
check("BottomNav.jsx: badgeKey của Đơn ship là 'deliveryAction'",
  navSrc.includes("id: 'delivery', label: 'Đơn ship', icon: Bike, badgeKey: 'deliveryAction'"));
const html = renderToString(
  React.createElement(BottomNav, {
    activeTab: 'delivery',
    counts: { inboxAll: 0, cookingCount: 0, deliveryAction: 5, pendingDelivery: 99 },
    onTabChange: () => {},
    onMore: () => {},
  }),
).replace(/<!-- -->/g, '');
check('Render BottomNav: huy hiệu Đơn ship hiện 5 (deliveryAction)', />5</.test(html));
check('Render BottomNav: không hiện 99 (pendingDelivery) ở huy hiệu nào', !/>99</.test(html));

// --- (b) thứ tự khối chờ mang đi (chế độ khu vực) ---
const at = (h, min = 0) => new Date(2026, 10, 28, h, min).toISOString(); // thứ Bảy 28/11/2026
const mk = (id, address, deliverAt) => ({
  id, type: 'delivery', status: 'done', deliverAt, createdAt: at(7),
  customer: { name: id, phone: '', address }, items: [],
});
const wod = mk('W1', '114 High St, Wodonga VIC 3690', at(11)); // hẹn 11:00
const alb = mk('A1', '500 Dean St, Albury NSW 2640', at(9)); // hẹn 09:00 — sớm hơn
const geo = new Map([
  ['W1', { lat: -36.1214, lng: 146.8885 }],
  ['A1', { lat: -36.0808, lng: 146.9162 }],
]);
const start = { lat: -36.1214, lng: 146.8885 }; // điểm quán ở Wodonga
const plan = planRouteByArea([alb, wod], geo, start, new Date(2026, 10, 28, 7, 0), { homeSide: 'vic' });
const orderIds = plan.slots.flatMap((s) => s.stops.map((x) => x.order.id));
check('planRouteByArea: Wodonga đứng trước Albury dù hẹn trễ hơn',
  orderIds.indexOf('W1') !== -1 && orderIds.indexOf('W1') < orderIds.indexOf('A1'));

// --- (c) nút Tạo đơn + ghi chú thứ tự ---
const ordersSrc = read('src/pages/OrdersPage.jsx');
check('OrdersPage.jsx: nút nổi Tạo đơn bọc {!routeAllowed && (...)}',
  /\{!routeAllowed && \(\s*<button\s+onClick=\{\(\) => setCreating\(true\)\}/.test(ordersSrc));
const rpSrc = read('src/components/RoutePlanner.jsx');
check('RoutePlanner.jsx: khối chờ mang đi dùng planRouteByArea để sắp',
  rpSrc.includes('planRouteByArea(list, geoReady, start, now, { homeSide })'));
check('RoutePlanner.jsx: có dòng chú thích thứ tự giao',
  rpSrc.includes('Xếp theo thứ tự giao — chất đơn số 1 lên xe sau cùng (lấy ra đầu tiên).'));

console.log(failures ? `\n${failures} FAIL` : '\nTẤT CẢ PASS');
process.exit(failures ? 1 : 0);
