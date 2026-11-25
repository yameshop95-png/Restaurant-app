// Đóng gói phiên test bằng esbuild. currentRun kéo theo batches → route → geo →
// hooks/useCustomers nên thay module đó bằng bản rút gọn như tests/report-insights.
// Cách dùng: node tests/current-run/build.mjs <thư-mục-đích>
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
