// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite).
// lib/geo.js cần normalizeText từ hooks/useCustomers — thay module đó bằng bản
// rút gọn (stub-useCustomers.mjs) để test không kéo theo hooks + supabase,
// giống mẫu tests/batches.
// Cách dùng: node tests/route-links/build.mjs <thư-mục-đích>
import path from 'node:path';
import { build } from 'esbuild';

const here = path.dirname(new URL(import.meta.url).pathname);
const outdir = process.argv[2];

await build({
  entryPoints: [path.join(here, 'session.mjs')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: path.join(outdir, 'session.mjs'),
  logLevel: 'warning',
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
