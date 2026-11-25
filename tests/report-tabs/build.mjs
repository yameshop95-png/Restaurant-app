// Đóng gói phiên test bằng esbuild. ReportPage kéo theo nhiều hook (useCustomers,
// useInventory, supabase qua các thẻ con) nên thay bằng stub: useCustomers bản rút gọn,
// useInventory trả kho rỗng đã sẵn sàng, supabase bản giả không mạng.
// Cách dùng: node tests/report-tabs/build.mjs <thư-mục-đích>
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
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /hooks\/useCustomers$/ }, () => ({ path: path.join(here, 'stub-useCustomers.mjs') }));
        b.onResolve({ filter: /hooks\/useInventory$/ }, () => ({ path: path.join(here, 'stub-useInventory.mjs') }));
        b.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: path.join(here, 'stub-supabase.mjs') }));
      },
    },
  ],
});
console.log(`Đã đóng gói test vào ${outdir}`);
