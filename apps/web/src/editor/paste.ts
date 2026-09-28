import type { EditorDoc, EditorNode } from "@ink/schemas";

const SCENE_BREAK = /^\s*(\*\s*){3,}\s*$/;

/**
 * Plain text as a writer's document: a blank line starts a new stanza, a single line
 * break stays a line inside it, and indentation is kept exactly. A line of three
 * asterisks on its own is a scene break.
 */
export function plainTextToDoc(text: string): EditorDoc {
  const normalized = text.replace(/\r\n?/g, "\n").replace(/^\n+|\n+$/g, "");
  const content: EditorNode[] = [];
  for (const stanza of normalized.split(/\n[ \t]*\n+/)) {
    if (SCENE_BREAK.test(stanza)) {
      content.push({ type: "horizontalRule" });
      continue;
    }
    const inline: EditorNode[] = [];
    stanza.split("\n").forEach((line, i) => {
      if (i > 0) inline.push({ type: "hardBreak" });
      if (line) inline.push({ type: "text", text: line });
    });
    content.push(inline.length ? { type: "paragraph", content: inline } : { type: "paragraph" });
  }
  return { type: "doc", content };
}
