import { Fragment } from "react";
import { Loader } from "./Loader";

type Option = { label: string; onClick: () => void };

type Props = {
  options: Option[];
  /** Waiting (a picture is uploading): the loader takes the options' place. */
  busy?: boolean;
  /** Always shown (a tapped picture on a phone, or Move); otherwise only on hover or focus. */
  shown?: boolean;
  className?: string;
};

// The small floating chip on a picture (the cover, a picture in Notes): a few quiet words,
// soft at rest and full ink on hover, never a grey box. It shows when the picture's `group`
// is hovered or focused, or when `shown`.
export function PictureOptions({ options, busy = false, shown = false, className = "" }: Props) {
  return (
    <div
      className={`absolute top-3 right-3 flex h-8 items-center rounded-md border border-line-strong bg-surface px-1 shadow-[0_4px_16px_rgba(0,0,0,0.10)] transition-opacity duration-150 motion-reduce:transition-none ${
        shown || busy ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
      } ${className}`}
    >
      {busy ? (
        <span className="px-2">
          <Loader size={14} label="Adding the picture" />
        </span>
      ) : (
        options.map((option, i) => (
          <Fragment key={option.label}>
            {i > 0 && <span aria-hidden="true" className="h-3.5 w-px bg-line-strong" />}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                option.onClick();
              }}
              className="h-7 cursor-pointer rounded-md border-0 bg-transparent px-2.5 font-sans text-[13px] font-medium text-ink/70 transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
            >
              {option.label}
            </button>
          </Fragment>
        ))
      )}
    </div>
  );
}
