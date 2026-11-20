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

-- 3. ĐẶT MÓN QUA WEBSITE: hàm place_web_order nằm trong sql/web_order_dedupe.sql (bản duy nhất, có chống trùng)


-- 4. DỌN DẸP -----------------------------------------------------------
-- menu_items / shop_settings đã có trigger touch_row (cập nhật cả người sửa); bỏ trigger trùng
drop trigger if exists menu_items_touch on public.menu_items;
drop trigger if exists shop_settings_touch on public.shop_settings;
-- Hàm trigger không cần ai gọi trực tiếp
revoke execute on function public.touch_updated_at() from public, anon, authenticated;

-- Kiểm tra: kết quả phải là 6 dòng, cột "using" đều là is_owner
select tablename, policyname, qual as using
from pg_policies where schemaname = 'public' and tablename like 'inv\_%' order by tablename;
