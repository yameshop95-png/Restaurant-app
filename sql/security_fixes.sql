-- =====================================================================
-- SỬA BẢO MẬT + WEBSITE (17/11/2026). Chạy 1 lần trong Supabase → SQL Editor.
-- Chạy lại nhiều lần cũng không sao. Không xoá dữ liệu nào.
--
-- 1. Inventory Management: chỉ CHỦ QUÁN xem/sửa được (trước đây nhân viên
--    đăng nhập PIN cũng đọc được giá vốn, lãi lỗ qua API).
-- 2. Đăng nhập PIN: thêm giới hạn 60 lần sai / 24 giờ cho cả quán, để không
--    ai dò ra được PIN 4 số. Máy đang đăng nhập sẵn không bị ảnh hưởng.
-- 3. Website: máy chủ chặn đặt vào NGÀY NGHỈ (trước chỉ website tự lọc),
--    và lưu "Đồng ý nhận tin nhắn của quán" khi khách tích ô đó.
-- 4. Dọn dẹp nhỏ: xoá log cũ, bỏ trigger trùng, thu hồi quyền thừa.
-- =====================================================================

-- 1. INVENTORY: CHỈ CHỦ QUÁN ------------------------------------------
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce(public.my_role() = 'owner', false)
$$;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['inv_ingredients','inv_purchases','inv_adjustments','inv_expenses','inv_recipes','inv_batches'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format('create policy %I on public.%I for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()))', t || '_all', t);
  end loop;
end $$;

-- 2. PIN: GIỚI HẠN THEO NGÀY -------------------------------------------
create or replace function public.pin_login(pin text)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  uid uuid := auth.uid();
  sess public.device_sessions;
  acc public.staff_accounts;
  attempts int;
begin
  if uid is null then return jsonb_build_object('error', 'no_session'); end if;
  insert into public.device_sessions (user_id) values (uid) on conflict do nothing;
  select * into sess from public.device_sessions where user_id = uid for update;
  if sess.locked_until > now() then
    return jsonb_build_object('error', 'locked', 'until', sess.locked_until);
  end if;
  -- Cả quán: quá 30 lần sai / 10 phút hoặc 60 lần sai / 24 giờ thì tạm khoá đăng nhập mới.
  -- (Kẻ gian tạo máy ảo mới để né khoá từng máy vẫn chỉ thử được 60 PIN mỗi ngày.)
  if (select count(*) from public.pin_failures where at > now() - interval '10 minutes') >= 30
     or (select count(*) from public.pin_failures where at > now() - interval '24 hours') >= 60 then
    return jsonb_build_object('error', 'busy');
  end if;

  if pin ~ '^\d{4}$' then
    select * into acc from public.staff_accounts
      where not removed and pin_hash = extensions.crypt(pin, pin_hash) limit 1;
  end if;

  if acc.id is null then
    insert into public.pin_failures default values;
    delete from public.pin_failures where at < now() - interval '3 days';
    attempts := sess.failed_attempts + 1;
    update public.device_sessions
      set failed_attempts = case when attempts >= 5 then 0 else attempts end,
          locked_until = case when attempts >= 5 then now() + interval '5 minutes' end
      where user_id = uid;
    if attempts >= 5 then
      return jsonb_build_object('error', 'locked', 'until', now() + interval '5 minutes');
    end if;
    return jsonb_build_object('error', 'wrong', 'left', 5 - attempts);
  end if;

  update public.device_sessions
    set account_id = acc.id, account_version = acc.version, failed_attempts = 0, locked_until = null, signed_in_at = now()
    where user_id = uid;
  return jsonb_build_object('id', acc.id, 'name', acc.name, 'role', acc.role);
end $$;

-- 3. ĐẶT MÓN QUA WEBSITE -----------------------------------------------
create or replace function public.place_web_order(payload jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare
  tz constant text := 'Australia/Sydney';
  shop jsonb := coalesce((select data from public.shop_settings where id = 1), '{}'::jsonb);
  web jsonb := coalesce(shop -> 'webOrdering', '{}'::jsonb);
  zones jsonb := coalesce(shop -> 'shippingZones', public.default_zones());
  lead_min int := greatest(0, coalesce((web ->> 'leadMinutes')::int, 30));
  dday int := coalesce((web ->> 'deliveryDay')::int, 6);
  dstart time := coalesce((web ->> 'deliveryStart')::time, '08:00');
  dend time := coalesce((web ->> 'deliveryEnd')::time, '12:00');
  dcut time := coalesce((web ->> 'deliveryCutoff')::time, '20:00');
  closed jsonb := case when jsonb_typeof(web -> 'closedDates') = 'array' then web -> 'closedDates' else '[]'::jsonb end;
  typ text := payload ->> 'type';
  cname text := btrim(coalesce(payload ->> 'name', ''));
  cphone text := btrim(coalesce(payload ->> 'phone', ''));
  digits text := regexp_replace(coalesce(payload ->> 'phone', ''), '\D', '', 'g');
  addr text := btrim(coalesce(payload ->> 'address', ''));
  note text := left(btrim(coalesce(payload ->> 'note', '')), 300);
  consent boolean := coalesce(payload ->> 'marketingConsent', '') = 'true';
  due timestamptz;
  local_due timestamp;
  it jsonb;
  qty int;
  m record;
  items jsonb := '[]'::jsonb;
  subtotal numeric := 0;
  fee numeric := 0;
  z jsonb;
  oid text := gen_random_uuid()::text;
  num int;
  ts text := to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  cust text;
  consent_patch jsonb := '{}'::jsonb;
begin
  if coalesce((web ->> 'enabled')::boolean, true) = false then
    return jsonb_build_object('error', 'closed');
  end if;
  if typ is null or typ not in ('pickup', 'delivery') then return jsonb_build_object('error', 'type'); end if;
  if length(cname) < 1 or length(cname) > 80 then return jsonb_build_object('error', 'name'); end if;
  if length(digits) < 8 or length(digits) > 15 or length(cphone) > 30 then return jsonb_build_object('error', 'phone'); end if;
  if typ = 'delivery' and (length(addr) < 5 or length(addr) > 200) then return jsonb_build_object('error', 'address'); end if;

  begin
    due := (payload ->> 'deliverAt')::timestamptz;
  exception when others then
    return jsonb_build_object('error', 'time', 'leadMinutes', lead_min);
  end;
  if due is null then return jsonb_build_object('error', 'time', 'leadMinutes', lead_min); end if;
  local_due := due at time zone tz;

  -- Ngày quán nghỉ (chủ quán chọn trong Cài đặt → Website đặt món)
  if closed ? to_char(local_due, 'YYYY-MM-DD') then
    return jsonb_build_object('error', 'closed_date');
  end if;

  if typ = 'pickup' then
    if due < now() + make_interval(mins => lead_min) - interval '2 minutes' or due > now() + interval '14 days' then
      return jsonb_build_object('error', 'time', 'leadMinutes', lead_min);
    end if;
  else
    -- Giao hàng: đúng ngày giao trong tuần, trong khung giờ, trước hạn chót của hôm trước
    if due > now() + interval '22 days' or extract(dow from local_due) <> dday
       or local_due::time < dstart or local_due::time > dend then
      return jsonb_build_object('error', 'delivery_day');
    end if;
    if (now() at time zone tz) >= (local_due::date - 1) + dcut then
      return jsonb_build_object('error', 'cutoff');
    end if;
  end if;

  -- Chống spam: 1 SĐT tối đa 3 đơn / giờ, cả website tối đa 30 đơn / 10 phút
  if (select count(*) from public.web_order_log l where l.phone = digits and l.at > now() - interval '1 hour') >= 3 then
    return jsonb_build_object('error', 'too_many');
  end if;
  if (select count(*) from public.web_order_log l where l.at > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('error', 'busy');
  end if;

  if jsonb_typeof(payload -> 'items') is distinct from 'array'
     or jsonb_array_length(payload -> 'items') = 0 or jsonb_array_length(payload -> 'items') > 50 then
    return jsonb_build_object('error', 'items');
  end if;
  for it in select value from jsonb_array_elements(payload -> 'items') loop
    begin
      qty := (it ->> 'qty')::int;
    exception when others then
      return jsonb_build_object('error', 'items');
    end;
    if qty is null or qty < 1 or qty > 50 then return jsonb_build_object('error', 'items'); end if;
    select mi.id, mi.data into m from public.menu_items mi where mi.id = it ->> 'id';
    if not found then return jsonb_build_object('error', 'unavailable'); end if;
    if coalesce((m.data ->> 'available')::boolean, true) = false then
      return jsonb_build_object('error', 'unavailable', 'item', m.data ->> 'name');
    end if;
    items := items || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'name', m.data ->> 'name',
      'price', (m.data ->> 'price')::numeric,
      'qty', qty,
      'note', nullif(left(btrim(coalesce(it ->> 'note', '')), 120), '')
    )));
    subtotal := subtotal + (m.data ->> 'price')::numeric * qty;
  end loop;

  if typ = 'delivery' then
    z := public.match_zone(addr, zones);
    if z is null then return jsonb_build_object('error', 'zone'); end if;
    fee := coalesce((z ->> 'fee')::numeric, 0);
  end if;

  insert into public.web_order_log (phone) values (digits);
  if random() < 0.02 then
    delete from public.web_order_log where at < now() - interval '30 days';
  end if;
  insert into public.orders (id, data) values (oid, jsonb_build_object(
    'type', typ,
    'customer', jsonb_build_object('name', cname, 'phone', cphone, 'address', case when typ = 'delivery' then addr else '' end),
    'deliverAt', to_char(due at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'table', '',
    'note', note,
    'items', items,
    'shippingFee', fee,
    'discount', 0,
    'status', 'pending',
    'paid', false,
    'paymentMethod', null,
    'paidAt', null,
    'createdAt', ts,
    'createdBy', 'Website',
    'source', 'web',
    'lang', case when payload ->> 'lang' in ('vi', 'en') then payload ->> 'lang' else 'en' end
  )) returning number into num;

  -- Khách tích "Đồng ý nhận tin nhắn": ghi lại thời điểm và nguồn. Không tích thì giữ nguyên lựa chọn cũ.
  if consent then
    consent_patch := jsonb_build_object('marketingConsent', true, 'consentAt', ts, 'consentSource', 'web');
  end if;

  select c.id into cust from public.customers c
    where regexp_replace(coalesce(c.data ->> 'phone', ''), '\D', '', 'g') = digits limit 1;
  if cust is null then
    insert into public.customers (id, data) values (gen_random_uuid()::text, jsonb_build_object(
      'name', cname, 'phone', cphone, 'address', case when typ = 'delivery' then addr else '' end, 'lastOrderAt', ts)
      || consent_patch);
  else
    update public.customers set data = data || jsonb_build_object('lastOrderAt', ts)
      || case when typ = 'delivery' then jsonb_build_object('address', addr) else '{}'::jsonb end
      || consent_patch
    where id = cust;
  end if;

  return jsonb_build_object('number', num, 'subtotal', subtotal, 'fee', fee, 'total', subtotal + fee,
    'deliverAt', due, 'zone', z ->> 'name');
end $$;
revoke execute on function public.place_web_order(jsonb) from public;
grant execute on function public.place_web_order(jsonb) to anon, authenticated;

-- 4. DỌN DẸP -----------------------------------------------------------
-- menu_items / shop_settings đã có trigger touch_row (cập nhật cả người sửa); bỏ trigger trùng
drop trigger if exists menu_items_touch on public.menu_items;
drop trigger if exists shop_settings_touch on public.shop_settings;
-- Hàm trigger không cần ai gọi trực tiếp
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Kiểm tra: kết quả phải là 6 dòng, cột "using" đều là is_owner
select tablename, policyname, qual as using
from pg_policies where schemaname = 'public' and tablename like 'inv\_%' order by tablename;
