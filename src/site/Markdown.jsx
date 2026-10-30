import { Fragment } from 'react';

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
  const blocks = source.trim().split(/\n\s*\n/);
  return (
    <div className="space-y-5 text-[17px] leading-relaxed text-slate-700">
      {blocks.map((block, bi) => {
        const lines = block.split('\n');
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
