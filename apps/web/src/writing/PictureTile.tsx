import { useRef, useState } from "react";
import { usePicture } from "../lib/pictures";
import { useNearScreen } from "../lib/useNearScreen";
import { Loader } from "../ui/Loader";

type Props = {
  id: string;
  /** The tiny preview (a data: URL), shown blurred until the small copy arrives. */
  preview: string | null;
  label: string;
  onClick: () => void;
};

// One square picture in a grid (the Pictures page, the picker). It loads its small copy only
// when it comes near the screen, showing its own blurred preview meanwhile, then fades in.
// Hover lifts the picture a little; no grey box.
export function PictureTile({ id, preview, label, onClick }: Props) {
  const button = useRef<HTMLButtonElement>(null);
  const near = useNearScreen(button);
  const url = usePicture(near ? id : null, "small");
  const [loaded, setLoaded] = useState(false);
  const ready = url && url !== "failed";

  return (
    <button
      ref={button}
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group relative aspect-square cursor-pointer overflow-hidden rounded-md border-0 bg-ground p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {/* Stays underneath, so the real picture fades in over it rather than over an empty tile. */}
      {preview && (
        <img src={preview} alt="" aria-hidden="true" className="absolute inset-0 block h-full w-full scale-110 object-cover blur-md" />
      )}
      {ready && (
        <img
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`relative block h-full w-full object-cover transition-[opacity,scale] duration-300 group-hover:scale-[1.03] motion-reduce:transition-none ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
      {!preview && !ready && (
        <span className="absolute inset-0 flex items-center justify-center text-[12px] text-ink-muted">
          {url === "failed" ? "Couldn't load" : <Loader size={14} delayMs={300} label="Loading the picture" />}
        </span>
      )}
    </button>
  );
}

// The dashed first tile: add a new picture from the device.
export function UploadTile({ busy, onClick }: { busy: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-line-strong bg-transparent p-0 font-sans text-[13px] text-ink-muted transition-colors duration-150 hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default motion-reduce:transition-none"
    >
      {busy ? (
        <Loader size={16} label="Adding the picture" />
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
        </svg>
      )}
      {busy ? "Adding…" : "Upload a picture"}
    </button>
  );
}
