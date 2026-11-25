// Đóng gói phiên test bằng esbuild. opsReport kéo theo route → geo và orderGeo;
// stub supabase + useCustomers cho chắc như các suite SSR khác.
// Cách dùng: node tests/ops-report/build.mjs <thư-mục-đích>
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
      name: 'stubs',
      setup(b) {
        b.onResolve({ filter: /hooks\/useCustomers$/ }, () => ({ path: path.join(here, 'stub-useCustomers.mjs') }));
        b.onResolve({ filter: /lib\/supabase$/ }, () => ({ path: path.join(here, 'stub-supabase.mjs') }));
      },
    },
  ],
});
console.log(`Đã đóng gói test vào ${outdir}`);
