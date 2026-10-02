import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// A web address typed without its "https://" still works.
function withProtocol(address: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(address) ? address : `https://${address}`;
}

// Notes: add, change or remove the link on the selected words. Opens just above the tool bar
// (or where `className` places it, such as inside the link card); Enter keeps it, Escape
// leaves the words as they were.
export function LinkField({
  editor,
  onDone,
  className = "absolute bottom-[calc(100%+8px)] left-3 right-3 max-w-[360px]"
}: {
  editor: Editor;
  onDone: () => void;
  className?: string;
}) {
  const current = (editor.getAttributes("link").href as string | undefined) ?? "";
  const [value, setValue] = useState(current);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.select();
  }, []);

  const close = () => {
    onDone();
    editor.commands.focus();
  };
  const apply = () => {
    const address = value.trim();
    const chain = editor.chain().focus().extendMarkRange("link");
    if (address) chain.setLink({ href: withProtocol(address) }).run();
    else chain.unsetLink().run();
    onDone();
  };

  return (
    <div className={`${className} z-30 flex items-center gap-2 rounded-md border border-line-strong bg-surface p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)]`}>
      <input
        ref={input}
        aria-label="Link address"
        value={value}
        placeholder="Paste a link"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
          if (e.key === "Escape") close();
        }}
        className="h-9 w-0 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2.5 text-[14px] text-ink outline-none placeholder:text-ink-muted focus:border-accent"
      />
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={apply}
        className={`touch-44 h-9 cursor-pointer rounded-md border-0 bg-ink px-3 text-[13px] font-medium text-on-ink ${focusRing}`}
      >
        {!current ? "Add" : value.trim() ? "Save" : "Remove"}
      </button>
    </div>
  );
}
