import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type HTMLAttributes } from "react";

// How the box shows that it scrolls:
//   hidden    no bar (lists, panels)
//   visible   the Moss thumb always (the long reading pages)
//   scrolling the thumb only while the page is being scrolled (Profile)
export type ScrollbarMode = "hidden" | "visible" | "scrolling";

const FADE_MAX = 28; // px, the tallest an edge fade gets
const BAR_REST_MS = 900; // how long the thumb stays after the last scroll tick

type Props = HTMLAttributes<HTMLDivElement> & { scrollbar?: ScrollbarMode };

// A scroll box. Where more is hiding above or below, that edge fades out, so the writer sees
// there is more. The fade height goes to --fade-top / --fade-bottom (0 at an end), which the
// `.fade-scroll` rules in styles.css mask with; scrolling must not re-render, so it is set
// straight on the element. The bar itself is plain CSS, driven by data-scrollbar.
export const FadeScroll = forwardRef<HTMLDivElement, Props>(function FadeScroll(
  { scrollbar = "hidden", className = "", children, ...rest },
  ref,
) {
  const box = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => box.current!);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let rest = 0;
    const update = () => {
      const below = el.scrollHeight - el.clientHeight - el.scrollTop;
      el.style.setProperty("--fade-top", `${Math.min(FADE_MAX, el.scrollTop)}px`);
      el.style.setProperty("--fade-bottom", `${Math.min(FADE_MAX, Math.max(0, below))}px`);
    };
    const onScroll = () => {
      update();
      if (scrollbar !== "scrolling") return;
      setActive(true);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => setActive(false), BAR_REST_MS);
    };
    update();
    el.addEventListener("scroll", onScroll, { passive: true });
    // What is hidden also changes when the box or its content changes size.
    const watch = new ResizeObserver(update);
    watch.observe(el);
    for (const child of Array.from(el.children)) watch.observe(child);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.clearTimeout(rest);
      watch.disconnect();
    };
  }, [scrollbar]);

  return (
    <div
      ref={box}
      {...rest}
      data-scrollbar={scrollbar}
      data-active={active || undefined}
      className={`fade-scroll overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
});
