// Sao lưu dữ liệu quán gửi về email, chạy tự động mỗi tuần (Vercel cron, xem vercel.json).
// Lấy đơn hàng, khách hàng, thực đơn từ Supabase, ghép thành 1 file Excel giống nút "Sao lưu ngay" trong app
// (khôi phục bằng Cài đặt → khôi phục từ file) kèm 1 file JSON đầy đủ, rồi gửi bằng Resend.
//
// Biến môi trường cần đặt trong Vercel (Settings → Environment Variables):
//   CRON_SECRET          chuỗi bí mật bất kỳ; Vercel cron tự gửi kèm khi gọi, người ngoài không gọi được
//   SUPABASE_SERVICE_KEY khoá service_role của project Supabase (chỉ nằm ở máy chủ, không đưa vào app)
//   RESEND_API_KEY       khoá API của resend.com
//   BACKUP_EMAIL_TO      email nhận file sao lưu (với gói Resend miễn phí: đúng email đăng ký Resend)
//   BACKUP_EMAIL_FROM    tuỳ chọn, mặc định "onboarding@resend.dev"
import writeXlsxFile from 'write-excel-file/node';
import { customersSheet } from '../src/lib/customerExcel.js';
import { menuSheet } from '../src/lib/menuExcel.js';
import { ordersSheet } from '../src/lib/orderExcel.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://hgkqcswzggsbpusrhpue.supabase.co';
const RESEND_URL = process.env.RESEND_API_URL || 'https://api.resend.com/emails';
const PAGE = 1000;

// PostgREST trả tối đa 1000 dòng mỗi lần: đọc nối tiếp cho tới hết
async function fetchAll(table, key, order) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items' },
    });
    if (!res.ok) throw new Error(`Đọc bảng ${table} lỗi ${res.status}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

const pad = (n) => String(n).padStart(2, '0');
// Ngày theo giờ Úc (Sydney) để tên file và email khớp ngày của quán
const sydneyDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());

export default async function handler(req, res) {
  const { CRON_SECRET, SUPABASE_SERVICE_KEY, RESEND_API_KEY, BACKUP_EMAIL_TO, BACKUP_EMAIL_FROM } = process.env;
  const missing = Object.entries({ CRON_SECRET, SUPABASE_SERVICE_KEY, RESEND_API_KEY, BACKUP_EMAIL_TO })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) return res.status(500).json({ ok: false, error: `Thiếu biến môi trường: ${missing.join(', ')}` });

  // Vercel cron gửi "Authorization: Bearer <CRON_SECRET>"; chủ quán chạy thử tay bằng ?secret=...
  const secret = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '') || req.query?.secret;
  if (secret !== CRON_SECRET) return res.status(401).json({ ok: false, error: 'unauthorized' });

  try {
    const [orderRows, customerRows, menuRows] = await Promise.all([
      fetchAll('orders', SUPABASE_SERVICE_KEY, 'number.asc'),
      fetchAll('customers', SUPABASE_SERVICE_KEY, 'id.asc'),
      fetchAll('menu_items', SUPABASE_SERVICE_KEY, 'position.asc'),
    ]);
    const orders = orderRows.map((r) => ({ ...r.data, id: r.id, number: r.number }));
    const customers = customerRows.map((r) => ({ ...r.data, id: r.id }));
    const menu = menuRows.map((r) => ({ ...r.data, id: r.id, _position: r.position ?? 0 }));

    const sheets = [ordersSheet(orders), customersSheet(customers), menuSheet(menu)].map((s) => ({
      stickyRowsCount: 1,
      ...s,
    }));
    const xlsx = await writeXlsxFile(sheets).toBuffer();
    const json = Buffer.from(
      JSON.stringify({ exportedAt: new Date().toISOString(), orders: orderRows, customers: customerRows, menu_items: menuRows }),
    );

    const day = sydneyDate();
    const mail = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: BACKUP_EMAIL_FROM || 'onboarding@resend.dev',
        to: [BACKUP_EMAIL_TO],
        subject: `Sao lưu dữ liệu quán ${day}`,
        html:
          `<p>Sao lưu tự động ngày ${day}:</p><ul><li>${orders.length} đơn hàng</li><li>${customers.length} khách hàng</li>` +
          `<li>${menu.length} món</li></ul>` +
          '<p>File Excel khôi phục được trong app (Cài đặt). File JSON là bản đầy đủ để dự phòng. ' +
          'Hãy lưu email này lại, đừng chuyển cho người lạ vì có thông tin khách.</p>',
        attachments: [
          { filename: `sao-luu-${day}.xlsx`, content: xlsx.toString('base64') },
          { filename: `sao-luu-${day}.json`, content: json.toString('base64') },
        ],
      }),
    });
    const body = await mail.json().catch(() => ({}));
    if (!mail.ok) return res.status(502).json({ ok: false, error: 'Gửi email lỗi', status: mail.status, detail: body });
    return res.status(200).json({ ok: true, orders: orders.length, customers: customers.length, menu: menu.length, emailId: body.id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
