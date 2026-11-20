// Giao diện app nhân viên: sáng (mặc định) hoặc tối. Lớp theme-light trên <html> đổi bảng màu trong staff-light.css.
const BAR = { light: '#ecebe6', dark: '#121214' };

export function applyTheme(theme) {
  const mode = theme === 'dark' ? 'dark' : 'light';
  const root = document.documentElement;
  root.classList.toggle('theme-light', mode === 'light');
  root.style.colorScheme = mode;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', BAR[mode]);
}
