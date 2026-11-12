-- Hàng đợi in bill: app nhân viên thêm dòng, máy tính ở quán đọc và in ra máy Uniwell.
-- Chạy một lần trong SQL Editor của project restaurant-app.
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'printed', 'failed')),
  payload text not null,            -- dữ liệu ESC/POS, mã base64
  note text,                        -- ví dụ "#80 · Lan"
  error text,
  printed_at timestamptz
);

alter table public.print_jobs enable row level security;

-- Chỉ phiên đã đăng nhập bằng PIN (nhân viên / máy in) được đụng vào hàng đợi
create policy print_jobs_insert on public.print_jobs
  for insert to authenticated with check (public.is_member());
create policy print_jobs_select on public.print_jobs
  for select to authenticated using (public.is_member());
create policy print_jobs_update on public.print_jobs
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy print_jobs_delete on public.print_jobs
  for delete to authenticated using (public.is_member());

-- Đơn in cũ đã xong thì xoá sau 2 ngày để bảng không phình và bill không nằm lâu trong database
-- (chạy lại mỗi ngày nếu muốn; hoặc bỏ qua, bảng vẫn nhỏ)
