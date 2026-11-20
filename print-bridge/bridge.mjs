// Cầu nối in bill: chạy trên một máy tính ở quán (cùng mạng với máy in Uniwell).
// Đọc bảng print_jobs (do app nhân viên thêm vào), gửi lệnh ESC/POS xuống máy in qua cổng 9100, rồi đánh dấu đã in.
// Mỗi ngày (từ 2 giờ sáng) còn tự lưu một bản sao dữ liệu quán vào thư mục sao-luu cạnh file này, giữ 30 ngày.
//
// Cách chạy (xem print-bridge/README.md):
//   SUPABASE_URL=... SUPABASE_KEY=... STAFF_PIN=xxxx PRINTER_IP=192.168.1.100 node bridge.mjs
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
import { createClient } from '@supabase/supabase-js';
import { backupXlsx } from './backup-lib.mjs';

const {
  SUPABASE_URL,
  SUPABASE_KEY,
  STAFF_PIN,
  PRINTER_NAME,
  PRINTER_IP = '192.168.1.100',
  PRINTER_PORT = 9100,
  BACKUP_DIR = join(here, 'sao-luu'),
} = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !STAFF_PIN) {
  console.error('Thiếu SUPABASE_URL, SUPABASE_KEY hoặc STAFF_PIN');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleTimeString('vi-VN');

// Máy in USB đã cài trong Windows (PRINTER_NAME, ví dụ "Uniwell"): gửi dữ liệu thô qua raw-print.ps1
async function sendToWindowsPrinter(bytes) {
  const file = join(tmpdir(), `bill-${Date.now()}.bin`);
  await writeFile(file, bytes);
  try {
    await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(here, 'raw-print.ps1'), '-Printer', PRINTER_NAME, '-File', file]);
  } finally {
    await unlink(file).catch(() => {});
  }
}

// Gửi dữ liệu xuống máy in qua mạng (IP:9100); xong khi máy in nhận hết và đóng kết nối
function sendToPrinter(bytes) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host: PRINTER_IP, port: Number(PRINTER_PORT) });
    socket.setTimeout(8000);
    socket.on('connect', () => socket.end(Buffer.from(bytes)));
    socket.on('close', () => resolve());
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('máy in không phản hồi (quá 8 giây)'));
    });
    socket.on('error', reject);
  });
}

async function login() {
  const { error: anonError } = await supabase.auth.signInAnonymously();
  if (anonError) throw new Error('Không mở được phiên: ' + anonError.message);
  const { data, error } = await supabase.rpc('pin_login', { pin: STAFF_PIN });
  if (error) throw new Error('Không đăng nhập được bằng PIN: ' + error.message);
  if (data?.error === 'wrong') {
    // Thử lại với PIN sai chỉ làm máy bị khoá, nên dừng hẳn để bạn sửa PIN
    console.error('PIN sai. Kiểm tra mã PIN của tài khoản "Máy in quán" rồi chạy lại (đừng để nguyên chữ PIN_MAY_IN).');
    process.exit(2);
  }
  if (data?.error) throw new Error('PIN máy in bị từ chối: ' + data.error);
  console.log(`[${stamp()}] Đã đăng nhập máy in "${data?.name ?? 'máy in'}"`);
}

async function printPending() {
  const { data: jobs, error } = await supabase
    .from('print_jobs')
    .select('id, payload, note, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) throw error;

  for (const job of jobs ?? []) {
    // Bill gửi quá 6 tiếng (máy tính tắt cả buổi): không in nữa, tránh ra cả loạt bill cũ.
    // Muốn in thì bấm "In lại" trong app.
    if (Date.now() - new Date(job.created_at).getTime() > 6 * 3600000) {
      await supabase.from('print_jobs').update({ status: 'failed', error: 'Quá 6 tiếng chưa in, đã bỏ qua' }).eq('id', job.id).eq('status', 'pending');
      console.log(`[${stamp()}] Bỏ qua bill cũ: ${job.note ?? job.id}`);
      continue;
    }
    // Giữ chỗ bill trước khi in: nếu có 2 máy chạy bridge thì chỉ 1 máy in
    const { data: claimed } = await supabase
      .from('print_jobs')
      .update({ status: 'printing' })
      .eq('id', job.id)
      .eq('status', 'pending')
      .select('id');
    if (!claimed?.length) continue;
    try {
      const bytes = Buffer.from(job.payload, 'base64');
      if (PRINTER_NAME) await sendToWindowsPrinter(bytes);
      else await sendToPrinter(bytes);
      await supabase.from('print_jobs').update({ status: 'printed', printed_at: new Date().toISOString() }).eq('id', job.id);
      console.log(`[${stamp()}] In xong: ${job.note ?? job.id}`);
    } catch (err) {
      await supabase.from('print_jobs').update({ status: 'failed', error: String(err.message) }).eq('id', job.id);
      console.log(`[${stamp()}] Lỗi khi in ${job.note ?? job.id}: ${err.message}`);
    }
  }
}

// ---------- Sao lưu hằng ngày vào máy tính ----------
const BACKUP_KEEP_DAYS = 30;
const BACKUP_FROM_HOUR = 2; // sau 2 giờ sáng mới lưu bản của ngày đó (bật máy muộn hơn thì lưu ngay khi chạy)
const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// PostgREST trả tối đa 1000 dòng mỗi lần: đọc nối tiếp cho tới hết
async function fetchAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select('*').order(order).range(from, from + 999);
    if (error) throw new Error(`đọc bảng ${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

// Bảng của Inventory: tài khoản máy in có thể không được đọc (chỉ chủ quán) thì bỏ qua
async function fetchOptional(table) {
  try {
    return await fetchAll(table, 'id');
  } catch {
    return null;
  }
}

let lastBackupCheck = 0;
async function backupIfDue() {
  if (Date.now() - lastBackupCheck < 10 * 60 * 1000) return; // xét 10 phút một lần
  lastBackupCheck = Date.now();
  if (new Date().getHours() < BACKUP_FROM_HOUR) return;
  const day = dayKey();
  const xlsxFile = join(BACKUP_DIR, `sao-luu-${day}.xlsx`);
  if (existsSync(xlsxFile)) return;
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
    const [orderRows, customerRows, menuRows] = await Promise.all([
      fetchAll('orders', 'number'),
      fetchAll('customers', 'id'),
      fetchAll('menu_items', 'position'),
    ]);
    const inventory = {};
    for (const t of ['inv_ingredients', 'inv_purchases', 'inv_adjustments', 'inv_expenses', 'inv_recipes', 'inv_batches']) {
      const rows = await fetchOptional(t);
      if (rows?.length) inventory[t] = rows;
    }
    const json = { exportedAt: new Date().toISOString(), orders: orderRows, customers: customerRows, menu_items: menuRows, ...inventory };
    await writeFile(join(BACKUP_DIR, `sao-luu-${day}.json`), JSON.stringify(json));
    await writeFile(xlsxFile, await backupXlsx({ orderRows, customerRows, menuRows }));
    console.log(
      `[${stamp()}] Đã sao lưu vào ${BACKUP_DIR}: ${orderRows.length} đơn, ${customerRows.length} khách, ${menuRows.length} món` +
        (Object.keys(inventory).length ? ', kèm dữ liệu kho' : ''),
    );
    // Xoá bản cũ hơn 30 ngày
    const oldest = new Date();
    oldest.setDate(oldest.getDate() - BACKUP_KEEP_DAYS);
    for (const name of await readdir(BACKUP_DIR)) {
      const m = name.match(/^sao-luu-(\d{4}-\d{2}-\d{2})\.(xlsx|json)$/);
      if (m && m[1] < dayKey(oldest)) await unlink(join(BACKUP_DIR, name)).catch(() => {});
    }
  } catch (err) {
    // Lỗi sao lưu không được làm ngừng việc in: ghi lại rồi thử lại sau 10 phút
    console.log(`[${stamp()}] Chưa sao lưu được: ${err.message}. Thử lại sau 10 phút`);
  }
}

async function main() {
  let delay = 2000;
  for (;;) {
    try {
      await login();
      console.log(`[${stamp()}] Đang chờ lệnh in từ điện thoại (${PRINTER_NAME ? 'máy in Windows ' + PRINTER_NAME : `máy in ${PRINTER_IP}:${PRINTER_PORT}`})`);
      for (;;) {
        await printPending();
        await backupIfDue();
        await sleep(2000);
      }
    } catch (err) {
      console.log(`[${stamp()}] ${err.message}. Thử lại sau ${Math.round(delay / 1000)} giây`);
      await sleep(delay);
      delay = Math.min(delay * 2, 60000);
    }
  }
}

main();
