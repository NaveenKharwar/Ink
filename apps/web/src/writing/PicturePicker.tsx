import type { PictureCrop } from "@ink/schemas";
import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { COVER_ASPECT, tidyCrop } from "../lib/coverLayout";
import { addPicture, choosePicture, PictureError, PICTURE_MESSAGES, usePicture, usePictureList } from "../lib/pictures";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { Loader } from "../ui/Loader";
import { NoteIcon } from "./icons";
import { PictureTile, UploadTile } from "./PictureTile";

type Props = {
  wide: boolean;
  /** A cover is cropped to the cover's shape after it is chosen; a picture in Notes is used as it is. */
  purpose: "cover" | "notes";
  /** Open straight on the crop step (the cover's Crop), with the crop it has now. */
  start?: { id: string; crop: PictureCrop };
  onPick: (id: string, crop: PictureCrop | null) => void;
  onClose: () => void;
};

const MAX_ZOOM = 3;

/**
 * Choose a picture: upload a new one (the first tile) or pick one of your pictures. For a cover,
 * a crop step follows. The crop is kept with the cover; the picture itself never changes.
 */
export function PicturePicker({ wide, purpose, start, onPick, onClose }: Props) {
  const list = usePictureList();
  const [cropping, setCropping] = useState<{ id: string; initial?: PictureCrop } | null>(start ? { id: start.id, initial: start.crop } : null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const choose = (id: string) => (purpose === "cover" ? setCropping({ id }) : onPick(id, null));

  const upload = async () => {
    setMessage(null);
    const file = await choosePicture();
    if (!file) return;
    setUploading(true);
    try {
      const added = await addPicture(file);
      await added.uploaded;
      void list.refresh();
      choose(added.id);
    } catch (err) {
      setMessage(err instanceof PictureError ? err.message : PICTURE_MESSAGES.failed);
    } finally {
      setUploading(false);
    }
  };

  const title = cropping ? "Crop the cover" : purpose === "cover" ? "Choose a cover" : "Add a picture";

  return (
    <Dialog title={title} wide={wide} onClose={onClose}>
      {cropping ? (
        <CropStep
          id={cropping.id}
          initial={cropping.initial}
          onBack={start ? onClose : () => setCropping(null)}
          backLabel={start ? "Cancel" : "Back"}
          onUse={(crop) => onPick(cropping.id, crop)}
        />
      ) : (
        <div className="grow overflow-y-auto px-[var(--page-gutter)] py-5 wide:px-6">
          {message && (
            <p role="status" className="m-0 mb-4 flex items-center gap-2 text-[13px] leading-5 text-ink">
              <NoteIcon size={16} />
              {message}
            </p>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
            <UploadTile busy={uploading} onClick={() => void upload()} />
            {list.items?.map((item) => (
              <PictureTile key={item.id} id={item.id} preview={item.preview} label="Use this picture" onClick={() => choose(item.id)} />
            ))}
          </div>
          {!list.items && !list.failed && (
            <div className="flex justify-center py-8">
              <Loader delayMs={300} label="Loading your pictures" />
            </div>
          )}
          {list.failed && (
            <p className="m-0 mt-4 text-[13px] text-ink-muted">Ink couldn't load your pictures. You can still upload a new one.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function CropStep({
  id,
  initial,
  onBack,
  backLabel,
  onUse
}: {
  id: string;
  initial?: PictureCrop;
  onBack: () => void;
  backLabel: string;
  onUse: (crop: PictureCrop) => void;
}) {
  const url = usePicture(id);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <>
      <div className="relative min-h-[240px] grow bg-[#111] wide:h-[440px] wide:grow-0">
        {url && url !== "failed" ? (
          <Cropper
            image={url}
            crop={position}
            zoom={zoom}
            maxZoom={MAX_ZOOM}
            aspect={COVER_ASPECT}
            showGrid={false}
            initialCroppedAreaPercentages={initial ? { x: initial.x, y: initial.y, width: initial.width, height: initial.height } : undefined}
            onCropChange={setPosition}
            onZoomChange={setZoom}
            onCropComplete={(percent) => setArea(percent)}
            style={{ cropAreaStyle: { border: "1px solid rgba(255,255,255,0.9)", color: "rgba(0,0,0,0.55)" } }}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[13px] text-white/80">
            {url === "failed" ? "This picture couldn't be loaded." : <Loader delayMs={300} label="Loading the picture" />}
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 px-[var(--page-gutter)] py-4 wide:px-6">
        <label className="flex items-center gap-2.5 text-[13px] text-ink-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-[180px] accent-ink"
          />
        </label>
        <span className="text-[13px] text-ink-muted">Drag the picture to place it</span>
        <div className="ml-auto flex gap-2">
          <Button onClick={onBack}>{backLabel}</Button>
          <Button
            look="main"
            disabled={!area}
            onClick={() => area && onUse(tidyCrop(area))}
          >
            Use this
          </Button>
        </div>
      </div>
    </>
  );
}
