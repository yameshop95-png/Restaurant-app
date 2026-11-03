import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText as GSAPSplitText } from 'gsap/SplitText';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger, GSAPSplitText, useGSAP);

// Chữ hiện dần từng ký tự / từ khi cuộn tới (theo component SplitText của React Bits, viết lại bằng JS).
// HTML dựng sẵn vẫn có đủ chữ cho Google; trên trình duyệt chữ được tách rồi chạy hiệu ứng.
// Người dùng bật "giảm chuyển động" thì hiện chữ ngay, không chạy hiệu ứng.
export default function SplitText({
  text,
  className = '',
  delay = 40,
  duration = 0.6,
  ease = 'power3.out',
  splitType = 'chars',
  from = { opacity: 0, y: 40 },
  to = { opacity: 1, y: 0 },
  threshold = 0.1,
  rootMargin = '-100px',
  tag: Tag = 'p',
  onLetterAnimationComplete,
}) {
  const ref = useRef(null);
  const doneRef = useRef(onLetterAnimationComplete);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  doneRef.current = onLetterAnimationComplete;

  useEffect(() => {
    if (!document.fonts || document.fonts.status === 'loaded') setFontsLoaded(true);
    else document.fonts.ready.then(() => setFontsLoaded(true));
  }, []);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el || !text || !fontsLoaded) return;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        el.classList.add('split-ready');
        return;
      }
      const startPct = (1 - threshold) * 100;
      const m = /^(-?\d+(?:\.\d+)?)(px|em|rem|%)?$/.exec(rootMargin);
      const mv = m ? parseFloat(m[1]) : 0;
      const mu = m ? m[2] || 'px' : 'px';
      const sign = mv === 0 ? '' : mv < 0 ? `-=${Math.abs(mv)}${mu}` : `+=${mv}${mu}`;

      let targets;
      // Tách cả từ để không ngắt dòng giữa một chữ
      const split = new GSAPSplitText(el, {
        type: splitType === 'chars' ? 'words, chars' : splitType,
        smartWrap: true,
        autoSplit: splitType === 'lines',
        linesClass: 'split-line',
        wordsClass: 'split-word',
        charsClass: 'split-char',
        reduceWhiteSpace: false,
        onSplit: (self) => {
          targets = splitType.includes('chars') ? self.chars : splitType.includes('words') ? self.words : self.lines;
          el.classList.add('split-ready');
          return gsap.fromTo(
            targets,
            { ...from },
            {
              ...to,
              duration,
              ease,
              stagger: delay / 1000,
              scrollTrigger: { trigger: el, start: `top ${startPct}%${sign}`, once: true, fastScrollEnd: true },
              onComplete: () => doneRef.current?.(),
              willChange: 'transform, opacity',
              force3D: true,
            },
          );
        },
      });
      return () => {
        ScrollTrigger.getAll().forEach((st) => st.trigger === el && st.kill());
        split.revert();
      };
    },
    {
      dependencies: [
        text,
        delay,
        duration,
        ease,
        splitType,
        JSON.stringify(from),
        JSON.stringify(to),
        threshold,
        rootMargin,
        fontsLoaded,
      ],
      scope: ref,
    },
  );

  return (
    <Tag ref={ref} className={`split-parent ${className}`}>
      {text}
    </Tag>
  );
}
