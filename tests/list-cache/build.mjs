// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite).
// lib/listCache không import module nào khác nên không cần thay bản giả như test hàng đợi đồng bộ.
// Cách dùng: node tests/list-cache/build.mjs <thư-mục-đích>
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
});
console.log(`Đã đóng gói test vào ${outdir}`);
