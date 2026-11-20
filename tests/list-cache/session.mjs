// Một "phiên app" cho test bản lưu tạm theo từng dòng: mỗi lần chạy file này là một lần mở app riêng
// (process mới = bộ nhớ mới), trạng thái bền (IndexedDB giả) nằm trong CACHE_TEST_DIR.
// Chạy qua run.mjs. Các khẳng định về số lần ghi (idbOps) là phần cốt lõi: bản sửa này chỉ có
// ý nghĩa nếu lần lưu sau khi sửa 1 dòng KHÔNG ghi lại toàn bộ danh sách.
import fs from 'node:fs';
import path from 'node:path';
import { installFakeIndexedDB, idbOps, resetIdbOps } from './fake-indexeddb.mjs';

const dir = process.env.CACHE_TEST_DIR;
const idbFile = installFakeIndexedDB(dir);
const readIdb = () => JSON.parse(fs.readFileSync(idbFile, 'utf8'));
const stash = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
const readStash = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const meta = (maxUpdated) => ({ maxUpdated, hasUpdated: true, lastFull: 111 });
const order = (id, extra = {}) => ({ id, status: 'pending', total: 10, ...extra });

const scenario = process.argv[2];
const { cacheLoadList, cacheSaveList, cacheClear, syncCacheGet, syncCacheSet } = await import('../../src/lib/listCache.js');

if (scenario === 'a1-save-change') {
  const orders = ['o1', 'o2', 'o3', 'o4', 'o5'].map((id) => order(id));
  await cacheSaveList('orders', orders, meta('2026-11-20T00:00:00Z'));
  check('lần lưu đầu: ghi toàn bộ 5 dòng + 1 bản ghi phụ', idbOps.put === 6);
  resetIdbOps();
  const changed = orders.map((o) => (o.id === 'o3' ? { ...o, status: 'done' } : o));
  await cacheSaveList('orders', changed, meta('2026-11-20T00:01:00Z'));
  check('sửa 1 dòng: chỉ ghi lại đúng 1 dòng + bản ghi phụ, không xoá gì', idbOps.put === 2 && idbOps.delete === 0);
  const idb = readIdb();
  check('kho rows có đủ 5 dòng', Object.keys(idb.stores.rows).length === 5);
  check('dòng o3 trong kho đã là bản mới', idb.stores.rows['row:orders:o3'].status === 'done');
  const m = idb.stores.lists['list:orders'];
  check('bản ghi phụ không còn chứa cả danh sách, đã đánh dấu perRow', !('items' in m) && m.perRow === 1);
  stash('expected-a.json', changed);
} else if (scenario === 'a2-reload') {
  const loaded = await cacheLoadList('orders');
  check('phiên mới tải lại đủ 5 dòng, đúng thứ tự và nội dung', same(loaded?.items, readStash('expected-a.json')));
  check('thông tin phụ giữ nguyên', loaded?.maxUpdated === '2026-11-20T00:01:00Z' && loaded?.hasUpdated === true && loaded?.lastFull === 111);
} else if (scenario === 'b1-delete') {
  const [o1, o2, o3] = [order('o1'), order('o2'), order('o3')];
  await cacheSaveList('orders', [o1, o2, o3], meta('2026-11-20T00:00:00Z'));
  resetIdbOps();
  await cacheSaveList('orders', [o1, o3], meta('2026-11-20T00:02:00Z'));
  check('xoá 1 dòng: đúng 1 delete, chỉ ghi thêm bản ghi phụ', idbOps.delete === 1 && idbOps.put === 1);
  check('kho không còn dòng o2', !('row:orders:o2' in readIdb().stores.rows));
} else if (scenario === 'b2-reload') {
  const loaded = await cacheLoadList('orders');
  check('tải lại chỉ còn o1, o3', same(loaded?.items?.map((x) => x.id), ['o1', 'o3']));
} else if (scenario === 'c1-migrate') {
  // Máy đang chạy bản cũ: DB v2, cả danh sách nằm trong 1 bản ghi ở kho lists, chưa có kho rows
  const legacy = [order('o1'), order('o2', { note: 'cũ' }), order('o3')];
  fs.writeFileSync(
    idbFile,
    JSON.stringify({
      version: 2,
      stores: { lists: { 'list:orders': { items: legacy, maxUpdated: '2026-11-19T00:00:00Z', hasUpdated: true, lastFull: 222 } }, sync: {} },
    }),
  );
  const loaded = await cacheLoadList('orders');
  check('bản ghi kiểu cũ vẫn đọc được nguyên vẹn để hiện ngay', same(loaded?.items, legacy));
  check('thông tin phụ của bản cũ giữ nguyên', loaded?.lastFull === 222);
  resetIdbOps();
  const migrated = legacy.map((o) => (o.id === 'o2' ? { ...o, note: 'mới' } : o));
  await cacheSaveList('orders', migrated, meta('2026-11-20T00:03:00Z'));
  check('di trú: lần lưu đầu ghi toàn bộ 3 dòng + bản ghi phụ', idbOps.put === 4);
  const idb = readIdb();
  check('kho rows đã có đủ 3 dòng', Object.keys(idb.stores.rows ?? {}).length === 3);
  const m = idb.stores.lists['list:orders'];
  check('bản ghi phụ đã bỏ mảng items, đánh dấu perRow', !('items' in m) && m.perRow === 1);
  stash('expected-c.json', migrated);
} else if (scenario === 'c2-reload') {
  const loaded = await cacheLoadList('orders');
  check('sau di trú: tải lại đúng danh sách (kèm bản sửa o2)', same(loaded?.items, readStash('expected-c.json')));
} else if (scenario === 'd1-seed') {
  const rows = [order('ord-a'), order('ord-b'), order('ord-c'), order('ord-p', { localOnly: true })];
  await cacheSaveList('orders', rows, meta('2026-11-20T00:00:00Z'));
  check('đã gieo 4 dòng (gồm ord-c sẽ bị xoá trên máy chủ, ord-p đang chờ gửi)', Object.keys(readIdb().stores.rows).length === 4);
} else if (scenario === 'd2-reconcile') {
  // Mô phỏng đúng hợp đồng của useCloudList khi tải toàn bộ (refetch full):
  // - refetch bị chặn khi còn thao tác chờ gửi (hasPending) và merge bỏ qua dòng đang chờ,
  //   nên dòng chờ gửi (ord-p) LUÔN còn trong danh sách trên máy với đúng object cũ;
  // - dòng từ máy chủ là object mới (fromRow); dòng bị máy chủ xoá (ord-c) không còn trong danh sách.
  // Nghĩa vụ của tầng cache: dòng còn trong danh sách thì giữ, dòng mất khỏi danh sách thì xoá khỏi kho.
  const loaded = await cacheLoadList('orders');
  const byId = new Map(loaded.items.map((x) => [x.id, x]));
  const next = [{ ...byId.get('ord-a'), status: 'done' }, { ...byId.get('ord-b') }, byId.get('ord-p')];
  await cacheSaveList('orders', next, meta('2026-11-20T00:04:00Z'));
  const idb = readIdb();
  check('dòng bị máy chủ xoá (ord-c) bị xoá khỏi kho — không sống lại', !('row:orders:ord-c' in idb.stores.rows));
  check('dòng đang chờ gửi (ord-p) vẫn còn nguyên trong kho', idb.stores.rows['row:orders:ord-p']?.localOnly === true);
  const reloaded = await cacheLoadList('orders');
  check('tải lại: đủ ord-a (đã sửa), ord-b, ord-p — không có ord-c', same(reloaded?.items?.map((x) => x.id), ['ord-a', 'ord-b', 'ord-p']));
} else if (scenario === 'e1-clear') {
  await cacheSaveList('orders', [order('o1'), order('o2')], meta('2026-11-20T00:00:00Z'));
  await syncCacheSet('queue', [{ table: 'orders', rowId: 'o1', spec: { kind: 'upsert' } }]);
  await cacheClear();
  const idb = readIdb();
  check('cacheClear: kho lists trống', Object.keys(idb.stores.lists).length === 0);
  check('cacheClear: kho rows trống', Object.keys(idb.stores.rows ?? {}).length === 0);
  check('cacheClear: kho sync còn nguyên hàng đợi chưa gửi', (idb.stores.sync.queue ?? []).length === 1);
} else if (scenario === 'e2-after-clear') {
  check('sau đăng xuất: không còn bản lưu tạm để hiện', (await cacheLoadList('orders')) === null);
  check('hàng đợi sync vẫn đọc được sau clear', (await syncCacheGet('queue'))?.length === 1);
  resetIdbOps();
  await cacheSaveList('orders', [order('o1'), order('o2')], meta('2026-11-20T00:05:00Z'));
  check('đăng nhập lại trong cùng phiên: lần lưu đầu ghi toàn bộ (ảnh chụp đã xoá cùng kho)', idbOps.put === 3);
  const loaded = await cacheLoadList('orders');
  check('tải lại sau khi lưu lại: đủ 2 dòng', same(loaded?.items?.map((x) => x.id), ['o1', 'o2']));
} else {
  console.error(`Không rõ kịch bản: ${scenario}`);
  process.exit(2);
}

console.log(failures ? `SCENARIO ${scenario}: ${failures} FAIL` : `SCENARIO ${scenario}: PASS`);
process.exit(failures ? 1 : 0);
