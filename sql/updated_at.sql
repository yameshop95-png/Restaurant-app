-- Cột updated_at cho các bảng app đồng bộ: app chỉ tải các dòng đổi từ lần trước thay vì tải lại cả bảng mỗi lần mở.
-- Chạy MỘT lần trong SQL Editor. Không đổi dữ liệu nào. Chạy lại cũng không sao.
-- Chưa chạy thì app vẫn chạy bình thường (tải cả bảng như trước).
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'orders', 'customers', 'menu_items', 'shop_settings',
    'inv_ingredients', 'inv_purchases', 'inv_adjustments', 'inv_expenses', 'inv_recipes', 'inv_batches'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', t);
    execute format('create index if not exists %I on public.%I (updated_at)', t || '_updated_at_idx', t);
    execute format('drop trigger if exists %I on public.%I', t || '_touch', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end $$;
