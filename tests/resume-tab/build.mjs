// Đóng gói phiên test bằng esbuild, format cjs (react-dom/server cần cjs).
// Cách dùng: node tests/resume-tab/build.mjs <thư-mục-đích>
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
});
console.log(`Đã đóng gói test vào ${outdir}`);
