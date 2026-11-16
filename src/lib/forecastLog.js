// Lưu lại dự báo của từng tuần trên máy này (localStorage), để về sau so với số bán thật và cải tiến cách dự báo.
// Không gửi lên máy chủ. Dữ liệu được đưa vào file Excel "Tải dữ liệu phân tích" (sheet "Dự báo đã lưu").
const KEY = 'restaurant-app.forecastLog';
const KEEP = 104; // giữ 2 năm

export function readForecastLog() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

// Lưu dự báo đầu tiên của tuần (lần sau trong cùng tuần không ghi đè, để giữ dự báo "trước khi biết kết quả")
export function saveForecastOnce(forecast) {
  if (!forecast?.ready || !forecast.weekKey) return;
  try {
    const log = readForecastLog();
    if (log[forecast.weekKey]) return;
    log[forecast.weekKey] = {
      at: new Date().toISOString(),
      families: forecast.families,
      weather: forecast.weather ?? null,
      items: forecast.items.map((it) => ({ name: it.name, expected: Math.round(it.expected * 10) / 10, method: it.method })),
    };
    const keys = Object.keys(log).sort();
    for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete log[k];
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // Bộ nhớ đầy / chế độ ẩn danh: bỏ qua, dự báo vẫn hiện bình thường
  }
}
