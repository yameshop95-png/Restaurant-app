// Toạ độ giao hàng lưu THẲNG trên đơn (trường `geo` trong dữ liệu đơn, đồng bộ qua
// máy chủ như mọi trường khác) — nguồn toạ độ CHUNG cho mọi máy.
//
// Vì sao: trước đây toạ độ chỉ nằm trong cache của từng máy (localStorage, xem
// lib/geo.js), nên nhãn đợt ở hàng Chờ nấu mỗi máy một khác — máy đã tra nhiều
// địa chỉ thì đợt xếp theo vùng/điểm gần, máy cache trống thì đợt chỉ xếp theo
// giờ. Nay đợt và lộ trình đọc toạ độ từ chính đơn: máy nào mở cũng tính ra cùng
// một kết quả, máy mới cài hay máy bị xoá cache cũng không lệch.
//
// Bản ghi trên đơn: { lat, lng, zone, for } — `for` là địa chỉ mà toạ độ thuộc
// về; khách sửa địa chỉ thì bản ghi cũ tự hết hiệu lực (storedGeoOf trả null)
// và app tra lại địa chỉ mới.

// Toạ độ dùng được của đơn: có bản ghi, đúng địa chỉ hiện tại, lat/lng là số.
// Trả { lat, lng, zone } hoặc null.
export function storedGeoOf(order) {
  const g = order?.geo;
  const address = order?.customer?.address;
  if (!g || !address || g.for !== address) return null;
  if (typeof g.lat !== 'number' || typeof g.lng !== 'number') return null;
  return { lat: g.lat, lng: g.lng, zone: g.zone ?? null };
}

// Đóng gói kết quả tra địa chỉ (từ lib/geo) thành bản ghi lưu lên đơn.
export function geoRecordFor(address, hit) {
  return { lat: hit.lat, lng: hit.lng, zone: hit.zone ?? null, for: address };
}
