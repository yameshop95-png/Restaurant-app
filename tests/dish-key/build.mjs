// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite).
// Các lib được test (dishKey, saleDate, stats, report, forecast) đều là hàm thuần và
// sau PR #80 không còn import hooks/useCustomers nữa nên không cần stub.
// Cách dùng: node tests/dish-key/build.mjs <thư-mục-đích>
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
