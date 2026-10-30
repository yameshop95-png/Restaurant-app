import { useCallback, useEffect, useState } from 'react';
import { CloudUpload, KeyRound, Loader2, LogOut, Pencil, Plus, Trash2, UserRound, X } from 'lucide-react';
import { normalizeText } from '../hooks/useCustomers';
import { hasLocalData, localDataMoved, markLocalDataMoved, readLocalData } from '../lib/localData';
import { supabase } from '../lib/supabase';

const ROLE_LABEL = { owner: 'Chủ quán', staff: 'Nhân viên' };

const inputClass =
  'w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

// Ai đang dùng máy này + nút đổi người
export function AccountCard({ account, onLogout }) {
  return (
    <section className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-card px-5 py-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <UserRound size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate font-bold text-slate-900">{account.name}</h2>
        <p className="text-sm text-slate-500">{ROLE_LABEL[account.role]} · đang đăng nhập trên máy này</p>
      </div>
      <button
        onClick={onLogout}
        className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
      >
        <LogOut size={16} /> Đổi người
      </button>
    </section>
  );
}

function StaffForm({ person, onSaved, onClose }) {
  const [name, setName] = useState(person?.name ?? '');
  const [role, setRole] = useState(person?.role ?? 'staff');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const save = async () => {
    if (!name.trim()) return setError('Nhập tên');
    if (!person && !pin) return setError('Đặt mã PIN 4 số cho người này');
    if (pin && !/^\d{4}$/.test(pin)) return setError('Mã PIN phải gồm đúng 4 chữ số');
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.rpc('save_staff', {
      staff_id: person?.id ?? null,
      staff_name: name,
      staff_role: role,
      new_pin: pin || null,
    });
    setBusy(false);
    if (err) return setError(err.message);
    onSaved();
    onClose();
  };

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-900">{person ? `Sửa ${person.name}` : 'Thêm người'}</p>
        <button onClick={onClose} className="rounded-full p-1 text-slate-500 hover:bg-slate-200" aria-label="Đóng">
          <X size={18} />
        </button>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">Tên</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="VD: Lan" className={inputClass} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(ROLE_LABEL).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setRole(id)}
            aria-pressed={role === id}
            className={`rounded-xl border-2 py-2.5 font-semibold ${
              role === id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">
          {person ? 'Mã PIN mới (để trống nếu giữ mã cũ)' : 'Mã PIN (4 số)'}
        </span>
        <input
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
          placeholder="••••"
          className={`${inputClass} tracking-[0.5em]`}
        />
      </label>
      {person && (
        <p className="text-xs text-slate-500">Đổi mã PIN hoặc đổi quyền thì các máy đang dùng mã cũ sẽ bị đăng xuất.</p>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button
        onClick={save}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600 disabled:opacity-60"
      >
        {busy && <Loader2 size={18} className="animate-spin" />} Lưu
      </button>
    </div>
  );
}

// Chủ quán quản lý ai được vào app và bằng mã nào
export function StaffManager({ account }) {
  const [people, setPeople] = useState(null);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(undefined); // undefined: đóng · null: thêm · object: sửa

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('list_staff');
    if (err) setError(err.message);
    else {
      setError(null);
      setPeople(data);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (person) => {
    if (!window.confirm(`Xoá ${person.name}? Máy đang dùng mã của người này sẽ bị đăng xuất ngay.`)) return;
    const { error: err } = await supabase.rpc('remove_staff', { staff_id: person.id });
    if (err) setError(err.message);
    else load();
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
          <KeyRound size={22} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Nhân viên & mã PIN</h2>
          <p className="text-sm text-slate-500">
            Nhân viên tạo, xử lý đơn được; không xem báo cáo, doanh thu, không sửa giá
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
        {people == null && !error && <Loader2 className="mx-auto animate-spin text-slate-400" />}
        {people && (
          <ul className="divide-y divide-slate-100">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-900">
                    {p.name}
                    {p.id === account.id && <span className="text-sm font-normal text-slate-400"> (bạn)</span>}
                  </p>
                  <p className={`text-sm ${p.role === 'owner' ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                    {ROLE_LABEL[p.role]}
                  </p>
                </div>
                <button
                  onClick={() => setEditing(p)}
                  className="flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600 active:bg-slate-200"
                >
                  <Pencil size={14} /> Sửa
                </button>
                {p.id !== account.id && (
                  <button
                    onClick={() => remove(p)}
                    className="rounded-lg bg-red-50 p-2 text-red-600 active:bg-red-100"
                    aria-label={`Xoá ${p.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {editing !== undefined ? (
          <StaffForm key={editing?.id ?? 'new'} person={editing} onSaved={load} onClose={() => setEditing(undefined)} />
        ) : (
          <button
            onClick={() => setEditing(null)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-50"
          >
            <Plus size={18} /> Thêm người
          </button>
        )}
        <p className="text-xs text-slate-400">
          Mã 4 số dễ đoán: nhập sai 5 lần thì máy đó bị khoá 5 phút. Khi nhân viên nghỉ việc, hãy xoá hoặc đổi mã của
          họ.
        </p>
      </div>
    </section>
  );
}

// Một lần: đưa đơn, khách, thực đơn, thông tin quán đang lưu riêng trên máy này lên máy chủ
export function MoveLocalData({
  menu,
  onImportOrders,
  onImportCustomers,
  onImportMenu,
  onAddMenuItem,
  onUpdateSettings,
  settings,
}) {
  const [visible, setVisible] = useState(() => hasLocalData() && !localDataMoved());
  const [message, setMessage] = useState(null);
  if (!visible && !message) return null;

  const move = () => {
    const local = readLocalData();
    const orders = onImportOrders(local.orders);
    const customers = onImportCustomers(local.customers);
    // Máy chủ chưa có thực đơn: lấy nguyên thực đơn cũ. Đã có: chỉ thêm món chưa có, giữ giá trên máy chủ.
    const known = new Set(menu.map((m) => normalizeText(m.name)));
    const missing = local.menu.filter((m) => m.name && !known.has(normalizeText(m.name)));
    let menuAdded = missing.length;
    if (!menu.length) menuAdded = local.menu.length ? onImportMenu(local.menu) : 0;
    else missing.forEach((m) => onAddMenuItem({ name: m.name, price: m.price }));
    // Thông tin quán: chỉ điền những ô máy chủ còn để trống
    const shop = Object.fromEntries(Object.entries(local.shop).filter(([k]) => !settings[k]));
    if (Object.keys(shop).length) onUpdateSettings(shop);
    markLocalDataMoved();
    setVisible(false);
    setMessage(
      `Đã chuyển lên máy chủ: ${orders} đơn, ${customers} khách mới${local.menu.length ? `, ${menuAdded} món mới` : ''}. Giờ mọi máy đăng nhập đều thấy.`,
    );
  };

  return (
    <section className="rounded-3xl bg-blue-50 px-5 py-4 ring-1 ring-blue-200">
      {message ? (
        <p className="font-semibold text-blue-800">{message}</p>
      ) : (
        <>
          <p className="flex items-center gap-2 font-bold text-blue-900">
            <CloudUpload size={18} /> Chuyển dữ liệu cũ lên máy chủ
          </p>
          <p className="mt-1 text-sm text-blue-900">
            Máy này còn {readLocalData().orders.length} đơn và {readLocalData().customers.length} khách từ bản cũ (chỉ
            lưu trên máy này). Bấm để đưa lên máy chủ cho mọi người dùng chung. Đơn, khách đã có trên máy chủ không bị
            nhân đôi.
            {menu.length > 0 && ' Thực đơn trên máy chủ được giữ, chỉ thêm món chưa có.'}
          </p>
          <button
            onClick={move}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600"
          >
            <CloudUpload size={18} /> Chuyển lên máy chủ
          </button>
          <button
            onClick={() => {
              markLocalDataMoved();
              setVisible(false);
            }}
            className="mt-2 w-full text-sm font-semibold text-blue-700"
          >
            Không cần, ẩn đi
          </button>
        </>
      )}
    </section>
  );
}
