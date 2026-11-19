-- Thời tiết ngày ở Wodonga (giữa thành phố, -36.12, 146.89), để sau này đối chiếu với đơn.
-- Chỉ THÊM bảng mới và một view. Không sửa bảng orders, không khoá ngoại.
-- Chạy một lần trong Supabase → SQL Editor. Chạy lại cũng được. Chưa bật lịch lấy dữ liệu
-- (lịch nằm ở .github/workflows/weather-daily.yml, chỉ chạy sau khi gộp vào nhánh chính).
-- Gỡ: sql/weather_daily_rollback.sql

begin;

create table if not exists public.weather_daily (
  date date primary key,
  temp_max numeric,
  temp_min numeric,
  precipitation_mm numeric,
  weather_code integer,
  condition text,
  source text not null,
  fetched_at timestamptz not null default now(),
  constraint weather_daily_source_chk check (source in ('forecast', 'archive')),
  constraint weather_daily_precip_chk check (precipitation_mm is null or precipitation_mm >= 0)
);

comment on table public.weather_daily is
  'Thời tiết theo ngày lịch Australia/Melbourne tại Wodonga (-36.12, 146.89). source=forecast bị ghi đè khi có source=archive.';
comment on column public.weather_daily.date is 'Ngày theo múi giờ Australia/Melbourne.';
comment on column public.weather_daily.source is 'forecast: dự báo (MET Norway). archive: số liệu ngày đã qua (NASA POWER).';

alter table public.weather_daily enable row level security;

-- Đọc: cùng cách các bảng nhân viên được xem (đã đăng nhập PIN, is_member).
-- Ghi: không cấp cho app. Job hằng ngày dùng service role (bỏ qua RLS) để upsert.
-- App không ghi bảng này khi mở trang.
drop policy if exists "thành viên xem thời tiết" on public.weather_daily;
create policy "thành viên xem thời tiết"
  on public.weather_daily
  for select
  to authenticated
  using ((select public.is_member()));

revoke all on table public.weather_daily from public, anon, authenticated;
grant select on table public.weather_daily to authenticated;

-- Giờ của đơn: createdAt trong JSON (đơn khôi phục giữ giờ cũ); nếu trống hoặc hỏng thì dùng created_at.
create or replace function public.order_at(data jsonb, created_at timestamptz)
returns timestamptz
language plpgsql
immutable
set search_path to ''
as $$
declare
  raw text := data->>'createdAt';
begin
  if raw ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T' then
    return raw::timestamptz;
  end if;
  return created_at;
exception when others then
  return created_at;
end;
$$;

revoke all on function public.order_at(jsonb, timestamptz) from public, anon;
grant execute on function public.order_at(jsonb, timestamptz) to authenticated;

-- Nối đơn với thời tiết theo ngày Melbourne. security_invoker: view tuân RLS của orders và weather_daily.
create or replace view public.order_day_weather
with (security_invoker = true) as
select
  o.id as order_id,
  (public.order_at(o.data, o.created_at) at time zone 'Australia/Melbourne')::date as order_date,
  w.temp_max,
  w.temp_min,
  w.precipitation_mm,
  w.weather_code,
  w.condition,
  w.source as weather_source
from public.orders o
left join public.weather_daily w
  on w.date = (public.order_at(o.data, o.created_at) at time zone 'Australia/Melbourne')::date;

comment on view public.order_day_weather is
  'Mỗi đơn và thời tiết của ngày đặt theo lịch Australia/Melbourne. Không sao chép cột sang bảng orders.';

revoke all on table public.order_day_weather from public, anon, authenticated;
grant select on table public.order_day_weather to authenticated;

commit;
