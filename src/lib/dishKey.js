import { normalizeText } from './text';

// Khoá gộp món dùng chung cho mọi báo cáo (PR #80): tên đã chuẩn hoá, bỏ hậu tố
// TRỌNG LƯỢNG ở cuối tên. Cùng một món bị tách thành nhiều dòng chỉ vì cách ghi tên
// khác nhau giữa các nguồn: thực đơn web/app ghi kèm định lượng ("Giò lụa 500g",
// "Bánh cuốn 1kg"), sổ giấy và đơn nhập tay thì không ("Giò Lụa", "Bánh cuốn"). Chỉ bỏ
// token trọng lượng cuối tên (500g, 1kg, 1 kg...) — các phân biệt thật như "nhỏ",
// "mặn", "ngọt", "chuối" giữ nguyên.
// Bí danh theo thực đơn trong Cài đặt app — nguồn sự thật cho danh tính món (Paul chốt
// 24/11: "cùng món nhưng giá mới" thì vẫn là một món). Sổ giấy ghi tên khác thực đơn
// hiện tại: thiếu chữ "Bánh", ghi thêm "mặn" cho món mặn mặc định, hoặc tên cũ trước
// khi quán đổi tên. Các biến thể "ngọt" là món khác hẳn nên KHÔNG có bí danh.
// Trước PR #80 khoá này chỉ nằm trong lib/report.js, còn lib/stats.js gộp theo tên thô
// và lib/forecast.js gộp theo normalizeText — ba nơi ba số khác nhau cho cùng một món.
const DISH_ALIASES = {
  'banh chung man': 'banh chung',
  'banh tet man': 'banh tet',
  'tet chuoi': 'banh tet chuoi',
  'tau hu': 'tau hu singapore',
};

export function dishKey(name) {
  const base = normalizeText(name)
    .replace(/\s+\d+(?:[.,]\d+)?\s*(kg|g)$/, '')
    .trim();
  return DISH_ALIASES[base] ?? base;
}

// Tên hiển thị chuẩn của một khoá món: món nào có trong thực đơn Cài đặt app thì hiện
// đúng tên thực đơn (VD khoá của "Tàu Hũ" hiện là "Tàu Hũ Singapore"); không có thì
// dùng tên dự phòng nơi gọi truyền vào (thường là biến thể bán nhiều nhất trong nhóm).
export function dishLabel(key, menu = [], fallbackName) {
  for (const m of menu ?? []) {
    if (m?.name && dishKey(m.name) === key) return m.name;
  }
  return fallbackName;
}
