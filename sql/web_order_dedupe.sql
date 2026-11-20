-- =====================================================================
-- CHỐNG ĐƠN TRÙNG TỪ WEBSITE (20/11/2026). Chạy 1 lần trong Supabase → SQL Editor.
-- Chạy lại nhiều lần cũng không sao. Không xoá dữ liệu nào.
--
-- Website gửi kèm một "mã đơn tạm" (clientKey) cho mỗi lần đặt. Khách bấm Đặt lại vì mạng
-- chập chờn (đơn đã tạo nhưng mất phản hồi) → máy chủ thấy mã đã có, trả lại đúng đơn cũ,
-- không tạo đơn thứ 2. Giữ nguyên mọi kiểm tra cũ (ngày nghỉ, giờ chốt, giá tính lại...).
-- =====================================================================

create index if not exists orders_client_key_idx on public.orders ((data ->> 'clientKey'))
  where data ? 'clientKey';

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
  ckey text := nullif(left(btrim(coalesce(payload ->> 'clientKey', '')), 64), '');
  prev record;
begin
  -- Chống trùng: khách bấm đặt lại (mạng chập chờn) với cùng mã đơn tạm → trả lại đơn đã tạo, không tạo đơn mới
  if ckey is not null then
    select o.number, o.data into prev from public.orders o
      where o.data ->> 'clientKey' = ckey and o.created_at > now() - interval '2 days' limit 1;
    if found then
      return jsonb_build_object('number', prev.number,
        'subtotal', (select coalesce(sum((i ->> 'price')::numeric * (i ->> 'qty')::int), 0) from jsonb_array_elements(prev.data -> 'items') i),
        'fee', coalesce((prev.data ->> 'shippingFee')::numeric, 0),
        'total', (select coalesce(sum((i ->> 'price')::numeric * (i ->> 'qty')::int), 0) from jsonb_array_elements(prev.data -> 'items') i)
                 + coalesce((prev.data ->> 'shippingFee')::numeric, 0),
        'deliverAt', prev.data ->> 'deliverAt', 'duplicate', true);
    end if;
  end if;

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
  ) || case when ckey is not null then jsonb_build_object('clientKey', ckey) else '{}'::jsonb end)
  returning number into num;

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

-- Kiểm tra: phải ra true
select pg_get_functiondef('public.place_web_order(jsonb)'::regprocedure) like '%clientKey%' as "đã bật chống trùng";
