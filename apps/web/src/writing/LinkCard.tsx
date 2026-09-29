import { getMarkRange, type Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import { useEffect, useReducer, useState } from "react";
import { createPortal } from "react-dom";
import { LinkField } from "./LinkField";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const action = `h-8 cursor-pointer rounded-md border-0 bg-transparent px-2.5 text-[13px] text-ink/70 transition-colors duration-150 hover:text-ink motion-reduce:transition-none ${focusRing}`;

// The card's widest size, and the room it always keeps from the window's edges.
const CARD_WIDTH = 360;
const EDGE = 12;

// When the cursor is on a link, a small card appears just under it, as in other editors: the
// address (opens in a new tab), Edit (change it in place) and Remove (back to plain words).
// Clicking a link while writing never jumps away; the card is how you follow it.
export function LinkCard({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const onLink = e.isActive("link") && e.state.selection.empty;
      // The card sits under the start of the linked words, wherever the cursor is inside them.
      const range = onLink ? getMarkRange(e.state.selection.$from, e.schema.marks.link!) : undefined;
      return {
        href: onLink ? ((e.getAttributes("link").href as string | undefined) ?? null) : null,
        at: range?.from ?? e.state.selection.from,
        focused: e.isFocused
      };
    }
  });
  const [editing, setEditing] = useState(false);
  // The card sits by the link on screen, so it follows the page when it scrolls or resizes.
  const [, reposition] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, []);
  // Leaving the link closes the editing field too.
  useEffect(() => {
    if (!state.href) setEditing(false);
  }, [state.href]);

  if (!state.href || (!state.focused && !editing)) return null;
  // Never wider than the window (less a margin on each side), and always kept inside it.
  const width = Math.min(CARD_WIDTH, window.innerWidth - 2 * EDGE);
  const spot = editor.view.coordsAtPos(state.at);
  const left = Math.max(EDGE, Math.min(spot.left, window.innerWidth - width - EDGE));
  const place = { position: "fixed" as const, top: spot.bottom + 6, left };

  // Drawn at the top of the page (not inside the sliding panels, whose movement would throw
  // the position off), so it lands exactly under the link.
  if (editing) {
    return createPortal(
      <div style={{ ...place, width }}>
        <LinkField editor={editor} className="relative w-full" onDone={() => setEditing(false)} />
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      role="group"
      aria-label="Link"
      style={{ ...place, maxWidth: width }}
      className="z-30 flex items-center gap-1 rounded-md border border-line-strong bg-surface p-1 shadow-[0_8px_24px_rgba(0,0,0,0.10)]"
      // Clicking the card keeps the cursor where it is in the writing.
      onMouseDown={(e) => e.preventDefault()}
    >
      <a
        href={state.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`min-w-0 truncate rounded-md px-2 py-1 text-[13px] text-accent underline underline-offset-2 ${focusRing}`}
      >
        {state.href.replace(/^https?:\/\//, "")}
      </a>
      <div aria-hidden="true" className="h-5 w-px shrink-0 bg-line" />
      <button type="button" className={action} onClick={() => setEditing(true)}>
        Edit
      </button>
      <button type="button" className={action} onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
        Remove
      </button>
    </div>,
    document.body
  );
}
