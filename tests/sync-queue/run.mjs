// Chạy toàn bộ test hàng đợi đồng bộ (vấn đề audit #2: hàng đợi trong RAM, đóng app là mất).
// Mỗi kịch bản gồm nhiều "phiên app" (process riêng) dùng chung một thư mục trạng thái:
// phiên trước đóng lại (kể cả khi mất mạng / có thao tác lỗi), phiên sau mở ra phải thấy đủ.
// Chạy: npm run test:sync
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-build-'));
execFileSync(process.execPath, [path.join(here, 'build.mjs'), buildDir], { stdio: 'inherit' });
const sessionFile = path.join(buildDir, 'session.mjs');

const groups = [
  ['Tạo đơn + sửa đơn lúc mất mạng, đóng app, mở lại có mạng', ['s1-close-offline', 's2-reopen-online']],
  ['Sửa cùng một đơn 2 lần lúc mất mạng, đóng app, mở lại', ['s3-close-edits', 's4-reopen-edits']],
  ['Máy chủ từ chối: giữ lại qua lần đóng app, Thử lại được, bỏ qua được', ['s5-fail-close', 's6-reopen-failed']],
  ['Có mạng: hành vi như cũ, không để lại gì', ['s7-online']],
];

let failed = 0;
for (const [label, scenarios] of groups) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-test-state-'));
  console.log(`\n== ${label}`);
  for (const s of scenarios) {
    try {
      const out = execFileSync(process.execPath, [sessionFile, s], {
        env: { ...process.env, SYNC_TEST_DIR: dir },
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
