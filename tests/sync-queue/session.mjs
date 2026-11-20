// Một "phiên app" cho test hàng đợi đồng bộ: mỗi lần chạy file này là một lần mở app riêng
// (process mới = bộ nhớ mới), trạng thái bền (IndexedDB giả + máy chủ giả) nằm trong SYNC_TEST_DIR.
// Chạy qua run.mjs. Các spec ở đây chép đúng dạng các hàm write trong src/hooks/use* tạo ra.
import fs from 'node:fs';
import path from 'node:path';
import { installFakeIndexedDB } from './fake-indexeddb.mjs';

const dir = process.env.SYNC_TEST_DIR;
installFakeIndexedDB(dir);

const netFile = path.join(dir, 'net.json');
const serverFile = path.join(dir, 'server.json');
const idbFile = path.join(dir, 'idb.json');
const setNet = (n) => fs.writeFileSync(netFile, JSON.stringify(n));
const readServer = () => JSON.parse(fs.readFileSync(serverFile, 'utf8'));
const readIdb = () => JSON.parse(fs.readFileSync(idbFile, 'utf8'));
const seedServer = (tables) => fs.writeFileSync(serverFile, JSON.stringify({ tables }));

let failures = 0;
const check = (label, cond) => {
  console.log(`${cond ? 'ok' : 'FAIL'} - ${label}`);
  if (!cond) failures += 1;
};
const waitFor = async (cond, label, timeout = 6000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (cond()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  check(`chờ: ${label}`, false);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Ghi IndexedDB là bất đồng bộ (như bản lưu tạm sẵn có của app): chờ một nhịp rồi mới đọc file kiểm tra
const readIdbSettled = async () => {
  await sleep(200);
  return readIdb();
};

const scenario = process.argv[2];
const sync = await import('../../src/lib/sync.js');
const { enqueue, syncState, syncReady, retrySync, clearError, runFromSpec } = sync;
const op = (table, rowId, spec) => ({ table, rowId, spec, run: runFromSpec(spec) });
const upsertOrders = (rows) => ({ kind: 'upsert', table: 'orders', rows, select: true });
const patchOrder = (id, patch) => ({ kind: 'rpc', name: 'patch_data', args: { table_name: 'orders', row_id: id, patch } });

if (scenario === 's1-close-offline') {
  // Mất mạng: tạo đơn + thêm khách + sửa đơn, rồi "đóng app" (process thoát)
  setNet({ down: true });
  seedServer({});
  await syncReady();
  enqueue(op('orders', 'ord-1', upsertOrders([{ id: 'ord-1', data: { status: 'pending', note: 'v1' } }])));
  enqueue(op('customers', 'cus-1', { kind: 'upsert', table: 'customers', rows: [{ id: 'cus-1', data: { name: 'Khách A' } }] }));
  enqueue(op('orders', 'ord-1', patchOrder('ord-1', { status: 'done' })));
  await sleep(400);
  const st = syncState();
  check('mất mạng: 3 thao tác vẫn chờ trong hàng đợi', st.pending === 3);
  check('mất mạng: trạng thái offline bật', st.offline === true);
  const saved = readIdb().stores.sync.queue;
  check('hàng đợi đã lưu bền đủ 3 thao tác', Array.isArray(saved) && saved.length === 3);
  check('thao tác đã lưu giữ đúng thứ tự (tạo đơn trước, vá sau)', saved?.[0]?.spec?.kind === 'upsert' && saved?.[2]?.spec?.kind === 'rpc');
  check('máy chủ chưa nhận gì', !readServer().tables.orders?.['ord-1']);
} else if (scenario === 's2-reopen-online') {
  // Mở lại app khi đã có mạng: hàng đợi khôi phục tự gửi tiếp, đúng thứ tự, không trùng đơn
  setNet({});
  await syncReady();
  await waitFor(() => syncState().pending === 0, 'hàng đợi gửi hết');
  const server = readServer();
  check('đơn ord-1 đã lên máy chủ', Boolean(server.tables.orders?.['ord-1']));
  check('đơn chỉ có đúng 1 bản', Object.keys(server.tables.orders ?? {}).length === 1);
  check('lệnh vá sau khi tạo đã áp dụng (status = done)', server.tables.orders?.['ord-1']?.data?.status === 'done');
  check('khách cus-1 đã lên máy chủ', server.tables.customers?.['cus-1']?.data?.name === 'Khách A');
  check('không thao tác lỗi', syncState().failed === 0);
  check('hàng đợi đã lưu bền được dọn sạch', ((await readIdbSettled()).stores.sync.queue ?? []).length === 0);
} else if (scenario === 's3-close-edits') {
  // Tạo đơn lúc mất mạng, sửa cùng đơn đó 2 lần nữa, rồi đóng app
  setNet({ down: true });
  seedServer({});
  await syncReady();
  enqueue(op('orders', 'ord-2', upsertOrders([{ id: 'ord-2', data: { status: 'pending', note: 'v1' } }])));
  enqueue(op('orders', 'ord-2', patchOrder('ord-2', { note: 'v2' })));
  enqueue(op('orders', 'ord-2', patchOrder('ord-2', { note: 'v3', status: 'done' })));
  await sleep(400);
  check('3 thao tác (tạo + 2 lần sửa) còn nguyên trong hàng đợi', syncState().pending === 3);
  check('đã lưu bền đủ 3 thao tác', (readIdb().stores.sync.queue ?? []).length === 3);
} else if (scenario === 's4-reopen-edits') {
  setNet({});
  await syncReady();
  await waitFor(() => syncState().pending === 0, 'hàng đợi gửi hết');
  const row = readServer().tables.orders?.['ord-2'];
  check('đơn ord-2 đã lên máy chủ, đúng 1 bản', Boolean(row) && Object.keys(readServer().tables.orders).length === 1);
  check('bản sửa cuối thắng: note = v3', row?.data?.note === 'v3');
  check('bản sửa cuối thắng: status = done', row?.data?.status === 'done');
} else if (scenario === 's5-fail-close') {
  // Máy chủ từ chối (không phải lỗi mạng): thao tác không được vứt mất, kể cả khi đóng app
  setNet({ failPatch: true });
  seedServer({ orders: { 'ord-x': { id: 'ord-x', data: { status: 'pending' } } } });
  await syncReady();
  enqueue(op('orders', 'ord-x', patchOrder('ord-x', { status: 'done' })));
  await waitFor(() => syncState().failed === 1, 'thao tác bị từ chối được giữ lại');
  check('lỗi hiện cho người dùng', /permission denied/.test(syncState().error ?? ''));
  check('hàng đợi chính đã trống (không kẹt các thao tác sau)', syncState().pending === 0);
  check('thao tác lỗi đã lưu bền', (readIdb().stores.sync.failed ?? []).length === 1);
  check('máy chủ chưa bị sửa', readServer().tables.orders['ord-x'].data.status === 'pending');
} else if (scenario === 's6-reopen-failed') {
  // Mở lại app: thao tác lỗi vẫn còn; hết lỗi thì "Thử lại" gửi được; bỏ qua thì mất hẳn có chủ đích
  setNet({ failPatch: true });
  await syncReady();
  check('mở lại app: thao tác lỗi vẫn còn, không mất', syncState().failed === 1);
  setNet({});
  retrySync();
  await waitFor(() => syncState().failed === 0 && syncState().pending === 0, 'gửi lại thành công');
  check('sau Thử lại: máy chủ đã nhận bản vá', readServer().tables.orders['ord-x'].data.status === 'done');
  check('danh sách lỗi đã lưu bền được dọn', ((await readIdbSettled()).stores.sync.failed ?? []).length === 0);
  // Thêm một thao tác lỗi khác, rồi bấm bỏ qua (clearError): mất hẳn và không sống lại ở phiên sau
  setNet({ failPatch: true });
  enqueue(op('orders', 'ord-x', patchOrder('ord-x', { note: 'không gửi nữa' })));
  await waitFor(() => syncState().failed === 1, 'thao tác lỗi thứ hai được giữ lại');
  clearError();
  check('bỏ qua: danh sách lỗi trống ngay', syncState().failed === 0);
  check('bỏ qua: bản lưu bền cũng trống', ((await readIdbSettled()).stores.sync.failed ?? []).length === 0);
} else if (scenario === 's7-online') {
  // Đường có mạng phải y như cũ: gửi ngay, không để lại gì trong bản lưu bền
  setNet({});
  seedServer({});
  await syncReady();
  enqueue(op('orders', 'ord-9', upsertOrders([{ id: 'ord-9', data: { status: 'pending' } }])));
  await waitFor(() => syncState().pending === 0, 'gửi ngay khi có mạng');
  check('đơn đã lên máy chủ', Boolean(readServer().tables.orders?.['ord-9']));
  check('không còn gì trong hàng đợi đã lưu', ((await readIdbSettled()).stores.sync.queue ?? []).length === 0);
  check('không lỗi, không chờ', syncState().failed === 0 && syncState().error === null);
} else {
  console.error(`Không rõ kịch bản: ${scenario}`);
  process.exit(2);
}

console.log(failures ? `SCENARIO ${scenario}: ${failures} FAIL` : `SCENARIO ${scenario}: PASS`);
process.exit(failures ? 1 : 0);
