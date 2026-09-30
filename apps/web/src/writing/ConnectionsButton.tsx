import { useRef, useState } from "react";
import type { MarkState } from "../lib/connectionsMark";
import { ConnectionsMark } from "./ConnectionsMark";

type Props = {
  /** "Ink sees this too" is open: the mark stays where it is, in the accent with a softly filled triangle. */
  open: boolean;
  /** Opens the panel, or closes it when it is open. */
  onToggle: () => void;
};

// The button for "Ink sees this too": the connections mark, which hovers, turns to the accent with a softly filled
// triangle when pressed and stays that way while the panel is open. It never moves or hides: the panel only
// has its own close button. Hover is for a mouse only (a finger has no hover).
export function ConnectionsButton({ open, onToggle }: Props) {
  const [local, setLocal] = useState<MarkState>("rest");
  const hovering = useRef(false);
  const state: MarkState = open ? "active" : local;

  return (
    <span className="relative">
      <button
        type="button"
        aria-label="Show what Ink sees"
        aria-pressed={open}
        data-tether="mark"
        className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onToggle}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          hovering.current = true;
          setLocal((s) => (s === "rest" ? "hover" : s));
        }}
        onPointerLeave={() => {
          hovering.current = false;
          setLocal("rest");
        }}
        onPointerDown={() => setLocal("press")}
        onPointerUp={() => setLocal(hovering.current ? "hover" : "rest")}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setLocal((s) => (s === "rest" ? "hover" : s));
        }}
        onBlur={() => setLocal("rest")}
      >
        <span className="relative flex">
          <ConnectionsMark state={state} />
        </span>
      </button>
    </span>
  );
}
