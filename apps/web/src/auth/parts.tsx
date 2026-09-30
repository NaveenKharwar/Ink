import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { Loader } from "../ui/Loader";

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`text-[12px] leading-4 tracking-[0.3em] text-auth-muted ${className}`}>{children}</div>;
}

export function Heading({ children }: { children: ReactNode }) {
  return <h1 className="mt-2 font-display text-[32px] leading-[1.15] font-normal wide:text-[44px]">{children}</h1>;
}

// While busy, the label gives way to the loader (screen readers still hear the label).
export function MainButton({
  children,
  busy = false,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button
      {...rest}
      disabled={busy || rest.disabled}
      aria-busy={busy || undefined}
      className={`flex h-12 w-full cursor-pointer items-center justify-center gap-3 rounded-auth-control border-0 bg-auth-ink text-[15px] font-medium text-white hover:bg-black disabled:cursor-default disabled:opacity-80 aria-busy:opacity-100 ${className}`}
    >
      {busy ? (
        <>
          <span className="sr-only">{children}</span>
          <Loader size={18} label="Loading" tone="current" className="text-auth-sunset" />
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function LinkButton({
  children,
  quiet = false,
  strong = false,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { quiet?: boolean; strong?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={`cursor-pointer border-0 bg-transparent px-0 py-1 underline underline-offset-2 ${quiet ? "text-auth-muted" : "text-auth-ink"} ${strong ? "font-medium" : ""}`}
    >
      {children}
    </button>
  );
}

export function Label({ htmlFor, children, className = "" }: { htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={`mb-1.5 block font-medium ${className}`}>
      {children}
    </label>
  );
}

export function TextField({ invalid, className = "", ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...rest}
      aria-invalid={invalid || undefined}
      className={`box-border h-12 w-full rounded-auth-control border bg-white px-3.5 text-[16px] text-auth-ink placeholder:text-auth-muted ${invalid ? "border-auth-ink" : "border-auth-line"} ${className}`}
    />
  );
}

// Plain words in ink with a small outlined icon; never red, never a banner.
export function Message({ children, icon = true, muted = false }: { children: ReactNode; icon?: boolean; muted?: boolean }) {
  return (
    <div className={`mt-2.5 flex items-start gap-2 text-[13px] leading-[18px] ${muted ? "text-auth-muted" : ""}`}>
      {icon && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mt-px shrink-0" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7.5v5.5M12 16.5v.01" />
        </svg>
      )}
      <span>{children}</span>
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A11.9 11.9 0 0 1 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.7-.4-3.9z" />
    </svg>
  );
}
