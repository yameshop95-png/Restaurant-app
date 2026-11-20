import { useCallback, useEffect, useRef, useState } from 'react';
import { cacheLoadList, cacheSaveList } from '../lib/listCache';
import { supabase } from '../lib/supabase';
import { enqueue, hasPending, onDrained, syncReady } from '../lib/sync';

const PAGE = 1000; // máy chủ trả tối đa 1000 dòng mỗi lần: đọc nối tiếp cho đủ
const FULL_EVERY = 6 * 3600 * 1000; // tải lại toàn bộ ít nhất 6 giờ một lần (để biết dòng nào đã bị xoá)
const HIDDEN_MIN = 15 * 1000; // app ẩn dưới 15 giây thì quay lại không cần hỏi máy chủ

// Một bảng trên máy chủ, dùng như một mảng state của React:
// - mở app là hiện ngay bản lưu tạm trên máy (IndexedDB), rồi hỏi máy chủ: bảng có cột updated_at
//   (xem sql/updated_at.sql) thì chỉ tải các dòng đổi từ lần trước, không thì tải lại cả bảng;
// - nhận thay đổi từ máy khác ngay lập tức (realtime);
// - setList(...) đổi trên máy này ngay, rồi gửi phần khác biệt lên máy chủ qua hàng đợi (lib/sync).
//
// fromRow(row) -> item; sort(list) -> list đã sắp xếp;
// write({ prev, next, added, changed: [[old, new]], removed }) -> danh sách thao tác { rowId, run, onDone? }.
export default function useCloudList(table, { fromRow, sort = (list) => list, write }) {
  const [list, setListState] = useState([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const listRef = useRef(list);
  const alive = useRef(true);
  const retryDelay = useRef(0);
  // maxUpdated: updated_at mới nhất đã thấy; hasUpdated: bảng có cột updated_at; lastFull: lần tải toàn bộ gần nhất
  const meta = useRef({ maxUpdated: null, hasUpdated: false, lastFull: 0, fromServer: false });
  const saveTimer = useRef(null);

  const saveCache = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const { maxUpdated, hasUpdated, lastFull, fromServer } = meta.current;
      if (fromServer) cacheSaveList(table, listRef.current, { maxUpdated, hasUpdated, lastFull });
    }, 1500);
  }, [table]);

  const commit = useCallback(
    (next) => {
      listRef.current = next;
      setListState(next);
      saveCache();
    },
    [saveCache],
  );

  const track = (rows) => {
    const m = meta.current;
    for (const r of rows ?? []) {
      if (r?.updated_at == null) continue;
      m.hasUpdated = true;
      if (!m.maxUpdated || r.updated_at > m.maxUpdated) m.maxUpdated = r.updated_at;
    }
  };

  // Gộp các dòng máy chủ trả về vào danh sách trên máy (theo id)
  const merge = useCallback(
    (rows) => {
      if (!rows?.length) return;
      const byId = new Map(listRef.current.map((x) => [x.id, x]));
      for (const row of rows) byId.set(row.id, fromRow(row));
      commit(sort([...byId.values()]));
    },
    // fromRow / sort là hàm cố định của từng bảng
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  // Đọc các dòng (từ `since` nếu có), đủ mọi trang
  const fetchRows = useCallback(
    async (since) => {
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        let q = supabase.from(table).select('*');
        if (since) q = q.gt('updated_at', since);
        q = meta.current.hasUpdated ? q.order('updated_at').order('id') : q.order('id');
        const { data, error } = await q.range(from, from + PAGE - 1);
        if (error) return { error };
        rows.push(...data);
        if (data.length < PAGE) return { rows };
      }
    },
    [table],
  );

  const refetch = useCallback(
    async ({ full = false } = {}) => {
      // Chờ hàng đợi đã lưu được khôi phục xong (chỉ lần mở app đầu tiên mới phải chờ):
      // không thì hasPending() chưa đúng, lần tải toàn bộ có thể đè mất dòng đang chờ gửi (đơn tạo lúc mất mạng)
      await syncReady();
      // Còn thay đổi chưa gửi được thì giữ nguyên dữ liệu trên máy, tránh mất thay đổi đó
      if (hasPending(table)) return;
      const m = meta.current;
      const incremental = !full && m.fromServer && m.hasUpdated && m.maxUpdated && Date.now() - m.lastFull < FULL_EVERY;
      // Lùi 5 giây cho chắc khỏi sót dòng ghi cùng lúc
      const since = incremental ? new Date(new Date(m.maxUpdated).getTime() - 5000).toISOString() : null;
      const { rows, error } = await fetchRows(since);
      if (error) {
        setLoadError(error.message);
        // Thử lại chậm dần (5s, 10s … tối đa 60s); bảng chưa tạo trên máy chủ thì thử lại mỗi 60s, không dồn dập
        const missingTable = /relation|does not exist|schema cache/i.test(error.message ?? '');
        retryDelay.current = missingTable ? 60000 : Math.min((retryDelay.current || 2500) * 2, 60000);
        if (alive.current) setTimeout(() => alive.current && refetch(), retryDelay.current);
        return;
      }
      if (hasPending(table)) return;
      retryDelay.current = 0;
      setLoadError(null);
      track(rows);
      m.fromServer = true;
      if (incremental) {
        merge(rows);
        saveCache();
      } else {
        m.lastFull = Date.now();
        commit(sort(rows.map(fromRow)));
      }
      setReady(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, commit, fetchRows],
  );

  useEffect(() => {
    alive.current = true;
    // Hiện bản lưu tạm trước (nếu máy chủ chưa kịp trả), rồi hỏi máy chủ
    cacheLoadList(table).then((cached) => {
      if (alive.current && cached?.items && !meta.current.fromServer && !hasPending(table)) {
        Object.assign(meta.current, {
          maxUpdated: cached.maxUpdated ?? null,
          hasUpdated: Boolean(cached.hasUpdated),
          lastFull: cached.lastFull ?? 0,
          fromServer: true,
        });
        listRef.current = cached.items;
        setListState(cached.items);
        setReady(true);
      }
      if (alive.current) refetch();
    });
    // Gộp các sự kiện realtime đến gần nhau rồi áp dụng 1 lượt: trước đây mỗi sự kiện tốn
    // 1 lần dựng Map + sắp xếp lại toàn bộ danh sách (~34 ms ở 50k đơn; cụm 25 sự kiện ~0,9 s).
    // Gom trong cửa sổ 400 ms rồi merge 1 lần thì cụm 25 sự kiện chỉ còn ~41 ms (đo local, xem PR).
    // Nhiều sự kiện cho cùng 1 dòng trong 1 cụm: sự kiện đến sau thắng (đúng thứ tự máy chủ gửi).
    // hasPending được kiểm tra cả lúc nhận lẫn lúc áp dụng: dòng đang có thao tác chờ gửi
    // (bản sửa hàng đợi bền) không bao giờ bị dữ liệu máy chủ đè lên.
    // Cảnh báo đơn web mới KHÔNG móc vào đường này: App.jsx tự đối chiếu danh sách đơn theo id
    // (seenOrders) rồi mới kêu chuông / in bill, nên gộp cụm chỉ làm chuông chậm tối đa 400 ms,
    // không mất và không trùng cảnh báo.
    const pendingEvents = new Map();
    let flushTimer = null;
    const flushEvents = () => {
      flushTimer = null;
      const events = [...pendingEvents.values()];
      pendingEvents.clear();
      if (!alive.current || !events.length) return;
      const upserts = [];
      const deleteIds = [];
      for (const ev of events) {
        if (hasPending(table, ev.id)) continue;
        if (ev.type === 'delete') deleteIds.push(ev.id);
        else upserts.push(ev.row);
      }
      if (upserts.length) {
        track(upserts);
        merge(upserts);
      }
      if (deleteIds.length) {
        const del = new Set(deleteIds);
        commit(listRef.current.filter((x) => !del.has(x.id)));
      }
    };
    const queueEvent = (ev) => {
      pendingEvents.set(ev.id, ev);
      if (!flushTimer) flushTimer = setTimeout(flushEvents, 400);
    };
    const channel = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old?.id;
          if (id != null && !hasPending(table, id)) queueEvent({ type: 'delete', id });
        } else if (!hasPending(table, payload.new.id)) {
          queueEvent({ type: 'upsert', id: payload.new.id, row: payload.new });
        }
      })
      // Kết nối lại sau khi mất mạng / máy ngủ: tải lại để không sót thay đổi
      .subscribe((status) => status === 'SUBSCRIBED' && refetch());

    // Quay lại app sau khi ẩn đủ lâu (máy ngủ, chuyển app): hỏi máy chủ phần thay đổi
    let hiddenAt = 0;
    const onVisible = () => {
      if (document.visibilityState === 'hidden') hiddenAt = Date.now();
      else if (!hiddenAt || Date.now() - hiddenAt >= HIDDEN_MIN) refetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    const offDrained = onDrained(refetch);
    return () => {
      alive.current = false;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      offDrained();
      clearTimeout(saveTimer.current);
      if (flushTimer) clearTimeout(flushTimer);
    };
  }, [table, refetch, merge, commit]);

  const setList = useCallback(
    (updater) => {
      const prev = listRef.current;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (next === prev) return;
      commit(next);

      const prevById = new Map(prev.map((x) => [x.id, x]));
      const nextIds = new Set(next.map((x) => x.id));
      const added = [];
      const changed = [];
      for (const item of next) {
        const old = prevById.get(item.id);
        if (!old) added.push(item);
        else if (old !== item && JSON.stringify(old) !== JSON.stringify(item)) changed.push([old, item]);
      }
      const removed = prev.filter((x) => !nextIds.has(x.id));
      for (const op of write({ prev, next, added, changed, removed })) {
        enqueue({ table, ...op, onDone: op.onDone ?? merge });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [table, commit, merge],
  );

  return { list, setList, ready, loadError, listRef };
}

// Các trường thay đổi ở cấp ngoài cùng; trường bị bỏ đi thì gửi null
export function shallowPatch(old, next, skip = []) {
  const patch = {};
  for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
    if (skip.includes(key) || key.startsWith('_')) continue;
    if (JSON.stringify(old[key]) !== JSON.stringify(next[key])) patch[key] = next[key] ?? null;
  }
  return patch;
}

// Bỏ id và các trường tạm (bắt đầu bằng "_") trước khi lưu vào cột data
export function dataOf(item, skip = []) {
  return Object.fromEntries(
    Object.entries(item).filter(([k, v]) => k !== 'id' && !skip.includes(k) && !k.startsWith('_') && v !== undefined),
  );
}
