// Nhớ mục đang xem trong phiên làm việc (sessionStorage) để khi app tự tải
// lại — ví dụ sau khi cập nhật bản mới, main.jsx nghe vite:preloadError rồi
// reload — app mở lại đúng mục đang xem thay vì văng về màn hình chính.
// Paul báo 25/11/2026: vô app bấm Báo cáo thì bị văng ra màn hình chính,
// bấm lại mới vào được — nguyên nhân là lần bấm đầu trúng lúc tệp trang
// Báo cáo (tải lười) đã bị bản deploy mới thay, app tải lại trang và mất tab.
// sessionStorage tự mất khi đóng hẳn app nên không ảnh hưởng lần mở sau.
const KEY = 'restaurant-app.resumeTab';

export function loadResumeTab(validIds) {
  try {
    const value = sessionStorage.getItem(KEY);
    return value && validIds.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function saveResumeTab(id) {
  try {
    sessionStorage.setItem(KEY, id);
  } catch {
    // chế độ ẩn danh / bộ nhớ đầy: bỏ qua, app vẫn chạy bình thường
  }
}
