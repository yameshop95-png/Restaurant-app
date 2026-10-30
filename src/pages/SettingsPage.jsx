import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, Users, UtensilsCrossed } from 'lucide-react';
import { exportCustomers, importCustomersFile } from '../lib/customerExcel';
import { exportMenu, importMenuFile } from '../lib/menuExcel';

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

export default function SettingsPage({ customers, menu, onImportCustomers, onImportMenu }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="px-1 text-sm text-slate-600">
        Dữ liệu chỉ lưu trên máy này. Thỉnh thoảng hãy tải file Excel về để phòng khi app lỗi, đổi máy hoặc lỡ xoá
        dữ liệu trình duyệt. Khi cần, chọn <b>Nhập từ Excel</b> để khôi phục.
      </p>

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
  );
}
