// Vercel Serverless Function: POST /api/analyze
// Nhận số liệu báo cáo đã tổng hợp (không có thông tin cá nhân của khách) và nhờ Claude phân tích.
// Cần biến môi trường ANTHROPIC_API_KEY trên Vercel. Tuỳ chọn AI_ACCESS_CODE: nếu đặt, app phải gửi đúng mã này.
import Anthropic from '@anthropic-ai/sdk';

const MAX_BODY_CHARS = 200_000;

const SYSTEM = `Bạn là chuyên gia phân tích kinh doanh cho một quán ăn Việt nhỏ ở Úc (tiền tệ AUD, ký hiệu A$).
Bạn nhận số liệu bán hàng đã tổng hợp của một kỳ (tuần, tháng hoặc năm) kèm kỳ trước và dự báo đơn giản.
Viết cho chủ quán đọc trên điện thoại: tiếng Việt, ngắn gọn, cụ thể, dùng đúng con số trong dữ liệu, không bịa số.
Nếu dữ liệu ít (vài đơn) hoặc kỳ đang diễn ra, nói rõ mức độ tin cậy thay vì kết luận chắc chắn.
Về giá: so sánh giá bán trung bình từng món với giá trung bình thực đơn và mức bán; nêu món nên giữ giá, có thể tăng nhẹ, hoặc nên khuyến mãi, kèm lý do. Không có dữ liệu chi phí nguyên liệu nên đừng khẳng định lãi/lỗ.
Về dự báo: dựa trên "du_bao" và xu hướng giữa kỳ này với kỳ trước; đưa ra một khoảng hợp lý cho kỳ tới và món nên chuẩn bị nhiều.
Mỗi mục 2–4 câu. "de_xuat" gồm 3–5 việc cụ thể chủ quán làm được ngay.`;

const SCHEMA = {
  type: 'object',
  properties: {
    tong_quan: { type: 'string', description: 'Tóm tắt tình hình kỳ này so với kỳ trước' },
    mon_ban_chay: { type: 'string', description: 'Món bán chạy, món tăng/giảm, món bán chậm' },
    gia_ban: { type: 'string', description: 'Nhận xét giá bán từng món có hợp lý không' },
    thoi_diem: { type: 'string', description: 'Thời điểm trong kỳ bán mạnh và món nổi bật lúc đó' },
    du_bao: { type: 'string', description: 'Dự báo doanh thu và món cần chuẩn bị cho kỳ tới' },
    de_xuat: { type: 'array', items: { type: 'string' }, description: 'Việc nên làm ngay' },
  },
  required: ['tong_quan', 'mon_ban_chay', 'gia_ban', 'thoi_diem', 'du_bao', 'de_xuat'],
  additionalProperties: false,
};

const client = new Anthropic();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ POST' });
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      error: 'Chưa cài AI: thêm biến ANTHROPIC_API_KEY trong Vercel → Settings → Environment Variables rồi deploy lại.',
    });
  }
  if (process.env.AI_ACCESS_CODE && req.headers['x-access-code'] !== process.env.AI_ACCESS_CODE) {
    return res.status(401).json({ error: 'Sai mã truy cập AI', needsCode: true });
  }

  const report = req.body?.report;
  const payload = JSON.stringify(report ?? null);
  if (!report || typeof report !== 'object') return res.status(400).json({ error: 'Thiếu số liệu báo cáo' });
  if (payload.length > MAX_BODY_CHARS) return res.status(413).json({ error: 'Số liệu quá lớn' });

  try {
    const message = await client.beta.messages
      .stream({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        // Nếu bị từ chối vì bộ lọc an toàn, API tự chạy lại trên model dự phòng phù hợp.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: SYSTEM,
        messages: [{ role: 'user', content: `Số liệu bán hàng (JSON):\n${payload}` }],
      })
      .finalMessage();

    if (message.stop_reason === 'refusal') {
      return res.status(502).json({ error: 'AI từ chối phân tích yêu cầu này, thử lại sau.' });
    }
    if (message.stop_reason === 'max_tokens') {
      return res.status(502).json({ error: 'Kết quả AI bị cắt ngang, thử lại.' });
    }
    const text = message.content.find((b) => b.type === 'text')?.text ?? '';
    return res.status(200).json({ analysis: JSON.parse(text), model: message.model });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return res.status(502).json({ error: 'ANTHROPIC_API_KEY không hợp lệ, kiểm tra lại trên Vercel.' });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'AI đang quá tải hoặc hết hạn mức, thử lại sau ít phút.' });
    }
    if (error instanceof Anthropic.APIError) {
      return res.status(502).json({ error: `Lỗi AI (${error.status ?? 'mạng'}): ${error.message}` });
    }
    if (error instanceof SyntaxError) {
      return res.status(502).json({ error: 'AI trả về dữ liệu không đọc được, thử lại.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Lỗi máy chủ khi phân tích' });
  }
}
