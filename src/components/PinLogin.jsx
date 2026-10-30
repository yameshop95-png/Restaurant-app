import { useEffect, useState } from 'react';
import { ChefHat, Delete, Loader2, WifiOff } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'del'];

// Màn hình nhập mã PIN 4 số (bàn phím số to, bấm đủ 4 số là tự đăng nhập)
export default function PinLogin({ onLogin, offlineError, onRetry }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const press = (key) => {
    if (busy) return;
    setError(null);
    if (key === 'del') setPin((p) => p.slice(0, -1));
    else setPin((p) => (p.length < 4 ? p + key : p));
  };

  useEffect(() => {
    if (pin.length !== 4) return;
    let cancelled = false;
    setBusy(true);
    onLogin(pin).then((err) => {
      if (cancelled) return;
      setBusy(false);
      if (err) {
        setError(err);
        setPin('');
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // Gõ bằng bàn phím máy tính cũng được
  useEffect(() => {
    const onKey = (e) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-page px-6 py-10 text-white">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-500">
        <ChefHat size={34} />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Nhập mã PIN</h1>
      <p className="mt-1 text-sm text-slate-400">Mã 4 số chủ quán cấp cho bạn</p>

      <div className="mt-6 flex gap-4" aria-label={`Đã nhập ${pin.length} trên 4 số`}>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-4 w-4 rounded-full ${i < pin.length ? 'bg-orange-500' : 'bg-slate-300'} ${error ? 'bg-red-500' : ''}`}
          />
        ))}
      </div>

      <div className="mt-4 min-h-12 max-w-xs text-center text-sm">
        {busy ? (
          <Loader2 className="mx-auto animate-spin text-slate-400" />
        ) : error ? (
          <p role="alert" className="font-semibold text-red-400">
            {error}
          </p>
        ) : offlineError ? (
          <p className="text-amber-300">
            <WifiOff size={16} className="mr-1 inline" /> {offlineError}{' '}
            <button onClick={onRetry} className="font-semibold underline">
              Thử lại
            </button>
          </p>
        ) : null}
      </div>

      <div className="mt-2 grid w-full max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, i) =>
          key === null ? (
            <span key={i} />
          ) : (
            <button
              key={key}
              onClick={() => press(key)}
              disabled={busy}
              aria-label={key === 'del' ? 'Xoá số' : key}
              className="flex h-16 items-center justify-center rounded-2xl border border-slate-200 bg-card text-2xl font-semibold active:bg-slate-100 disabled:opacity-50"
            >
              {key === 'del' ? <Delete size={24} /> : key}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
