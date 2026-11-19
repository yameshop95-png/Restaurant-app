-- =====================================================================
-- LỊCH DỌN ĐƠN THỬ — bản mới (17/11/2026). Chạy 1 lần trong Supabase → SQL Editor.
-- Thay lịch cũ 'reset-test-orders' (lịch cũ xoá MỌI đơn tạo trước 28/11, kể cả
-- đơn sổ giấy nhập từ Excel).
--
-- Lịch mới, 3 giờ sáng 28/11 (giờ Úc):
--   • Xoá đơn thử: đơn tạo trước giờ đó, TRỪ đơn nhập từ sổ giấy (mã bắt đầu "so-").
--   • Giữ nguyên đơn sổ giấy tuần 1–28 (số đơn 0) → đơn khách thật đầu tiên vẫn là #79.
--   • Chạy xong tự xoá lịch.
-- =====================================================================

-- Bỏ lịch cũ (nếu còn)
select cron.unschedule(jobid) from cron.job where jobname = 'reset-test-orders';

select cron.schedule(
  'reset-test-orders',
  '0 16 27 11 *',
  $$
    delete from public.orders
    where id not like 'so-%'
      and coalesce((data->>'createdAt')::timestamptz, '-infinity') < '2026-11-27 16:00+00';
    select cron.unschedule('reset-test-orders');
  $$
);

-- Kiểm tra: 1 dòng, cột command phải có "not like 'so-%'"
select jobname, schedule, command from cron.job where jobname = 'reset-test-orders';
