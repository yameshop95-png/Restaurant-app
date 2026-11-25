// useInventory giả cho test SSR: kho rỗng, đã sẵn sàng — các thẻ hiệu suất/xuất dữ
// liệu render khung thường với số 0 thay vì chờ dữ liệu thật.
const empty = () => ({ list: [] });
export default function useInventory() {
  return {
    ready: true,
    missingTables: false,
    ingredients: empty(),
    purchases: empty(),
    expenses: empty(),
    recipes: empty(),
    batches: empty(),
    adjustments: empty(),
  };
}
