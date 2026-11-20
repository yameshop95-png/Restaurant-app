import { useCallback, useEffect, useRef, useState } from 'react';
import { Printer, RotateCcw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

// Theo dõi hàng đợi in: bill gửi đi quá 2 phút mà máy tính ở quán chưa in (máy tính tắt, bridge không chạy),
// hoặc máy in báo lỗi (tắt máy, hết giấy, rút dây) → hiện cảnh báo, có nút In lại / Bỏ qua.
const STUCK_MS = 2 * 60000;
const CHECK_MS = 30000;

export default function PrintStatus() {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const countRef = useRef(0);

  const check = useCallback(async () => {
    const since = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data, error } = await supabase
      .from('print_jobs')
      .select('id, created_at, status, note, error')
      .in('status', ['pending', 'printing', 'failed'])
      .gte('created_at', since)
      .order('created_at');
    if (error) return; // mất mạng: lần sau kiểm tra lại
    const bad = (data ?? []).filter(
      (j) => j.status === 'failed' || Date.now() - new Date(j.created_at).getTime() > STUCK_MS,
    );
    // Có thêm bill lỗi mới thì hiện lại cảnh báo dù trước đó đã bấm ẩn
    if (bad.length > countRef.current) setHidden(false);
    countRef.current = bad.length;
    setJobs(bad);
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_MS);
    return () => clearInterval(timer);
  }, [check]);

  if (!jobs.length || hidden) return null;
  const failed = jobs.filter((j) => j.status === 'failed');
  const stuck = jobs.length - failed.length;

  const retry = async () => {
    setBusy(true);
    await supabase
      .from('print_jobs')
      .update({ status: 'pending', error: null, created_at: new Date().toISOString() })
      .in('id', jobs.map((j) => j.id));
    setBusy(false);
    setJobs([]);
    setTimeout(check, STUCK_MS + 5000);
  };
  const discard = async () => {
    if (!window.confirm(`Bỏ ${jobs.length} bill chưa in? Bill sẽ không in ra nữa.`)) return;
    setBusy(true);
    await supabase.from('print_jobs').delete().in('id', jobs.map((j) => j.id));
    setBusy(false);
    setJobs([]);
  };

  return (
    <div className="fixed inset-x-3 top-3 z-40 mx-auto max-w-lg rounded-2xl border border-red-300 bg-red-50 p-4 shadow-lg lg:left-auto lg:right-4">
      <div className="flex items-start gap-3">
        <Printer className="mt-0.5 shrink-0 text-red-600" size={22} />
        <div className="min-w-0 flex-1">
          <p className="font-bold text-red-700">
            {jobs.length} bill chưa in được
          </p>
          <p className="mt-0.5 text-sm text-red-700">
            {failed.length > 0 && `Máy in báo lỗi (${failed[0].error || 'không rõ'}): kiểm tra máy in đã bật, còn giấy, cắm dây mạng. `}
            {stuck > 0 && 'Bill gửi quá 2 phút chưa ra: kiểm tra máy tính ở quán đang bật và cửa sổ in (bridge) đang chạy. '}
          </p>
          <p className="mt-1 truncate text-xs text-red-600">{jobs.map((j) => j.note).filter(Boolean).join(' · ')}</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={retry}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white active:bg-red-700 disabled:opacity-60"
            >
              <RotateCcw size={15} /> In lại
            </button>
            <button
              onClick={discard}
              disabled={busy}
              className="rounded-xl border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 active:bg-red-100 disabled:opacity-60"
            >
              Bỏ qua
            </button>
          </div>
        </div>
        <button onClick={() => setHidden(true)} aria-label="Ẩn" className="rounded-full p-1 text-red-500 hover:bg-red-100">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}
