import { Fragment } from 'react';
import { useSite } from './ui';

function photoSrc(src) {
  const file = String(src).split('/').pop();
  if (src.startsWith('blog-images/') || src.includes('/blog-images/')) return `/site/photos/${file}`;
  return src;
}

// Markdown đơn giản cho bài blog, dựng thành phần tử React (không chèn HTML thô):
// "## " / "### " tiêu đề, "- " danh sách, đoạn cách 1 dòng trống, **đậm**, *nghiêng*, [chữ](link)
function inline(text, onNavigate, keyPrefix) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyPrefix}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else {
      const href = m[5];
      const internal = href.startsWith('/');
      if (internal || /^https?:\/\//.test(href)) {
        out.push(
          <a
            key={k}
            href={href}
            className="font-semibold text-blue-500 underline decoration-blue-500/40 underline-offset-2"
            {...(internal
              ? { onClick: (e) => onNavigate?.(e, href) }
              : { target: '_blank', rel: 'noopener noreferrer' })}
          >
            {m[4]}
          </a>
        );
      } else out.push(m[4]);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ source, onNavigate }) {
  const site = useSite();
  const soon = site?.t?.photoSoon || 'Photo coming soon';
  const blocks = source
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim()
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-slate-700">
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
        const missing = block.match(/^\[ẢNH:[^\]]*\]$/);
        if (missing) {
          return (
            <div
              key={bi}
              role="img"
              aria-label={soon}
              className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-500"
            >
              {soon}
            </div>
          );
        }
        const img = block.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (img) {
          return (
            <figure key={bi} className="overflow-hidden rounded-2xl">
              <img src={photoSrc(img[2])} alt={img[1]} className="aspect-[16/9] w-full object-cover" />
            </figure>
          );
        }
        if (block.startsWith('### ')) return <h3 key={bi} className="pt-2 text-xl font-bold text-slate-900">{inline(block.slice(4), onNavigate, bi)}</h3>;
        if (block.startsWith('## ')) return <h2 key={bi} className="pt-3 text-2xl font-bold text-slate-900">{inline(block.slice(3), onNavigate, bi)}</h2>;
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={bi} className="list-disc space-y-1.5 pl-6 marker:text-blue-500">
              {lines.map((l, li) => (
                <li key={li}>{inline(l.slice(2), onNavigate, `${bi}-${li}`)}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={bi}>
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {inline(l, onNavigate, `${bi}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
