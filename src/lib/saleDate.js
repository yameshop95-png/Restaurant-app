// Quy ước: doanh thu / số đơn / món của một kỳ tính theo NGÀY GIAO (tuần giao).
// Tiền đã thu trong ngày (chốt ca) tính theo paidAt — xem dailyCollection.
export const saleDate = (o) => new Date(o.deliverAt ?? o.createdAt);
