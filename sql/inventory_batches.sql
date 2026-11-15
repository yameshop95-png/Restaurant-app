-- Thêm bảng "mẻ" cho Inventory Management (ghi mỗi mẻ làm: món, số phần làm ra, nguyên liệu dùng thật).
-- Chạy MỘT lần trong SQL Editor của project restaurant-app, sau khi đã chạy sql/inventory.sql.
create table if not exists public.inv_batches (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null default '{}'::jsonb,       -- { date, productId, output, lines: [{ ingredientId, qty, unit }], extraCost, note }
  created_at timestamptz not null default now()
);

do $$
declare
  who text := case when to_regprocedure('public.is_owner()') is not null
                   then 'public.is_owner()' else 'public.is_member()' end;
begin
  alter table public.inv_batches enable row level security;
  drop policy if exists inv_batches_all on public.inv_batches;
  execute format(
    'create policy inv_batches_all on public.inv_batches for all to authenticated using (%s) with check (%s)',
    who, who
  );
  begin
    alter publication supabase_realtime add table public.inv_batches;
  exception when duplicate_object then null;
  end;
end $$;
