import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, type HTMLAttributes } from "react";

// A scroll box with no scrollbar. Where more is hiding above or below, that edge fades out,
// so the writer sees there is more without a bar to look at. Sets --fade-top / --fade-bottom
// (the fade height in px, 0 at an end) which the `.fade-scroll` rule in styles.css masks with.
export const FadeScroll = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function FadeScroll(
  { className = "", children, ...rest },
  ref,
) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => el.current!);

  const update = useCallback(() => {
    const box = el.current;
    if (!box) return;
    const above = box.scrollTop;
    const below = box.scrollHeight - box.clientHeight - box.scrollTop;
    box.style.setProperty("--fade-top", `${Math.min(28, above)}px`);
    box.style.setProperty("--fade-bottom", `${Math.min(28, below)}px`);
  }, []);

  useEffect(() => {
    const box = el.current;
    if (!box) return;
    update();
    box.addEventListener("scroll", update, { passive: true });
    // Content or box size changes (more seasons, window resize) change what is hidden.
    const watch = new ResizeObserver(update);
    watch.observe(box);
    for (const child of Array.from(box.children)) watch.observe(child);
    return () => {
      box.removeEventListener("scroll", update);
      watch.disconnect();
    };
  }, [update]);

  return (
    <div ref={el} {...rest} className={`fade-scroll overflow-y-auto ${className}`}>
      {children}
    </div>
  );
});
