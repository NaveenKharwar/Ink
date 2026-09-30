import type { PieceCover } from "@ink/schemas";
import { useLayoutEffect, useRef, useState } from "react";
import { coverLayout } from "../lib/coverLayout";
import { usePicture } from "../lib/pictures";
import { PictureOptions } from "../ui/PictureOptions";
import { PictureIcon } from "./icons";
import { PicturePicker } from "./PicturePicker";

type Props = {
  cover: PieceCover | null;
  onCover: (cover: PieceCover | null) => void;
  wide: boolean;
};

type Picking = { start?: PieceCover } | null;

/**
 * The piece's cover (see PieceCover in the design system): one of the writer's own pictures
 * across the top of the paper, fading into it, or the quiet "Add a cover" line when there is
 * none. Add a cover and Change open the picker (upload, or one of your pictures, then crop);
 * Crop reopens the crop. The options show on hover or focus, or on a tap on phones.
 */
export function Cover({ cover, onCover, wide }: Props) {
  const [picking, setPicking] = useState<Picking>(null);
  const [tapped, setTapped] = useState(false);

  const picker = picking && (
    <PicturePicker
      wide={wide}
      purpose="cover"
      start={picking.start}
      onClose={() => setPicking(null)}
      onPick={(id, crop) => {
        if (crop) onCover({ id, crop });
        setPicking(null);
        setTapped(false);
      }}
    />
  );

  if (!cover) {
    return (
      <div className="px-[var(--page-gutter)] pt-4 wide:pt-8">
        <div className="mx-auto max-w-[640px]">
          <button
            type="button"
            onClick={() => setPicking({})}
            className="-ml-0.5 inline-flex h-8 cursor-pointer items-center gap-2 border-0 bg-transparent p-0 font-sans text-[13px] text-ink-muted transition-colors duration-150 hover:text-ink focus-visible:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none"
          >
            <PictureIcon />
            Add a cover
          </button>
        </div>
        {picker}
      </div>
    );
  }

  return (
    <div className="group relative">
      <CoverBand cover={cover} onTap={() => !wide && setTapped(!tapped)} />
      <PictureOptions
        shown={tapped}
        options={[
          { label: "Change", onClick: () => setPicking({}) },
          { label: "Crop", onClick: () => setPicking({ start: cover }) },
          {
            label: "Remove",
            onClick: () => {
              setTapped(false);
              onCover(null);
            }
          }
        ]}
      />
      {picker}
    </div>
  );
}

// The picture itself, placed so the writer's crop shows (lib/coverLayout.ts), its lower part
// fading into the paper.
function CoverBand({ cover, onTap }: { cover: PieceCover; onTap: () => void }) {
  const url = usePicture(cover.id);
  const band = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const el = band.current;
    if (!el) return;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const at = size && natural ? coverLayout(natural, cover.crop, size) : null;

  return (
    <div
      ref={band}
      onClick={onTap}
      className="relative h-[var(--cover-height)] overflow-hidden bg-ground [mask-image:linear-gradient(to_bottom,#000_62%,transparent)]"
    >
      {url && url !== "failed" && (
        <img
          src={url}
          alt=""
          draggable={false}
          onLoad={(e) => setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })}
          className={`pointer-events-none absolute max-w-none select-none ${at ? "" : "opacity-0"}`}
          style={at ? { width: at.width, height: at.height, left: at.left, top: at.top } : undefined}
        />
      )}
    </div>
  );
}
