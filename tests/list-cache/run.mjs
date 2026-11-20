// Chạy toàn bộ test bản lưu tạm theo từng dòng (lib/listCache, DB v3).
// Mỗi kịch bản gồm nhiều "phiên app" (process riêng) dùng chung một thư mục trạng thái:
// phiên trước đóng lại, phiên sau mở ra phải thấy đúng những gì đã lưu.
// Chạy: npm run test:cache
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-build-'));
execFileSync(process.execPath, [path.join(here, 'build.mjs'), buildDir], { stdio: 'inherit' });
const sessionFile = path.join(buildDir, 'session.mjs');

const groups = [
  ['Lưu lần đầu ghi toàn bộ, sửa 1 dòng chỉ ghi lại đúng dòng đó', ['a1-save-change', 'a2-reload']],
  ['Xoá dòng: biến mất khỏi kho và khỏi lần tải sau', ['b1-delete', 'b2-reload']],
  ['Di trú bản ghi kiểu cũ (DB v2, cả danh sách trong 1 bản ghi)', ['c1-migrate', 'c2-reload']],
  ['Tải toàn bộ: dòng chờ gửi sống sót, dòng bị máy chủ xoá không sống lại', ['d1-seed', 'd2-reconcile']],
  ['cacheClear dọn lists + rows nhưng giữ nguyên kho sync (hàng đợi bền)', ['e1-clear', 'e2-after-clear']],
];

let failed = 0;
for (const [label, scenarios] of groups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cache-test-state-'));
  console.log(`\n== ${label}`);
  for (const s of scenarios) {
    try {
      const out = execFileSync(process.execPath, [sessionFile, s], {
        env: { ...process.env, CACHE_TEST_DIR: dir },
        encoding: 'utf8',
      });
      console.log(out.trim().split('\n').map((l) => `  ${l}`).join('\n'));
    } catch (e) {
      failed += 1;
      console.log(`  ${e.stdout ?? ''}\n  PHIÊN ${s} THẤT BẠI (exit ${e.status})`);
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
fs.rmSync(buildDir, { recursive: true, force: true });

console.log(failed ? `\nKẾT QUẢ: ${failed} phiên test THẤT BẠI` : '\nKẾT QUẢ: TẤT CẢ TEST ĐỀU PASS');
process.exit(failed ? 1 : 0);
