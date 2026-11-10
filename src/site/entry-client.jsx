import React from 'react';
import ReactDOM from 'react-dom/client';
import SiteApp from './SiteApp.jsx';
import './site.css';

// Trang đã dựng sẵn HTML lúc build thì "tiếp quản" (hydrate). Vẽ mới khi chạy thử trên máy dev,
// hoặc khi Vercel trả 404.html cho địa chỉ lạ (nội dung khác đường dẫn nên không ghép được).
const root = document.getElementById('order-root');
const here = window.location.pathname.replace(/\/+$/, '') || '/';
const app = (
  <React.StrictMode>
    <SiteApp initialPath={window.location.pathname} initialData={window.__SITE_DATA__ ?? null} />
  </React.StrictMode>
);
if (root.firstElementChild && root.dataset.path === here) ReactDOM.hydrateRoot(root, app);
else {
  root.textContent = '';
  ReactDOM.createRoot(root).render(app);
}
