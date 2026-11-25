// Chạy test issue #79: badge Đơn ship, thứ tự khối "Nấu xong, chờ mang đi",
// nút nổi Tạo đơn ở trang Đơn ship.
// Đóng gói session bằng esbuild rồi chạy trong process riêng, giống mẫu tests/report-insights.
// Chạy: npm run test:shippage
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insights-test-'));
try {
  execFileSync(process.execPath, [path.join(here, 'build.mjs'), buildDir], { stdio: 'inherit' });
  execFileSync(process.execPath, [path.join(buildDir, 'session.cjs')], { stdio: 'inherit' });
} catch (e) {
  console.log(`\nKẾT QUẢ: TEST THẤT BẠI (exit ${e.status})`);
  process.exit(1);
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
