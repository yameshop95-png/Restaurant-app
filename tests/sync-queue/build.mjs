// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite):
// thay module src/lib/supabase bằng bản giả (tests/sync-queue/fake-supabase.mjs) để test không đụng máy chủ thật.
// Cách dùng: node tests/sync-queue/build.mjs <thư-mục-đích>
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
      name: 'fake-supabase',
      setup(b) {
        b.onResolve({ filter: /(^|\/)supabase$/ }, () => ({ path: path.join(here, 'fake-supabase.mjs') }));
      },
    },
  ],
});
console.log(`Đã đóng gói test vào ${outdir}`);
