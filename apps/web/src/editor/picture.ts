import { Node, type NodeViewRenderer } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

type PictureOptions = {
  /** How the picture is drawn in the app (a React view); none in tests. */
  view: NodeViewRenderer | null;
  /** Pictures pasted or dropped into a Notes piece. */
  onFiles: (files: File[]) => void;
};

const imagesIn = (list: FileList | null | undefined): File[] => [...(list ?? [])].filter((file) => file.type.startsWith("image/"));

/**
 * A picture in the text (Notes). It holds only the picture's id: the bytes live in the writer's
 * private store and are fetched by id, so the piece itself stays small and has no addresses.
 */
export const Picture = Node.create<PictureOptions>({
  name: "picture",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addOptions() {
    return { view: null, onFiles: () => {} };
  },

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-picture"),
        renderHTML: (attributes) => ({ "data-picture": attributes.id as string | null })
      }
    };
  },

  parseHTML() {
    return [{ tag: "figure[data-picture]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["figure", HTMLAttributes];
  },

  addNodeView() {
    return this.options.view;
  },

  addProseMirrorPlugins() {
    const { editor, options } = this;
    // Only Notes takes pictures; elsewhere a pasted or dropped picture is left alone.
    const take = (files: File[]) => {
      if (!files.length || editor.storage.stanzaKeys.style !== "notes") return false;
      options.onFiles(files);
      return true;
    };
    return [
      new Plugin({
        key: new PluginKey("picturePaste"),
        props: {
          handlePaste: (_view, event) => take(imagesIn(event.clipboardData?.files)),
          handleDrop: (_view, event) => take(imagesIn((event as DragEvent).dataTransfer?.files))
        }
      })
    ];
  }
});
