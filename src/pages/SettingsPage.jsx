import { useRef, useState } from 'react';
import {
  Archive,
  ClipboardList,
  Download,
  FileSpreadsheet,
  ImagePlus,
  Map as MapIcon,
  Store,
  Trash2,
  Upload,
  Users,
  UtensilsCrossed,
  Volume2,
} from 'lucide-react';
import { BACKUP_REMINDER_DAYS, daysSinceBackup, readBackup } from '../lib/backup';
import { exportCustomers, importCustomersFile } from '../lib/customerExcel';
import { exportMenu, importMenuFile } from '../lib/menuExcel';
import { alertBeep } from '../lib/due';
import { exportOrders, importOrdersFile } from '../lib/orderExcel';

// Một khối "Tải file Excel / Nhập từ Excel". `onExport` và `onImport` trả về câu thông báo khi xong.
function BackupSection({ icon: Icon, title, countText, description, exportLabel, canExport, onExport, onImport }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const run = async (task) => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ok: true, text: await task() });
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Có lỗi xảy ra, thử lại nhé' });
    } finally {
      setBusy(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) run(() => onImport(file));
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
          <FileSpreadsheet size={22} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">{title}</h2>
          <p className="flex items-center gap-1 text-sm text-slate-500">
            <Icon size={14} /> {countText}
          </p>
        </div>
      </div>

      <div className="space-y-3 px-5 py-4">
        <p className="text-sm text-slate-600">{description}</p>

        <button
          onClick={() => run(onExport)}
          disabled={busy || !canExport}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white active:bg-emerald-600 disabled:bg-slate-300"
        >
          <Download size={19} /> {exportLabel}
        </button>

        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
        >
          <Upload size={19} /> Nhập từ Excel
        </button>
        <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFile} className="hidden" />

        {message && (
          <p
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
              message.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}

// Thu nhỏ logo về 128×128 (cắt vuông giữa ảnh) để lưu gọn trong máy
function resizeLogo(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 128;
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Không đọc được ảnh này'));
    img.src = URL.createObjectURL(file);
  });
}

const inputClass =
  'w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

function ShopInfo({ settings, onUpdateSettings }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setError(null);
      onUpdateSettings({ logo: await resizeLogo(file) });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
          <Store size={22} />
        </div>
        <h2 className="font-bold text-slate-900">Thông tin quán</h2>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="flex items-center gap-4">
          {settings.logo ? (
            <img src={settings.logo} alt="Logo quán" className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ImagePlus size={26} />
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded-xl border-2 border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 active:bg-slate-50"
            >
              {settings.logo ? 'Đổi logo' : 'Chọn logo'}
            </button>
            {settings.logo && (
              <button
                onClick={() => onUpdateSettings({ logo: null })}
                className="flex items-center gap-1 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 active:bg-red-100"
              >
                <Trash2 size={15} /> Bỏ logo
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={pickLogo} className="hidden" />
        </div>
        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Tên quán</span>
          <input
            value={settings.shopName}
            onChange={(e) => onUpdateSettings({ shopName: e.target.value })}
            placeholder="VD: Phở Hà Nội"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">SĐT quán</span>
          <input
            type="tel"
            value={settings.shopPhone}
            onChange={(e) => onUpdateSettings({ shopPhone: e.target.value })}
            placeholder="Hiện ở cuối menu, bấm là gọi được"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">Địa chỉ quán</span>
          <input
            value={settings.shopAddress}
            onChange={(e) => onUpdateSettings({ shopAddress: e.target.value })}
            placeholder="Điểm xuất phát lộ trình giao khi không có GPS"
            className={inputClass}
          />
        </label>
        <p className="text-xs text-slate-400">Tự lưu khi gõ. Tên quán hiện ở menu và trong tin nhắn gửi shipper.</p>
      </div>
    </section>
  );
}

function MapsSettings({ settings, onUpdateSettings }) {
  const options = [
    ['apple', 'Apple Maps', 'Bản đồ có sẵn trên iPhone'],
    ['google', 'Google Maps', 'Cần cài app Google Maps'],
  ];
  return (
    <section className="rounded-3xl border border-white/80 bg-white/80 px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
          <MapIcon size={22} />
        </div>
        <div>
          <h2 className="font-bold text-slate-900">Ứng dụng bản đồ</h2>
          <p className="text-sm text-slate-500">Dùng khi bấm vào địa chỉ và khi mở lộ trình giao</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {options.map(([id, label, hint]) => {
          const active = settings.mapsApp === id;
          return (
            <button
              key={id}
              onClick={() => onUpdateSettings({ mapsApp: id })}
              aria-pressed={active}
              className={`rounded-2xl border-2 px-3 py-2.5 text-left ${active ? 'border-blue-500 bg-blue-50' : 'border-slate-200'}`}
            >
              <span className={`block font-semibold ${active ? 'text-blue-700' : 'text-slate-800'}`}>{label}</span>
              <span className="text-xs text-slate-500">{hint}</span>
            </button>
          );
        })}
      </div>
      {settings.mapsApp === 'apple' && (
        <p className="mt-2 text-xs text-slate-400">
          Lộ trình nhiều điểm trên Apple Maps cần iOS 18.4 trở lên. Máy cũ hơn hãy chọn Google Maps.
        </p>
      )}
      <p className="mt-1 text-xs text-slate-400">
        Link bản đồ trong tin nhắn gửi shipper cũng dùng ứng dụng này
        {settings.mapsApp === 'apple' && ' (shipper dùng Android sẽ mở bản đồ Apple trên trình duyệt)'}.
      </p>
    </section>
  );
}

function AlertSettings({ settings, onUpdateSettings }) {
  return (
    <section className="flex items-center gap-3 rounded-3xl border border-white/80 bg-white/80 px-5 py-4 shadow-sm">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
        <Volume2 size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="font-bold text-slate-900">Âm báo giờ giao</h2>
        <p className="text-sm text-slate-500">Kêu + rung khi đơn còn 30 phút tới giờ giao và khi trễ giờ</p>
        <button onClick={alertBeep} className="mt-1 text-sm font-semibold text-blue-600">
          Nghe thử
        </button>
      </div>
      <button
        role="switch"
        aria-checked={settings.dueSound}
        aria-label="Âm báo giờ giao"
        onClick={() => onUpdateSettings({ dueSound: !settings.dueSound })}
        className={`relative h-8 w-14 shrink-0 rounded-full transition ${settings.dueSound ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${settings.dueSound ? 'left-7' : 'left-1'}`}
        />
      </button>
    </section>
  );
}

function backupStatus(lastBackupAt) {
  const days = daysSinceBackup(lastBackupAt);
  if (days == null) return 'Chưa sao lưu lần nào';
  if (days === 0) return 'Sao lưu gần nhất: hôm nay';
  return `Sao lưu gần nhất: ${days} ngày trước${days >= BACKUP_REMINDER_DAYS ? ' – nên sao lưu lại' : ''}`;
}

export default function SettingsPage({
  orders,
  customers,
  menu,
  settings,
  onUpdateSettings,
  onBackupNow,
  onImportOrders,
  onImportCustomers,
  onImportMenu,
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <ShopInfo settings={settings} onUpdateSettings={onUpdateSettings} />
      <MapsSettings settings={settings} onUpdateSettings={onUpdateSettings} />
      <AlertSettings settings={settings} onUpdateSettings={onUpdateSettings} />

      <BackupSection
        icon={Archive}
        title="Sao lưu tất cả (1 file Excel)"
        countText={backupStatus(settings.lastBackupAt)}
        description={`Dữ liệu chỉ lưu trên máy này. Mỗi tuần tải 1 file gồm đơn hàng, khách hàng và thực đơn (3 sheet), rồi cất vào Google Drive, Zalo hoặc email. Khi đổi máy hay app lỗi, chọn "Nhập từ Excel" với file đó để khôi phục tất cả. App sẽ nhắc nếu quá ${BACKUP_REMINDER_DAYS} ngày chưa sao lưu.`}
        exportLabel="Tải file sao lưu"
        canExport={orders.length + customers.length + menu.length > 0}
        onExport={async () => {
          await onBackupNow();
          return `Đã tải file sao lưu: ${orders.length} đơn, ${customers.length} khách, ${menu.length} món`;
        }}
        onImport={async (file) => {
          const data = await readBackup(file);
          const parts = [];
          if (data.orders) parts.push(`${onImportOrders(data.orders)} đơn mới`);
          if (data.customers) {
            const added = onImportCustomers(data.customers);
            parts.push(`${added} khách mới (cập nhật ${data.customers.length - added})`);
          }
          if (data.menu) {
            const added = onImportMenu(data.menu);
            parts.push(`${added} món mới (cập nhật ${data.menu.length - added})`);
          }
          return `Đã khôi phục: ${parts.join(', ')}`;
        }}
      />

      <details className="rounded-3xl bg-white/50 px-1 py-1">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-600">
          Sao lưu / khôi phục từng phần
        </summary>
        <div className="space-y-4 pb-1">
          <BackupSection
            icon={ClipboardList}
            title="Sao lưu đơn hàng (Excel)"
            countText={`Đang lưu ${orders.length} đơn`}
            description="Gồm tất cả đơn (cả đơn đã huỷ): khách, giờ giao, ghi chú, trạng thái, thanh toán và từng món. Khi nhập lại, chỉ thêm các đơn chưa có trong app, đơn đã có giữ nguyên."
            exportLabel="Tải file Excel đơn hàng"
            canExport={orders.length > 0}
            onExport={async () => {
              await exportOrders(orders);
              return `Đã tải file Excel gồm ${orders.length} đơn`;
            }}
            onImport={async (file) => {
              const list = await importOrdersFile(file);
              if (!list.length) throw new Error('File không có đơn nào');
              const added = onImportOrders(list);
              return `Đã đọc ${list.length} đơn trong file: thêm mới ${added}, bỏ qua ${list.length - added} đơn đã có`;
            }}
          />

          <BackupSection
            icon={Users}
            title="Sao lưu khách hàng (Excel)"
            countText={`Đang lưu ${customers.length} khách hàng`}
            description="Gồm tên, số điện thoại và địa chỉ. Khi nhập lại, khách trùng SĐT được cập nhật, không bị nhân đôi."
            exportLabel="Tải file Excel khách hàng"
            canExport={customers.length > 0}
            onExport={async () => {
              await exportCustomers(customers);
              return `Đã tải file Excel gồm ${customers.length} khách hàng`;
            }}
            onImport={async (file) => {
              const list = await importCustomersFile(file);
              if (!list.length) throw new Error('File không có khách hàng nào');
              const added = onImportCustomers(list);
              return `Đã đọc ${list.length} khách trong file: thêm mới ${added}, cập nhật ${list.length - added}`;
            }}
          />

          <BackupSection
            icon={UtensilsCrossed}
            title="Sao lưu thực đơn (Excel)"
            countText={`Đang có ${menu.length} món`}
            description="Gồm tên món, giá và trạng thái Còn/Hết, theo đúng thứ tự trong app. Khi nhập lại, thực đơn được xếp theo thứ tự trong file và món trùng tên được cập nhật giá, không bị nhân đôi."
            exportLabel="Tải file Excel thực đơn"
            canExport={menu.length > 0}
            onExport={async () => {
              await exportMenu(menu);
              return `Đã tải file Excel gồm ${menu.length} món`;
            }}
            onImport={async (file) => {
              const items = await importMenuFile(file);
              if (!items.length) throw new Error('File không có món nào');
              const added = onImportMenu(items);
              return `Đã đọc ${items.length} món trong file: thêm mới ${added}, cập nhật ${items.length - added}`;
            }}
          />
        </div>
      </details>
    </div>
  );
}
