-- Inventory Management: nguyên liệu, nhập hàng, kiểm kho / hao hụt, công thức món, chi phí.
-- Chạy MỘT lần trong SQL Editor của project restaurant-app (dán cả file, bấm Run).
-- Mỗi bảng theo kiểu các bảng khác của app: id + cột data (jsonb). Chỉ chủ quán đọc / ghi được
-- (nếu project có hàm public.is_owner() thì dùng hàm đó, không thì dùng public.is_member()).

create table if not exists public.inv_ingredients (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,       -- { name, unit, minStock }
  created_at timestamptz not null default now()
);
create table if not exists public.inv_purchases (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,       -- { date, ingredientId, qty, total, supplier, note }
  created_at timestamptz not null default now()
);
create table if not exists public.inv_adjustments (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,       -- { date, ingredientId, qty (+/-), reason, note }
  created_at timestamptz not null default now()
);
create table if not exists public.inv_expenses (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,       -- { date, category, amount, note }
  created_at timestamptz not null default now()
);
create table if not exists public.inv_recipes (
  id uuid primary key,                           -- trùng id món trong thực đơn (mỗi món 1 công thức)
  data jsonb not null default '{}'::jsonb,       -- { lines: [{ ingredientId, qty, unit }], extra }
  created_at timestamptz not null default now()
);

do $$
declare
  t text;
  who text := case when to_regprocedure('public.is_owner()') is not null
                   then 'public.is_owner()' else 'public.is_member()' end;
begin
  foreach t in array array['inv_ingredients', 'inv_purchases', 'inv_adjustments', 'inv_expenses', 'inv_recipes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (%s) with check (%s)',
      t || '_all', t, who, who
    );
    -- Cập nhật tức thì giữa các máy (realtime)
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
