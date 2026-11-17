-- Xem cấu trúc database của quán (chỉ ĐỌC, không sửa gì): bảng, cột, hàm, phân quyền, trigger, realtime.
-- Chạy trong SQL Editor, rồi copy ô kết quả gửi cho Claude để lưu vào repo (sql/schema.sql) và kiểm tra bảo mật.
-- Không chứa dữ liệu khách hay mã PIN, chỉ có định nghĩa.
select jsonb_pretty(jsonb_build_object(
  'tables', (
    select jsonb_agg(jsonb_build_object(
      'table', c.relname,
      'rls', c.relrowsecurity,
      'columns', (
        select jsonb_agg(
          a.attname || ' ' || format_type(a.atttypid, a.atttypmod)
          || case when a.attnotnull then ' not null' else '' end
          || coalesce(' default ' || pg_get_expr(d.adbin, d.adrelid), '')
          order by a.attnum)
        from pg_attribute a
        left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
        where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
      ),
      'indexes', (select jsonb_agg(pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid = c.oid)
    ) order by c.relname)
    from pg_class c
    where c.relnamespace = 'public'::regnamespace and c.relkind = 'r'
  ),
  'functions', (
    select jsonb_agg(jsonb_build_object(
      'name', p.proname,
      'security_definer', p.prosecdef,
      'definition', pg_get_functiondef(p.oid)
    ) order by p.proname)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  ),
  'function_grants', (
    select jsonb_agg(distinct routine_name || ' → ' || grantee)
    from information_schema.routine_privileges
    where routine_schema = 'public' and grantee in ('anon', 'authenticated', 'PUBLIC')
  ),
  'policies', (
    select jsonb_agg(jsonb_build_object(
      'table', tablename, 'name', policyname, 'command', cmd, 'roles', roles,
      'using', qual, 'check', with_check
    ) order by tablename, policyname)
    from pg_policies where schemaname = 'public'
  ),
  'triggers', (
    select jsonb_agg(pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
  ),
  'realtime', (
    select jsonb_agg(tablename order by tablename) from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public'
  ),
  'extensions', (select jsonb_agg(extname order by extname) from pg_extension)
)) as schema;
