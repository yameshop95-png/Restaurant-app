// Đồng bộ tay từ nút "Đồng bộ lại" trên TopBar: mỗi danh sách đám mây (useCloudList)
// đăng ký một hàm làm mới toàn bộ bảng của nó vào đây; bấm nút thì chạy tất cả các
// hàm đã đăng ký và chờ xong để nút hết quay. Một bảng có thể có nhiều bản đăng ký
// (vd useInventory được gọi ở nhiều nơi) — chạy hết, bản nào lỗi cũng không chặn bản khác.
const handlers = new Set();

export function registerResync(fn) {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

export async function requestResync() {
  await Promise.allSettled([...handlers].map((fn) => fn()));
}
