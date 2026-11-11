// Gọi nhẹ máy chủ mỗi ngày (Vercel cron, xem vercel.json) để project Supabase gói Free không bị tạm dừng vì ít hoạt động.
// Chỉ đọc thông tin công khai (public_shop), không ghi gì. Khoá dùng là publishable key, vốn đã có trong website.
const URL = process.env.VITE_SUPABASE_URL || 'https://hgkqcswzggsbpusrhpue.supabase.co';
const KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_qm7OXVxaPuwAhAB2zjOXow_7zBFNnON';

export default async function handler(req, res) {
  try {
    const r = await fetch(`${URL}/rest/v1/rpc/public_shop`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: '{}',
    });
    res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() });
  } catch (err) {
    res.status(502).json({ ok: false, error: String(err) });
  }
}
