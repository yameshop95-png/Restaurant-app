// Supabase giả cho test hàng đợi đồng bộ: "máy chủ" là file server.json trong thư mục phiên,
// mạng điều khiển bằng file net.json ({ down: true } = mất mạng, { failPatch: true } = máy chủ từ chối patch_data).
// Chỉ dùng cho test (tests/sync-queue) — esbuild thay module src/lib/supabase bằng file này khi đóng gói test,
// app thật không bao giờ chạy file này.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.env.SYNC_TEST_DIR;
const serverFile = path.join(dir, 'server.json');
const netFile = path.join(dir, 'net.json');

const readJson = (f, fallback) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fallback;
  }
};
const readDb = () => readJson(serverFile, { tables: {} });
const writeDb = (db) => fs.writeFileSync(serverFile, JSON.stringify(db));
const net = () => readJson(netFile, {});

const netError = () => ({ data: null, error: { message: 'TypeError: fetch failed' } }); // không có code → lỗi mạng
const denied = (what) => ({ data: null, error: { code: '42501', message: `permission denied for ${what}` } });

// Giống hệt src/lib/supabase.js
export const isNetworkError = (error) => !error?.code || /fetch|network|timeout|load failed/i.test(error.message ?? '');

class Query {
  constructor(table, action, payload) {
    this.table = table;
    this.action = action;
    this.payload = payload;
  }
  select() {
    this.wantSelect = true;
    return this;
  }
  eq(_key, value) {
    this.idValue = value;
    return this;
  }
  then(res, rej) {
    return Promise.resolve()
      .then(() => this.exec())
      .then(res, rej);
  }
  exec() {
    if (net().down) return netError();
    const db = readDb();
    const t = (db.tables[this.table] ??= {});
    if (this.action === 'upsert') {
      for (const row of this.payload) t[row.id] = JSON.parse(JSON.stringify(row));
      writeDb(db);
      return { data: this.wantSelect ? this.payload.map((r) => ({ ...t[r.id] })) : null, error: null };
    }
    if (this.action === 'delete') {
      delete t[this.idValue];
      writeDb(db);
      return { data: null, error: null };
    }
    if (this.action === 'update') {
      if (t[this.idValue]) Object.assign(t[this.idValue], JSON.parse(JSON.stringify(this.payload)));
      writeDb(db);
      return { data: null, error: null };
    }
    return { data: null, error: null };
  }
}

function rpcExec(name, args) {
  if (net().down) return netError();
  const db = readDb();
  if (name === 'patch_data') {
    if (net().failPatch) return denied('patch_data');
    const row = db.tables[args.table_name]?.[args.row_id];
    // Giống máy chủ thật: vá cột data theo từng trường cấp 1; không có dòng thì vẫn báo thành công (0 dòng)
    if (row) Object.assign(row.data, JSON.parse(JSON.stringify(args.patch)));
    writeDb(db);
    return { data: null, error: null };
  }
  if (name === 'set_menu_available') {
    const row = db.tables.menu_items?.[args.item_id];
    if (row) row.data.available = args.is_available;
    writeDb(db);
    return { data: null, error: null };
  }
  return { data: null, error: { code: '42883', message: `function ${name} does not exist` } };
}

export const supabase = {
  from: (table) => ({
    upsert: (rows) => new Query(table, 'upsert', rows),
    delete: () => new Query(table, 'delete'),
    update: (values) => new Query(table, 'update', values),
  }),
  rpc: (name, args) => ({ then: (res, rej) => Promise.resolve().then(() => rpcExec(name, args)).then(res, rej) }),
};
