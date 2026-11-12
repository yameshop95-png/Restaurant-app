// Cầu nối in bill: chạy trên một máy tính ở quán (cùng mạng với máy in Uniwell).
// Đọc bảng print_jobs (do app nhân viên thêm vào), gửi lệnh ESC/POS xuống máy in qua cổng 9100, rồi đánh dấu đã in.
//
// Cách chạy (xem print-bridge/README.md):
//   SUPABASE_URL=... SUPABASE_KEY=... STAFF_PIN=xxxx PRINTER_IP=192.168.1.100 node bridge.mjs
import net from 'node:net';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_KEY, STAFF_PIN, PRINTER_IP = '192.168.1.100', PRINTER_PORT = 9100 } = process.env;
if (!SUPABASE_URL || !SUPABASE_KEY || !STAFF_PIN) {
  console.error('Thiếu SUPABASE_URL, SUPABASE_KEY hoặc STAFF_PIN');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toLocaleTimeString('vi-VN');

// Gửi dữ liệu xuống máy in; xong khi máy in nhận hết và đóng kết nối
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
      await sendToPrinter(Buffer.from(job.payload, 'base64'));
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
      console.log(`[${stamp()}] Đang chờ lệnh in từ điện thoại (máy in ${PRINTER_IP}:${PRINTER_PORT})`);
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
