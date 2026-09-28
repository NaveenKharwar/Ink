import { Extension, type Editor } from "@tiptap/core";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, TrailingNode, UndoRedo } from "@tiptap/extensions";
import { Slice, type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { plainTextToDoc } from "./paste";

const INDENT = "\t";
const SPACES_PER_INDENT = 4;

/** Where each line of a textblock starts and ends (lines are split by hard breaks). */
function linesOf(block: PMNode, blockPos: number): Array<{ start: number; end: number }> {
  const lines: Array<{ start: number; end: number }> = [];
  let start = blockPos + 1;
  block.forEach((child, offset) => {
    if (child.type.name === "hardBreak") {
      const at = blockPos + 1 + offset;
      lines.push({ start, end: at });
      start = at + 1;
    }
  });
  lines.push({ start, end: blockPos + 1 + block.content.size });
  return lines;
}

/** Tab / Shift+Tab: add or remove one indent at the start of every selected line. */
function shiftLines(editor: Editor, direction: 1 | -1): boolean {
  const { state, view } = editor;
  const { from, to } = state.selection;
  const starts: number[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    for (const line of linesOf(node, pos)) if (line.start <= to && line.end >= from) starts.push(line.start);
    return false;
  });
  if (!starts.length) return false;

  const tr = state.tr;
  // Work from the end so earlier positions stay valid.
  for (const start of starts.reverse()) {
    if (direction === 1) {
      tr.insertText(INDENT, start);
      continue;
    }
    const lead = state.doc.textBetween(start, Math.min(start + SPACES_PER_INDENT, state.doc.content.size), "\n", "\n");
    const remove = lead.startsWith(INDENT) ? 1 : (/^ +/.exec(lead)?.[0].length ?? 0);
    if (remove) tr.delete(start, start + remove);
  }
  if (tr.docChanged) view.dispatch(tr);
  return true;
}

/**
 * Enter makes a new line inside the stanza. Enter on an empty line ends the stanza
 * and starts a new one (the empty line is removed).
 */
function enter(editor: Editor): boolean {
  const { state, view } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") return false;

  const paragraph = $from.parent;
  const inQuote = $from.depth > 1 && $from.node(-1).type.name === "blockquote";

  if (paragraph.content.size === 0) {
    // An empty stanza: leave a quote, otherwise don't stack empty stanzas.
    return inQuote ? editor.commands.lift("blockquote") : true;
  }

  const before = $from.nodeBefore;
  const after = $from.nodeAfter;
  const lineIsEmpty = before?.type.name === "hardBreak" && (!after || after.type.name === "hardBreak");
  if (!lineIsEmpty) return editor.commands.setHardBreak();

  const pos = $from.pos;
  const tr = state.tr.delete(pos - 1, pos).split(pos - 1);
  const cursor = pos + 1;
  if (tr.doc.resolve(cursor).nodeAfter?.type.name === "hardBreak") tr.delete(cursor, cursor + 1);
  tr.setSelection(TextSelection.create(tr.doc, cursor)).scrollIntoView();
  view.dispatch(tr);
  return true;
}

const StanzaKeys = Extension.create({
  name: "stanzaKeys",
  addKeyboardShortcuts() {
    return {
      Enter: () => enter(this.editor),
      Tab: () => shiftLines(this.editor, 1),
      "Shift-Tab": () => shiftLines(this.editor, -1)
    };
  },
  addCommands() {
    return {
      indentLines:
        () =>
        ({ editor }) =>
          shiftLines(editor, 1)
    };
  }
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    stanzaKeys: { indentLines: () => ReturnType };
  }
}

function stanzaBars(doc: PMNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "paragraph") {
      if (node.textContent.trim()) decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: "has-text" }));
      return false;
    }
    return true;
  });
  return DecorationSet.create(doc, decorations);
}

/** Marks stanzas that have text, so they get their bar. */
const StanzaBars = Extension.create({
  name: "stanzaBars",
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>("stanzaBars");
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => stanzaBars(state.doc),
          apply: (tr, old) => (tr.docChanged ? stanzaBars(tr.doc) : old)
        },
        props: { decorations: (state) => key.getState(state) }
      })
    ];
  }
});

/**
 * Pasting from other apps uses the plain text, so stanza breaks and indentation survive.
 * Copy and paste inside Ink keeps its own formatting.
 */
const PlainPaste = Extension.create({
  name: "plainPaste",
  addProseMirrorPlugins() {
    const schema = this.editor.schema;
    const toSlice = (text: string) => Slice.maxOpen(schema.nodeFromJSON(plainTextToDoc(text)).content);
    return [
      new Plugin({
        props: {
          clipboardTextParser: (text) => toSlice(text),
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            const html = data?.getData("text/html") ?? "";
            const text = data?.getData("text/plain") ?? "";
            if (!text || html.includes("data-pm-slice")) return false;
            view.dispatch(view.state.tr.replaceSelection(toSlice(text)).scrollIntoView());
            return true;
          }
        }
      })
    ];
  }
});

export const writingExtensions = [
  Document,
  Paragraph,
  Text,
  HardBreak,
  UndoRedo,
  Bold,
  Italic,
  Heading.configure({ levels: [1] }),
  Blockquote,
  HorizontalRule,
  TrailingNode,
  Placeholder.configure({ placeholder: "Start writing…" }),
  StanzaKeys,
  StanzaBars,
  PlainPaste
];
