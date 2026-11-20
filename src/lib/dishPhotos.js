// Ảnh nhỏ (96 px) của món cho danh sách đơn. Tách riêng khỏi site/lib để app nhân viên không phải tải cả bài blog.
import { DISHES } from '../site/data/dishes';
import { normalizeText } from './text';

const key = (s) => normalizeText(s ?? '').replace(/[^a-z0-9]+/g, ' ').trim();
const slugify = (s) => key(s).replace(/ /g, '-');

export function dishThumb(name) {
  const nameKey = key(name);
  const slug = slugify(name || '');
  const dish = DISHES.find((d) => d.slug === slug || (d.aliases ?? []).some((a) => key(a) === nameKey || slugify(a) === slug));
  const file = dish?.photo?.split('/').pop();
  return file ? `/site/thumbs/${file}` : null;
}
