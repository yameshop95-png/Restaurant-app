# tests/site-link

Khoá hành vi: link gửi cho khách (Cài đặt → Website đặt món, và tin nhắc
khách quen trong `customerMessage.reminderMessage`) luôn là
`https://www.wodovn.xyz/order` từ `src/lib/siteLink.js` — không suy ra từ
`window.location.origin` (app nhân viên chạy ở vercel.app nên cách cũ cho
ra link cũ; Paul báo 25/11/2026).

Chạy: `npm run test:sitelink`
