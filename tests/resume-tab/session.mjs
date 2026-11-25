// Test: nhớ tab đang xem khi app tự tải lại (lib/resumeTab) + khung đỡ lỗi trang.
// Bối cảnh: Paul báo bấm Báo cáo bị văng về màn hình chính — trang tải lười gặp
// tệp cũ sau deploy, main.jsx tải lại trang và mất tab. Bản sửa: App lưu tab
// vào sessionStorage, mở lại đúng tab; khung lỗi giữ app không sập hẳn.
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { loadResumeTab, saveResumeTab } from '../../src/lib/resumeTab.js';
import PageErrorBoundary from '../../src/components/PageErrorBoundary.jsx';

// sessionStorage giả (lib đọc global này lúc gọi hàm, không phải lúc import)
const store = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

let passed = 0;
let failed = 0;
function check(label, ok) {
  if (ok) { passed++; console.log(`  ✓ ${label}`); }
  else { failed++; console.log(`  ✗ TRƯỢT: ${label}`); }
}

const IDS = ['home', 'orders', 'report', 'settings'];
check('Chưa lưu gì → null (vào home như cũ)', loadResumeTab(IDS) === null);
saveResumeTab('report');
check('Lưu report → đọc lại được report', loadResumeTab(IDS) === 'report');
saveResumeTab('tab-khong-co-that');
check('Tab lạ (không nằm trong danh sách trang) → null', loadResumeTab(IDS) === null);
saveResumeTab('orders');
check('Ghi đè tab mới nhất', loadResumeTab(IDS) === 'orders');

// Khung đỡ lỗi: trang bình thường vẽ nguyên vẹn, trang lỗi hiện thẻ + nút tải lại
const okHtml = renderToString(React.createElement(PageErrorBoundary, null, React.createElement('p', null, 'Nội dung trang')));
check('Trang bình thường: khung cho qua nguyên vẹn', okHtml.includes('Nội dung trang') && !okHtml.includes('Chưa mở được mục này'));
function Boom() { throw new Error('chunk cũ'); }
// Renderer phía server của React không cho boundary đỡ lỗi ở "vỏ" trang
// (lỗi vỏ là chết hẳn khi SSR) — nhưng app chạy ở client (createRoot) thì
// boundary đỡ bình thường. Vì vậy kiểm logic của boundary trực tiếp:
// hàm suy trạng thái lỗi + bản vẽ dự phòng khi đã ở trạng thái lỗi.
check('getDerivedStateFromError bật trạng thái lỗi',
  PageErrorBoundary.getDerivedStateFromError().failed === true);
class FailedBoundary extends PageErrorBoundary {
  state = { failed: true };
}
const failHtml = renderToString(React.createElement(FailedBoundary, null, React.createElement(Boom)));
check('Ở trạng thái lỗi: hiện thẻ báo lỗi + nút Tải lại app, không vẽ trang lỗi',
  failHtml.includes('Chưa mở được mục này') && failHtml.includes('Tải lại app'));

// Khoá nguồn: App dùng resumeTab + main.jsx có chống vòng lặp tải lại
const appSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.jsx'), 'utf8');
check('App.jsx khởi tạo tab từ loadResumeTab', appSrc.includes('loadResumeTab(Object.keys(PAGES))'));
check('App.jsx lưu tab trong handleTabChange', appSrc.includes('saveResumeTab(tab)'));
check('App.jsx bọc trang bằng PageErrorBoundary', appSrc.includes('<PageErrorBoundary>'));
const mainSrc = fs.readFileSync(path.join(process.cwd(), 'src/main.jsx'), 'utf8');
check('main.jsx chống vòng lặp tải lại (preloadReloadAt + 30000)', mainSrc.includes('preloadReloadAt') && mainSrc.includes('30000'));

console.log(`\nresume-tab: ${passed} đạt, ${failed} trượt`);
if (failed) { console.log('KẾT QUẢ: TEST THẤT BẠI'); process.exit(1); }
console.log('TẤT CẢ PASS');
