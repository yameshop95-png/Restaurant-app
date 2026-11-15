// Safari cũ (iOS / iPadOS trước 15.4) không hiểu @layer nên bỏ qua TOÀN BỘ CSS của Tailwind v4 (app hiện chữ trơn, không màu).
// Sau khi build, bỏ vỏ @layer: giữ nguyên nội dung và thứ tự (properties → theme → base → components → utilities),
// nên trình duyệt mới hiển thị y như cũ mà trình duyệt cũ vẫn đọc được.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Tách CSS thành các khối cấp ngoài cùng (bỏ qua dấu ngoặc trong chuỗi và chú thích)
function topLevel(css) {
  const items = [];
  let depth = 0;
  let start = 0;
  let i = 0;
  const n = css.length;
  while (i < n) {
    const ch = css[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && css[j] !== ch) j += css[j] === '\\' ? 2 : 1;
      i = j + 1;
      continue;
    }
    if (ch === '/' && css[i + 1] === '*') {
      const j = css.indexOf('*/', i + 2);
      i = j < 0 ? n : j + 2;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        items.push(css.slice(start, i + 1));
        start = i + 1;
      }
    } else if (ch === ';' && depth === 0) {
      items.push(css.slice(start, i + 1));
      start = i + 1;
    }
    i++;
  }
  if (css.slice(start).trim()) items.push(css.slice(start));
  return items;
}

// Bỏ vỏ @layer. Quy tắc nằm ngoài layer vốn được ưu tiên hơn mọi layer, nên dời chúng xuống cuối file
// để vẫn thắng như cũ (thứ tự các layer giữ nguyên: properties → theme → base → components → utilities).
export function flattenLayers(css) {
  const layered = [];
  const unlayered = [];
  for (const item of topLevel(css)) {
    const head = item.replace(/^\s*(\/\*[\s\S]*?\*\/\s*)*/, '');
    const comments = item.slice(0, item.length - head.length);
    if (comments) layered.push(comments);
    if (/^@layer\b/.test(head)) {
      const open = head.indexOf('{');
      if (open < 0) continue; // "@layer a, b;" chỉ khai báo thứ tự
      layered.push(flattenLayers(head.slice(open + 1, head.lastIndexOf('}'))));
    } else if (/^@(property|keyframes|font-face|charset|import)\b/.test(head)) {
      layered.push(head);
    } else if (head.trim()) {
      unlayered.push(head);
    }
  }
  return layered.join('') + unlayered.join('');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? 'dist/assets';
  for (const name of readdirSync(dir).filter((f) => f.endsWith('.css'))) {
    const file = join(dir, name);
    const before = readFileSync(file, 'utf8');
    const after = flattenLayers(before);
    writeFileSync(file, after);
    console.log(`[flatten-css-layers] ${name}: ${(before.match(/@layer/g) ?? []).length} @layer → ${(after.match(/@layer/g) ?? []).length}`);
  }
}
