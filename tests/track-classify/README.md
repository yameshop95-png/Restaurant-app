# Test: Phân loại nguồn truy cập + thiết bị (theo dõi website)

Chạy: `npm run test:classify`

Đóng gói `session.mjs` bằng esbuild rồi chạy trong process riêng, giống mẫu
`tests/report-insights` (`trackClassify.js` là module thuần nên không cần stub).

`session.mjs` khẳng định:

- **classifySource** (`src/site/trackClassify.js`) — nguồn của phiên theo
  `document.referrer` và `utm_source` của URL đáp, 6 nhóm: `google`, `facebook`
  (gồm các host bọc link `l.facebook.com`, `lm.facebook.com`), `instagram`,
  `zalo` (`chat.zalo.me`), `direct` (không referrer, không utm), `other`.
  `utm_source` được ưu tiên hơn referrer; các giá trị utm thường gặp
  (`fb`, `ig`, `googleads`, `zalo_oa`…) được ánh xạ về đúng nhóm.
- **classifyDevice** — userAgent → `mobile` / `tablet` / `desktop`
  (iPad và Android không có chữ "Mobile" tính là tablet).

Phần tính toán nằm trong SQL (`customer_activity()` — thời lượng, khách quay lại,
xu hướng tuần) không chạy thử được ở môi trường Node này; xem comment trong
`sql/customer_activity.sql`.
