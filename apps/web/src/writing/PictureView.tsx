import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { usePicture } from "../lib/pictures";
import { useWide } from "../lib/layout";
import { Loader } from "../ui/Loader";
import { PictureOptions } from "../ui/PictureOptions";
import { PicturePicker } from "./PicturePicker";

// A picture in a Notes piece: the column's full width at its own shape, no caption. Replace ·
// Remove show on hover or focus, or when the picture is tapped (selected).
export function PictureView({ node, selected, editor, updateAttributes, deleteNode }: ReactNodeViewProps) {
  const id = (node.attrs.id as string | null) ?? null;
  const url = usePicture(id);
  const wide = useWide();
  const [picking, setPicking] = useState(false);

  return (
    <NodeViewWrapper as="figure" className="group relative m-0" contentEditable={false}>
      {url && url !== "failed" ? (
        <img src={url} alt="" draggable={false} className="block h-auto w-full rounded-md" />
      ) : (
        <div className="flex h-40 items-center justify-center rounded-md bg-ground font-sans text-[13px] text-ink-muted">
          {url === "failed" ? "This picture couldn't be loaded." : <Loader delayMs={300} label="Loading the picture" />}
        </div>
      )}
      {editor.isEditable && (
        <PictureOptions
          shown={selected}
          options={[
            { label: "Replace", onClick: () => setPicking(true) },
            { label: "Remove", onClick: deleteNode }
          ]}
        />
      )}
      {picking && (
        <PicturePicker
          wide={wide}
          purpose="notes"
          onClose={() => setPicking(false)}
          onPick={(picked) => {
            setPicking(false);
            updateAttributes({ id: picked });
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
