import type { PieceStyle } from "@ink/schemas";
import { Extension, InputRule, type Editor } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import Blockquote from "@tiptap/extension-blockquote";
import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import HorizontalRule from "@tiptap/extension-horizontal-rule";
import Italic from "@tiptap/extension-italic";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { Placeholder, TrailingNode } from "@tiptap/extensions";
import { Slice, type Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { plainTextToDoc } from "./paste";
import { Picture } from "./picture";

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
  // Stories and notes are written in paragraphs: Enter simply starts the next one.
  if (styleOf(editor) !== "poem") return false;
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

/** The piece's writing style, kept on the editor so its keys and input rules can follow it. */
export function styleOf(editor: Editor): PieceStyle {
  return editor.storage.stanzaKeys.style;
}

// Tab indents a poem's lines. In a list (Notes) it nests the item instead, which the list's
// own keys do, so it is left to them; elsewhere in stories and notes it does nothing.
function tab(editor: Editor, direction: 1 | -1): boolean {
  if (editor.isActive("listItem")) return false;
  return styleOf(editor) === "poem" ? shiftLines(editor, direction) : true;
}

const StanzaKeys = Extension.create<Record<string, never>, { style: PieceStyle }>({
  name: "stanzaKeys",
  addStorage() {
    return { style: "poem" };
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => enter(this.editor),
      Tab: () => tab(this.editor, 1),
      "Shift-Tab": () => tab(this.editor, -1)
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
  interface Storage {
    stanzaKeys: { style: PieceStyle };
  }
}

/** Tells the editor's keys and input rules which style the piece is written in. */
export function setEditorStyle(editor: Editor, style: PieceStyle) {
  editor.storage.stanzaKeys.style = style;
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

// Typing "- " or "1. " starts a list only in Notes: in a poem a line may well begin that way.
function onlyInNotes(editor: Editor, rules: InputRule[]): InputRule[] {
  return rules.map(
    (rule) =>
      new InputRule({
        find: rule.find,
        handler: (props) => (styleOf(editor) === "notes" ? rule.handler(props) : null)
      })
  );
}
const NotesBulletList = BulletList.extend({
  addInputRules() {
    return onlyInNotes(this.editor, this.parent?.() ?? []);
  }
});
const NotesOrderedList = OrderedList.extend({
  addInputRules() {
    return onlyInNotes(this.editor, this.parent?.() ?? []);
  }
});

// Every style shares one set of nodes, so a piece can change style (and merge across devices)
// without losing anything; what each style offers is decided by its keys, tool bar and look.
// Undo and redo come from the Yjs collaboration extension (it only undoes your own changes).
export const writingExtensions = [
  Document,
  Paragraph,
  Text,
  HardBreak,
  Bold,
  Italic,
  Heading.configure({ levels: [1, 2, 3] }),
  Blockquote,
  HorizontalRule,
  NotesBulletList,
  NotesOrderedList,
  ListItem,
  // Links are added from the tool bar (Notes) and open only on purpose, never by a click
  // while writing.
  Link.configure({ openOnClick: false, autolink: false, linkOnPaste: false, defaultProtocol: "https" }),
  // Pictures (Notes); before PlainPaste so a pasted picture isn't taken as text.
  Picture,
  TrailingNode,
  Placeholder.configure({ placeholder: "Start writing…" }),
  StanzaKeys,
  StanzaBars,
  PlainPaste
];
