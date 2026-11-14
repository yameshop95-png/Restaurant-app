// Cầu nối in bill: chạy trên một máy tính ở quán (cùng mạng với máy in Uniwell).
// Đọc bảng print_jobs (do app nhân viên thêm vào), gửi lệnh ESC/POS xuống máy in qua cổng 9100, rồi đánh dấu đã in.
//
// Cách chạy (xem print-bridge/README.md):
//   SUPABASE_URL=... SUPABASE_KEY=... STAFF_PIN=xxxx PRINTER_IP=192.168.1.100 node bridge.mjs
import net from 'node:net';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const run = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_KEY, STAFF_PIN, PRINTER_NAME, PRINTER_IP = '192.168.1.100', PRINTER_PORT = 9100 } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !STAFF_PIN) {
  console.error('Thiếu SUPABASE_URL, SUPABASE_KEY hoặc STAFF_PIN');
  process.exit(1);
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
    process.exit(1);
  }
  if (data?.error) throw new Error('PIN máy in bị từ chối: ' + data.error);
  console.log(`[${stamp()}] Đã đăng nhập máy in "${data?.name ?? 'máy in'}"`);
}

async function printPending() {
  const { data: jobs, error } = await supabase
    .from('print_jobs')
    .select('id, payload, note')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(20);
  if (error) throw error;

  for (const job of jobs ?? []) {
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

async function main() {
  let delay = 2000;
  for (;;) {
    try {
      await login();
      console.log(`[${stamp()}] Đang chờ lệnh in từ điện thoại (${PRINTER_NAME ? 'máy in Windows ' + PRINTER_NAME : `máy in ${PRINTER_IP}:${PRINTER_PORT}`})`);
      for (;;) {
        await printPending();
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
