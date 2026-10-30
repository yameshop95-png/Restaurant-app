import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { enqueue, hasPending, onDrained } from '../lib/sync';

// Một bảng trên máy chủ, dùng như một mảng state của React:
// - tải hết khi mở app, nhận thay đổi từ máy khác ngay lập tức (realtime);
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

  const commit = useCallback((next) => {
    listRef.current = next;
    setListState(next);
  }, []);

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

  const refetch = useCallback(async () => {
    // Còn thay đổi chưa gửi được thì giữ nguyên dữ liệu trên máy, tránh mất thay đổi đó
    if (hasPending(table)) return;
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      setLoadError(error.message);
      if (alive.current) setTimeout(() => alive.current && refetch(), 5000);
      return;
    }
    if (hasPending(table)) return;
    setLoadError(null);
    commit(sort(data.map(fromRow)));
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, commit]);

  useEffect(() => {
    alive.current = true;
    refetch();
    const channel = supabase
      .channel(`${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        if (payload.eventType === 'DELETE') {
          const id = payload.old?.id;
          if (id != null && !hasPending(table, id)) commit(listRef.current.filter((x) => x.id !== id));
        } else if (!hasPending(table, payload.new.id)) {
          merge([payload.new]);
        }
      })
      // Kết nối lại sau khi mất mạng / máy ngủ: tải lại để không sót thay đổi
      .subscribe((status) => status === 'SUBSCRIBED' && refetch());

    const onVisible = () => document.visibilityState === 'visible' && refetch();
    document.addEventListener('visibilitychange', onVisible);
    const offDrained = onDrained(refetch);
    return () => {
      alive.current = false;
      supabase.removeChannel(channel);
      document.removeEventListener('visibilitychange', onVisible);
      offDrained();
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
