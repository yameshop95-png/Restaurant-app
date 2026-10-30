import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Upload, Users } from 'lucide-react';
import { exportCustomers, importCustomersFile } from '../lib/customerExcel';

export default function SettingsPage({ customers, onImportCustomers }) {
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

  const handleExport = () =>
    run(async () => {
      await exportCustomers(customers);
      return `Đã tải file Excel gồm ${customers.length} khách hàng`;
    });

  const handleImport = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(async () => {
      const list = await importCustomersFile(file);
      if (!list.length) throw new Error('File không có khách hàng nào');
      const added = onImportCustomers(list);
      return `Đã đọc ${list.length} khách trong file: thêm mới ${added}, cập nhật ${list.length - added}`;
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="overflow-hidden rounded-3xl border border-white/80 bg-white/80 shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <FileSpreadsheet size={22} />
          </div>
          <div>
            <h2 className="font-bold text-slate-900">Sao lưu khách hàng (Excel)</h2>
            <p className="flex items-center gap-1 text-sm text-slate-500">
              <Users size={14} /> Đang lưu {customers.length} khách hàng
            </p>
          </div>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-slate-600">
            Danh bạ chỉ lưu trên máy này. Thỉnh thoảng hãy tải file Excel về để phòng khi app lỗi, đổi máy hoặc lỡ
            xoá dữ liệu trình duyệt. Khi cần, chọn <b>Nhập từ Excel</b> để khôi phục.
          </p>

          <button
            onClick={handleExport}
            disabled={busy || !customers.length}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 font-semibold text-white active:bg-emerald-600 disabled:bg-slate-300"
          >
            <Download size={19} /> Tải file Excel khách hàng
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-slate-300 py-3 font-semibold text-slate-700 active:bg-slate-50 disabled:opacity-50"
          >
            <Upload size={19} /> Nhập từ Excel
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" onChange={handleImport} className="hidden" />

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
    </div>
  );
}
