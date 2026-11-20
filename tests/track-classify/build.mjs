// Đóng gói phiên test bằng esbuild (đã có sẵn trong node_modules qua vite).
// trackClassify.js là module thuần (không import gì) nên đóng gói thẳng, không cần stub.
// Cách dùng: node tests/track-classify/build.mjs <thư-mục-đích>
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
