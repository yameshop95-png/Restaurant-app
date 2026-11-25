// supabase giả: không mạng, mọi truy vấn trả rỗng.
export const supabase = {
  from: () => ({
    select: () => Promise.resolve({ data: [], error: null }),
    upsert: () => Promise.resolve({ error: null }),
    delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
  }),
  channel: () => ({ on: () => ({ subscribe: () => {} }) }),
  removeChannel: () => {},
};
export const isNetworkError = () => false;
