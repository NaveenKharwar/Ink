import type { ButtonHTMLAttributes } from "react";
import { Loader } from "./Loader";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LOOKS = {
  main: "border-0 bg-ink text-on-ink",
  plain: "border border-line-strong bg-surface text-ink hover:bg-surface-hover"
};

// The app's one button, shared by every screen. While busy, the label gives way to the loader
// (screen readers still hear the label) and the button keeps its size, so nothing jumps.
// Sign-in has its own MainButton.
export function Button({
  look = "plain",
  busy = false,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { look?: keyof typeof LOOKS; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
      className={`relative h-11 cursor-pointer rounded-md px-[18px] font-medium disabled:cursor-default ${LOOKS[look]} ${focusRing} ${className}`}
    >
      <span className={busy ? "opacity-0" : undefined}>{children}</span>
      {busy && <Loader size={18} label="Working" tone={look === "main" ? "on-ink" : "surface"} className="absolute inset-0 items-center justify-center" />}
    </button>
  );
}
