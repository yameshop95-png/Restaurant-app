import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import useInventory from '../hooks/useInventory';
import { downloadAnalytics } from '../lib/analyticsExport';

// Tải file Excel dữ liệu phân tích (gộp theo tháng) về máy, để lưu vào máy tính hoặc thư mục OneDrive.
export default function AnalyticsExportCard({ orders, menu, settings }) {
  const inventory = useInventory();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const download = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const inv = inventory.ready && !inventory.missingTables
        ? {
            ingredients: inventory.ingredients.list,
            purchases: inventory.purchases.list,
            expenses: inventory.expenses.list,
            recipes: inventory.recipes.list,
            batches: inventory.batches.list,
          }
        : null;
      await downloadAnalytics(
        { orders, now: new Date(), weatherLog: settings.weatherLog ?? {}, inventory: inv, menu: menu ?? [] },
        settings.shopName,
      );
      setMsg(inv ? 'Đã tải file.' : 'Đã tải file (chưa có sheet phân loại món vì dữ liệu Inventory chưa tải xong).');
    } catch (e) {
      setMsg(`Không tạo được file: ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-card px-5 pb-4 pt-4 shadow-sm">
      <h2 className="text-[15px] text-slate-500">Dữ liệu phân tích theo tháng</h2>
      <p className="mt-1 text-sm text-slate-600">
        File Excel gồm: khách theo ngôn ngữ, món theo tháng, món theo tuần (dữ liệu học dự báo), kiểm tra độ chính xác dự báo,
        dự báo đã lưu trên máy này và phân loại món. Lưu vào máy tính hoặc thư mục OneDrive mỗi tháng.
      </p>
      <button
        type="button"
        onClick={download}
        disabled={busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 py-3 font-semibold text-white active:bg-blue-600 disabled:opacity-60"
      >
        {busy ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <Download size={18} aria-hidden="true" />}
        Tải file phân tích (.xlsx)
      </button>
      {msg && <p className="mt-2 text-center text-sm text-slate-500">{msg}</p>}
    </section>
  );
}
