-- =====================================================================
-- THÊM QUYỀN "QUẢN LÝ" (manager) — 17/11/2026. Chạy 1 lần trong Supabase → SQL Editor.
-- Chạy lại nhiều lần cũng không sao. Không xoá dữ liệu nào.
--
-- Quản lý:
--   • Làm được mọi việc như nhân viên (tạo, xử lý đơn, khách, bật/tắt món còn/hết).
--   • Xem tiền TUẦN NÀY ở Màn hình chính. Không xem tổng cộng dồn, Báo cáo,
--     Inventory/lãi lỗ (máy chủ chặn, không chỉ ẩn trên app).
--   • Không sửa giá món, thông tin quán, website, không xoá đơn/khách.
--   • Quản lý nhân viên: thêm, sửa tên/PIN, xoá tài khoản NHÂN VIÊN; tự đổi PIN của mình.
--     Không sửa/xoá được chủ quán hay quản lý khác, không nâng ai lên quản lý/chủ quán.
-- Chỉ chủ quán mới tạo được tài khoản quản lý (Cài đặt → Nhân viên & mã PIN).
-- =====================================================================

-- Quản lý là thành viên: đọc/ghi đơn, khách như nhân viên
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path to '' as $$
  select coalesce(public.my_role() in ('owner', 'manager', 'staff'), false)
$$;

create or replace function public.list_staff()
returns table(id uuid, name text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path to '' as $$
begin
  if public.my_role() is null or public.my_role() not in ('owner', 'manager') then
    raise exception 'Chỉ chủ quán hoặc quản lý mới xem được';
  end if;
  return query select a.id, a.name, a.role, a.created_at from public.staff_accounts a
    where not a.removed
    order by case a.role when 'owner' then 0 when 'manager' then 1 else 2 end, a.created_at;
end $$;

create or replace function public.save_staff(staff_id uuid, staff_name text, staff_role text, new_pin text)
returns uuid language plpgsql security definer set search_path to '' as $$
declare
  caller text := public.my_role();
  me uuid := (select s.account_id from public.device_sessions s where s.user_id = auth.uid());
  prev public.staff_accounts;
  saved uuid;
begin
  if caller is null or caller not in ('owner', 'manager') then
    raise exception 'Chỉ chủ quán hoặc quản lý mới sửa được';
  end if;
  if coalesce(trim(staff_name), '') = '' then raise exception 'Cần nhập tên'; end if;
  if staff_role not in ('owner', 'manager', 'staff') then raise exception 'Quyền không hợp lệ'; end if;
  if new_pin is not null and new_pin !~ '^\d{4}$' then raise exception 'Mã PIN phải gồm đúng 4 chữ số'; end if;

  if staff_id is not null then
    select * into prev from public.staff_accounts where id = staff_id and not removed for update;
    if prev.id is null then raise exception 'Không tìm thấy tài khoản'; end if;
  end if;

  -- Quản lý: chỉ thêm/sửa nhân viên, và tự sửa tên/PIN của mình (giữ nguyên quyền quản lý)
  if caller = 'manager' then
    if staff_id is not null and staff_id = me then
      if staff_role <> 'manager' then raise exception 'Quản lý không tự đổi quyền của mình được'; end if;
    else
      if prev.id is not null and prev.role <> 'staff' then
        raise exception 'Quản lý chỉ sửa được tài khoản nhân viên';
      end if;
      if staff_role <> 'staff' then raise exception 'Quản lý chỉ tạo được tài khoản nhân viên'; end if;
    end if;
  end if;

  if new_pin is not null and exists (
    select 1 from public.staff_accounts a
    where not a.removed and a.pin_hash = extensions.crypt(new_pin, a.pin_hash) and a.id is distinct from staff_id
  ) then
    raise exception 'Mã PIN này đã có người dùng, chọn mã khác';
  end if;

  if staff_id is null then
    if new_pin is null then raise exception 'Cần nhập mã PIN'; end if;
    insert into public.staff_accounts (name, role, pin_hash)
      values (trim(staff_name), staff_role, extensions.crypt(new_pin, extensions.gen_salt('bf')))
      returning id into saved;
    return saved;
  end if;

  if prev.role = 'owner' and staff_role <> 'owner'
     and not exists (select 1 from public.staff_accounts where role = 'owner' and not removed and id <> staff_id) then
    raise exception 'Phải còn ít nhất một chủ quán';
  end if;
  update public.staff_accounts set
    name = trim(staff_name),
    role = staff_role,
    pin_hash = case when new_pin is null then pin_hash else extensions.crypt(new_pin, extensions.gen_salt('bf')) end,
    version = case when new_pin is not null or staff_role <> prev.role then version + 1 else version end
  where id = staff_id;
  -- Tự đổi PIN của mình: máy đang dùng vẫn giữ đăng nhập
  if staff_id = me then
    update public.device_sessions set account_version = (select version from public.staff_accounts where id = me)
      where user_id = auth.uid();
  end if;
  return staff_id;
end $$;

create or replace function public.remove_staff(staff_id uuid)
returns void language plpgsql security definer set search_path to '' as $$
declare
  caller text := public.my_role();
  target text := (select role from public.staff_accounts where id = staff_id and not removed);
begin
  if caller is null or caller not in ('owner', 'manager') then
    raise exception 'Chỉ chủ quán hoặc quản lý mới xoá được';
  end if;
  if caller = 'manager' and target is distinct from 'staff' then
    raise exception 'Quản lý chỉ xoá được tài khoản nhân viên';
  end if;
  if target = 'owner'
     and not exists (select 1 from public.staff_accounts where role = 'owner' and not removed and id <> staff_id) then
    raise exception 'Phải còn ít nhất một chủ quán';
  end if;
  update public.staff_accounts set removed = true, version = version + 1 where id = staff_id;
end $$;

revoke execute on function public.list_staff(), public.save_staff(uuid, text, text, text), public.remove_staff(uuid)
  from public, anon;
grant execute on function public.list_staff(), public.save_staff(uuid, text, text, text), public.remove_staff(uuid)
  to authenticated;

-- Kiểm tra: phải ra 1 dòng "manager, staff, owner đều là thành viên" = true
select pg_get_functiondef('public.is_member()'::regprocedure) like '%manager%' as "đã thêm quyền quản lý";
