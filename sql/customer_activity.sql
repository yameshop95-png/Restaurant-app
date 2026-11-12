-- Theo dõi khách trên website (tab "Customer Active" trong app nhân viên).
-- Chạy MỘT LẦN trong SQL Editor của project restaurant-app. Chạy lại cũng an toàn.
--
-- Website gửi tình trạng của từng phiên truy cập (đang xem menu / có món trong giỏ / đang ở trang đặt món / đã đặt)
-- qua hàm track_session. Khách đã gõ tên / số điện thoại / email mà chưa đặt thì được lưu lại để quán gọi lại.
-- Không ai đọc / ghi trực tiếp vào bảng được: website chỉ gọi track_session, nhân viên chỉ gọi customer_activity.

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

  if v_stage not in ('browsing', 'cart', 'checkout', 'ordered') then v_stage := 'browsing'; end if;
  v_rank := case v_stage when 'browsing' then 0 when 'cart' then 1 when 'checkout' then 2 else 3 end;
  if v_phone is not null and length(regexp_replace(v_phone, '\D', '', 'g')) < 8 then v_phone := null; end if;
  if v_email is not null and v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then v_email := null; end if;

  if exists (select 1 from public.web_sessions where sid = v_sid) then
    update public.web_sessions set
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
      order_number = coalesce(v_order, order_number)
    where sid = v_sid;
  else
    -- Chống tràn: tối đa 200 phiên mới mỗi phút trên toàn website
    if (select count(*) from public.web_sessions where first_seen > now() - interval '1 minute') >= 200 then
      return;
    end if;
    insert into public.web_sessions (sid, stage, max_stage, cart_count, cart_total, items, name, phone, email, lang, path, ordered, order_number)
    values (v_sid, v_stage, v_rank, v_count, v_total, v_items, v_name, v_phone, v_email, v_lang, v_path, v_stage = 'ordered', v_order);
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
  live jsonb;
  periods jsonb;
  abandoned jsonb;
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

  return jsonb_build_object('now', now(), 'live', live, 'periods', periods, 'abandoned', abandoned);
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
