-- Theo dõi khách trên website (tab "Customer Active" trong app nhân viên).
-- Chạy MỘT LẦN trong SQL Editor của project restaurant-app. Chạy lại cũng an toàn.
--
-- Website gửi tình trạng của từng phiên truy cập (đang xem menu / có món trong giỏ / đang ở trang đặt món / đã đặt)
-- qua hàm track_session. Khách đã gõ tên / số điện thoại / email mà chưa đặt thì được lưu lại để quán gọi lại.
-- Không ai đọc / ghi trực tiếp vào bảng được: website chỉ gọi track_session, nhân viên chỉ gọi customer_activity.
--
-- Bổ sung cho thẻ "Hoạt Động Khách Hàng Website": mỗi phiên gửi kèm mã khách bền (vid, để biết
-- khách quay lại), nguồn truy cập lúc đáp vào web (referrer + utm), loại thiết bị, múi giờ và
-- số lượt xem từng trang (paths). Các cột này thêm bằng alter ... if not exists nên file chạy
-- lại trên máy chủ đã cài bản cũ vẫn an toàn; customer_activity trả thêm khoá "insights"
-- (30 ngày + xu hướng 8 tuần), các khoá cũ giữ nguyên.

create table if not exists public.web_sessions (
  sid uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  stage text not null default 'browsing' check (stage in ('browsing', 'cart', 'checkout', 'ordered')),
  max_stage int not null default 0,          -- bước xa nhất đã tới: 0 xem menu · 1 có món · 2 vào trang đặt · 3 đã đặt
  cart_count int not null default 0,
  cart_total numeric not null default 0,
  items text,                                -- ví dụ "2× Bánh cuốn, 1× Giò lụa"
  name text,
  phone text,
  email text,
  lang text,
  path text,
  ordered boolean not null default false,
  order_number int,
  handled boolean not null default false     -- nhân viên đã gọi lại / bỏ qua
);

create index if not exists web_sessions_last_seen_idx on public.web_sessions (last_seen desc);
create index if not exists web_sessions_first_seen_idx on public.web_sessions (first_seen desc);

-- Cột phân tích (bản cũ chưa có): mã khách bền, nguồn, thiết bị, múi giờ, thẻ utm, lượt xem theo trang
alter table public.web_sessions add column if not exists vid uuid;
alter table public.web_sessions add column if not exists source text;
alter table public.web_sessions add column if not exists device text;
alter table public.web_sessions add column if not exists tz text;
alter table public.web_sessions add column if not exists utm_source text;
alter table public.web_sessions add column if not exists utm_medium text;
alter table public.web_sessions add column if not exists utm_campaign text;
alter table public.web_sessions add column if not exists paths jsonb not null default '{}'::jsonb;

create index if not exists web_sessions_vid_idx on public.web_sessions (vid) where vid is not null;

alter table public.web_sessions enable row level security;   -- không có policy nào: không ai đụng trực tiếp được
revoke all on public.web_sessions from anon, authenticated;

-- Website (không đăng nhập) gọi hàm này mỗi ~20 giây và mỗi khi khách đổi bước / gõ thông tin
create or replace function public.track_session(payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sid uuid;
  v_stage text := coalesce(payload ->> 'stage', 'browsing');
  v_rank int;
  v_count int;
  v_total numeric;
  v_items text := nullif(left(coalesce(payload ->> 'items', ''), 300), '');
  v_name text := nullif(left(btrim(coalesce(payload ->> 'name', '')), 80), '');
  v_phone text := nullif(left(btrim(coalesce(payload ->> 'phone', '')), 30), '');
  v_email text := nullif(left(btrim(coalesce(payload ->> 'email', '')), 120), '');
  v_lang text := case when payload ->> 'lang' in ('vi', 'en') then payload ->> 'lang' else null end;
  v_path text := nullif(left(coalesce(payload ->> 'path', ''), 120), '');
  v_order int;
  v_vid uuid;
  v_source text := case when payload ->> 'source' in ('google', 'facebook', 'instagram', 'zalo', 'direct', 'other') then payload ->> 'source' else null end;
  v_device text := case when payload ->> 'device' in ('mobile', 'tablet', 'desktop') then payload ->> 'device' else null end;
  v_tz text := nullif(left(coalesce(payload ->> 'tz', ''), 60), '');
  v_utm_source text := nullif(left(coalesce(payload ->> 'utm_source', ''), 80), '');
  v_utm_medium text := nullif(left(coalesce(payload ->> 'utm_medium', ''), 80), '');
  v_utm_campaign text := nullif(left(coalesce(payload ->> 'utm_campaign', ''), 120), '');
  v_paths jsonb := '{}'::jsonb;
begin
  begin
    v_sid := (payload ->> 'sid')::uuid;
  exception when others then
    return;
  end;
  if v_sid is null then return; end if;

  begin v_count := least(greatest(coalesce((payload ->> 'cart_count')::int, 0), 0), 500); exception when others then v_count := 0; end;
  begin v_total := least(greatest(coalesce((payload ->> 'cart_total')::numeric, 0), 0), 100000); exception when others then v_total := 0; end;
  begin v_order := (payload ->> 'order_number')::int; exception when others then v_order := null; end;
  begin v_vid := (payload ->> 'vid')::uuid; exception when others then v_vid := null; end;

  -- Lượt xem theo trang: chỉ nhận object {path: số lần}; khoá cắt 120 ký tự, số lần kẹp
  -- 0–10000, tối đa 20 trang. Dữ liệu lạ ở bất kỳ đâu thì coi như không có.
  begin
    if jsonb_typeof(payload -> 'paths') = 'object' then
      select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) into v_paths
      from (
        select left(e.key, 120) as k,
               least(greatest(case when jsonb_typeof(e.value) = 'number' then (e.value::text)::int else 0 end, 0), 10000) as v
        from jsonb_each(payload -> 'paths') e
        limit 20
      ) s;
    end if;
  exception when others then
    v_paths := '{}'::jsonb;
  end;

  if v_stage not in ('browsing', 'cart', 'checkout', 'ordered') then v_stage := 'browsing'; end if;
  v_rank := case v_stage when 'browsing' then 0 when 'cart' then 1 when 'checkout' then 2 else 3 end;
  if v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then v_phone := null; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then v_email := null; end if;

  if exists (select 1 from public.web_sessions where sid = v_sid) then
    update public.web_sessions ws set
      last_seen = now(),
      stage = v_stage,
      max_stage = greatest(max_stage, v_rank),
      cart_count = v_count,
      cart_total = v_total,
      items = v_items,
      name = coalesce(v_name, name),
      phone = coalesce(v_phone, phone),
      email = coalesce(v_email, email),
      lang = coalesce(v_lang, lang),
      path = coalesce(v_path, path),
      ordered = ordered or v_stage = 'ordered',
      order_number = coalesce(v_order, order_number),
      -- Điểm chạm đầu tiên: chỉ ghi khi đang trống, không ghi đè các lần báo sau
      vid = coalesce(ws.vid, v_vid),
      source = coalesce(ws.source, v_source),
      device = coalesce(ws.device, v_device),
      tz = coalesce(ws.tz, v_tz),
      utm_source = coalesce(ws.utm_source, v_utm_source),
      utm_medium = coalesce(ws.utm_medium, v_utm_medium),
      utm_campaign = coalesce(ws.utm_campaign, v_utm_campaign),
      -- Lượt xem theo trang: cộng dồn số đếm theo từng trang, giữ 20 trang xem nhiều nhất
      paths = coalesce((
        select jsonb_object_agg(k, v)
        from (
          select key as k, sum(val)::int as v
          from (
            select key, (value::text)::int as val from jsonb_each(ws.paths)
            union all
            select key, (value::text)::int as val from jsonb_each(v_paths)
          ) u
          group by key
          order by v desc
          limit 20
        ) t
      ), '{}'::jsonb)
    where ws.sid = v_sid;
  else
    -- Chống tràn: tối đa 200 phiên mới mỗi phút trên toàn website
    if (select count(*) from public.web_sessions where first_seen > now() - interval '1 minute') >= 200 then
      return;
    end if;
    insert into public.web_sessions (sid, stage, max_stage, cart_count, cart_total, items, name, phone, email, lang, path, ordered, order_number, vid, source, device, tz, utm_source, utm_medium, utm_campaign, paths)
    values (v_sid, v_stage, v_rank, v_count, v_total, v_items, v_name, v_phone, v_email, v_lang, v_path, v_stage = 'ordered', v_order, v_vid, v_source, v_device, v_tz, v_utm_source, v_utm_medium, v_utm_campaign, v_paths);
  end if;

  -- Dọn dần: giữ dữ liệu 90 ngày
  if random() < 0.01 then
    delete from public.web_sessions where last_seen < now() - interval '90 days';
  end if;
end;
$$;

-- App nhân viên: số liệu trực tiếp + tỉ lệ + danh sách khách bỏ dở
create or replace function public.customer_activity()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz constant text := 'Australia/Sydney';
  day_start timestamptz := date_trunc('day', now() at time zone tz) at time zone tz;
  idle constant interval := interval '10 minutes';   -- im lặng quá 10 phút mà chưa đặt = bỏ dở
  since30 timestamptz := day_start - interval '29 days';   -- cùng mốc với periods.days30
  live jsonb;
  periods jsonb;
  abandoned jsonb;
  v_insights jsonb;
  v_avg_duration int;
  v_duration_buckets jsonb;
  v_with_vid int;
  v_returning int;
  v_sources jsonb;
  v_devices jsonb;
  v_timezones jsonb;
  v_top_pages jsonb;
  v_weekly jsonb;
begin
  if not public.is_member() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'online', count(*),
    'browsing', count(*) filter (where stage = 'browsing'),
    'cart', count(*) filter (where stage = 'cart'),
    'checkout', count(*) filter (where stage = 'checkout'),
    'ordered', count(*) filter (where stage = 'ordered')
  ) into live
  from public.web_sessions
  where last_seen > now() - interval '90 seconds';

  select jsonb_object_agg(p.key, p.stats) into periods
  from (
    select k.key, (
      select jsonb_build_object(
        'visits', count(*),
        'with_cart', count(*) filter (where s.max_stage >= 1),
        'checkout', count(*) filter (where s.max_stage >= 2),
        'ordered', count(*) filter (where s.ordered),
        'abandoned', count(*) filter (where not s.ordered and s.max_stage >= 1 and s.last_seen < now() - idle),
        'abandoned_with_contact', count(*) filter (where not s.ordered and s.last_seen < now() - idle and (s.phone is not null or s.email is not null)),
        'web_orders', (select count(*) from public.orders o where (o.data ->> 'source') = 'web' and o.created_at >= k.since)
      )
      from public.web_sessions s
      where s.first_seen >= k.since
    ) as stats
    from (values
      ('today', day_start),
      ('days7', day_start - interval '6 days'),
      ('days30', day_start - interval '29 days')
    ) as k(key, since)
  ) p;

  select coalesce(jsonb_agg(row_to_json(a)::jsonb order by a.last_seen desc), '[]'::jsonb) into abandoned
  from (
    select sid, name, phone, email, items, cart_total, cart_count, max_stage, last_seen, lang
    from public.web_sessions
    where not ordered
      and not handled
      and last_seen < now() - idle
      and last_seen > now() - interval '14 days'
      and (phone is not null or email is not null)   -- chỉ liệt kê khách để lại cách liên lạc
    order by last_seen desc
    limit 100
  ) a;

  -- ===== Phân tích 30 ngày + xu hướng 8 tuần cho thẻ "Hoạt Động Khách Hàng Website" =====
  -- Mọi con số suy ra từ dữ liệu phiên đã thu (first_seen / last_seen / max_stage / vid /
  -- source / device / tz / paths); phễu và KPI của thẻ dùng lại periods.days30 ở trên.
  -- "Tương tác sâu" (engaged) = phiên ở lại ≥ 60 giây HOẶC đã tới bước có món trong giỏ
  -- trở lên (max_stage ≥ 1).

  -- Thời lượng phiên (last_seen − first_seen) trong 30 ngày: trung bình + phân bố theo nhóm
  select coalesce(round(avg(extract(epoch from (last_seen - first_seen))))::int, 0),
         jsonb_build_object(
           'lt60', count(*) filter (where extract(epoch from (last_seen - first_seen)) < 60),
           's60_300', count(*) filter (where extract(epoch from (last_seen - first_seen)) >= 60 and extract(epoch from (last_seen - first_seen)) < 300),
           's300_900', count(*) filter (where extract(epoch from (last_seen - first_seen)) >= 300 and extract(epoch from (last_seen - first_seen)) < 900),
           'gte900', count(*) filter (where extract(epoch from (last_seen - first_seen)) >= 900)
         )
  into v_avg_duration, v_duration_buckets
  from public.web_sessions
  where first_seen >= since30;

  -- Khách quay lại: phiên có vid mà cùng vid đã có một phiên khác bắt đầu trước đó
  -- (xét trên toàn bộ dữ liệu còn giữ, không chỉ trong 30 ngày)
  select count(*), coalesce(sum(case when has_prev then 1 else 0 end), 0)
  into v_with_vid, v_returning
  from (
    select exists (
             select 1 from public.web_sessions p
             where p.vid = s.vid and p.first_seen < s.first_seen
           ) as has_prev
    from public.web_sessions s
    where s.first_seen >= since30 and s.vid is not null
  ) q;

  -- Nguồn truy cập + thiết bị (phiên trước khi có cột này thì tính là 'unknown')
  select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) into v_sources
  from (
    select coalesce(s.source, 'unknown') as k, count(*) as c
    from public.web_sessions s
    where s.first_seen >= since30
    group by 1
  ) g;

  select coalesce(jsonb_object_agg(k, c), '{}'::jsonb) into v_devices
  from (
    select coalesce(s.device, 'unknown') as k, count(*) as c
    from public.web_sessions s
    where s.first_seen >= since30
    group by 1
  ) g;

  -- Múi giờ phổ biến (đại diện thô cho vị trí khách), tối đa 5
  select coalesce(jsonb_agg(jsonb_build_object('tz', t.tzv, 'sessions', t.c) order by t.c desc, t.tzv), '[]'::jsonb)
  into v_timezones
  from (
    select s.tz as tzv, count(*) as c
    from public.web_sessions s
    where s.first_seen >= since30 and s.tz is not null
    group by s.tz
    order by c desc, tzv
    limit 5
  ) t;

  -- Trang được xem nhiều nhất: cộng lượt xem theo path trên mọi phiên trong 30 ngày
  select coalesce(jsonb_agg(jsonb_build_object('path', t.pth, 'views', t.vw) order by t.vw desc, t.pth), '[]'::jsonb)
  into v_top_pages
  from (
    select e.key as pth, sum((e.value::text)::int) as vw
    from public.web_sessions s, jsonb_each(s.paths) e
    where s.first_seen >= since30
    group by e.key
    order by vw desc, pth
    limit 8
  ) t;

  -- Xu hướng 8 tuần gần nhất (tuần bắt đầu Thứ Hai theo giờ quán, gồm cả tuần hiện tại):
  -- visits = số phiên bắt đầu trong tuần; engaged theo định nghĩa ở trên.
  -- Lưu ý: trong câu này phải ghi literal 'Australia/Sydney' thay vì biến tz, vì web_sessions
  -- nay có cột tên "tz" — dùng tên trần sẽ bị plpgsql coi là mơ hồ (biến hay cột?) khi chạy.
  select coalesce(jsonb_agg(w.obj order by w.ws), '[]'::jsonb) into v_weekly
  from (
    select gs.ws,
           jsonb_build_object(
             'start', to_char(gs.ws, 'YYYY-MM-DD'),
             'visits', count(s.sid),
             'engaged', count(s.sid) filter (where extract(epoch from (s.last_seen - s.first_seen)) >= 60 or s.max_stage >= 1)
           ) as obj
    from (
      select generate_series(
               date_trunc('week', (now() at time zone 'Australia/Sydney')) - interval '7 weeks',
               date_trunc('week', (now() at time zone 'Australia/Sydney')),
               interval '1 week'
             ) as ws
    ) gs
    left join public.web_sessions s
      on date_trunc('week', (s.first_seen at time zone 'Australia/Sydney')) = gs.ws
    group by gs.ws
  ) w;

  v_insights := jsonb_build_object(
    'window_days', 30,
    'avg_duration_sec', v_avg_duration,
    'duration_buckets', v_duration_buckets,
    'returning', jsonb_build_object(
      'with_vid', v_with_vid,
      'returning', v_returning,
      'pct', case when v_with_vid > 0 then round(100.0 * v_returning / v_with_vid, 1) else null end
    ),
    'sources', v_sources,
    'devices', v_devices,
    'timezones', v_timezones,
    'top_pages', v_top_pages,
    'weekly', v_weekly
  );

  return jsonb_build_object('now', now(), 'live', live, 'periods', periods, 'abandoned', abandoned, 'insights', v_insights);
end;
$$;

-- Nhân viên đánh dấu "đã xử lý" hoặc xoá hẳn thông tin một khách bỏ dở
create or replace function public.handle_web_session(p_sid uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_member() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action = 'delete' then
    delete from public.web_sessions where sid = p_sid;
  elsif p_action = 'handled' then
    update public.web_sessions set handled = true where sid = p_sid;
  end if;
end;
$$;

revoke all on function public.track_session(jsonb) from public, anon, authenticated;
grant execute on function public.track_session(jsonb) to anon, authenticated;
revoke all on function public.customer_activity() from public, anon, authenticated;
grant execute on function public.customer_activity() to authenticated;
revoke all on function public.handle_web_session(uuid, text) from public, anon, authenticated;
grant execute on function public.handle_web_session(uuid, text) to authenticated;
