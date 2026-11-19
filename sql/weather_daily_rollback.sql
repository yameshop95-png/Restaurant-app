-- Gỡ thời tiết ngày. Chạy trong Supabase → SQL Editor khi cần hoàn tác.
-- Xoá view, hàm phụ, và bảng weather_daily. Không sửa bảng orders và không xoá đơn.

begin;

drop view if exists public.order_day_weather;
drop function if exists public.order_at(jsonb, timestamptz);
drop table if exists public.weather_daily;

commit;
