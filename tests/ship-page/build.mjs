// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite).
// route.js kéo theo geo.js → hooks/useCustomers nên thay module đó bằng bản rút gọn
// (stub-useCustomers.mjs) như mẫu tests/report-insights. BottomNav chỉ cần react +
// lucide-react. App.jsx / OrdersPage.jsx không bundle — test đọc source của chúng để
// khoá hồi quy đúng chỗ đã sửa (counts trong App là useMemo nội tuyến, không tách
// thành hàm thuần được).
// Cách dùng: node tests/ship-page/build.mjs <thư-mục-đích>
import path from 'node:path';
import { build } from 'esbuild';

const here = path.dirname(new URL(import.meta.url).pathname);
const outdir = process.argv[2];

await build({
  entryPoints: [path.join(here, 'session.mjs')],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile: path.join(outdir, 'session.cjs'),
  logLevel: 'warning',
  jsx: 'automatic',
  plugins: [
    {
      name: 'stub-usecustomers',
      setup(b) {
        b.onResolve({ filter: /hooks\/useCustomers$/ }, () => ({ path: path.join(here, 'stub-useCustomers.mjs') }));
      },
    },
  ],
});
console.log(`Đã đóng gói test vào ${outdir}`);
