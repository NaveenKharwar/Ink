import type { Block, ExportDoc, Line, Span } from "./piece";

const STYLE_NAMES = { poem: "Poem", story: "Story", notes: "Notes" } as const;

// Characters Markdown would read as formatting are kept as the writer typed them.
const escapeText = (text: string) => text.replace(/([\\`*_[\]<>])/g, "\\$1");
const escapeLineStart = (line: string) =>
  line
    .replace(/^(\s*)([#>+-])(\s|$)/, (_, space: string, mark: string, after: string) => `${space}\\${mark}${after}`)
    .replace(/^(\s*)(\d+)([.)])(\s|$)/, (_, space: string, digits: string, mark: string, after: string) => `${space}${digits}\\${mark}${after}`);

function span(s: Span): string {
  let text = escapeText(s.text);
  // Markdown marks can't open or close on a space, so spaces stay outside them.
  const lead = text.match(/^\s*/)![0];
  const trail = text.slice(lead.length).match(/\s*$/)![0];
  let core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  if (s.bold) core = `**${core}**`;
  if (s.italic) core = `*${core}*`;
  if (s.href) core = `[${core}](<${s.href.replace(/[<>]/g, encodeURIComponent)}>)`;
  text = `${lead}${core}${trail}`;
  return text;
}

const line = (spans: Line) => escapeLineStart(spans.map(span).join(""));

function block(b: Block, picturePath: (id: string) => string | null): string {
  switch (b.kind) {
    case "stanza":
      // A line break inside a stanza: two spaces at the end of the line, which Markdown keeps as a break.
      return b.lines.map(line).join("  \n");
    case "heading":
      return `${"#".repeat(b.level + 1)} ${b.spans.map(span).join("")}`;
    case "quote":
      return blocks(b.blocks, picturePath)
        .split("\n")
        .map((l) => (l ? `> ${l}` : ">"))
        .join("\n");
    case "list":
      return b.items
        .map((item, i) => {
          const marker = b.ordered ? `${i + 1}.` : "-";
          const body = blocks(item, picturePath).split("\n");
          const pad = " ".repeat(marker.length + 1);
          return body.map((l, j) => (j === 0 ? `${marker} ${l}` : l ? `${pad}${l}` : "")).join("\n");
        })
        .join("\n");
    case "rule":
      return "---";
    case "picture": {
      const path = picturePath(b.id);
      return path ? `![](${path})` : "";
    }
  }
}

function blocks(list: Block[], picturePath: (id: string) => string | null): string {
  return list
    .map((b) => block(b, picturePath))
    .filter(Boolean)
    .join("\n\n");
}

const dateIn = (date: Date, timeZone: string) => new Intl.DateTimeFormat("en-GB", { timeZone, day: "numeric", month: "long", year: "numeric" }).format(date);

/**
 * One piece as a Markdown file: its title, a line saying when and what it is, its cover, then
 * its words. `picturePath` says where each picture is in the download (null leaves it out).
 */
export function toMarkdown(doc: ExportDoc, timeZone: string, picturePath: (id: string) => string | null): string {
  const parts: string[] = [];
  if (doc.titled) parts.push(`# ${escapeText(doc.title)}`);
  const about = [doc.season, STYLE_NAMES[doc.style], doc.finished ? "Finished" : "Draft"].join(" · ");
  const written = `Written ${dateIn(doc.createdAt, timeZone)}`;
  parts.push(`*${about}*  \n*${written}*`);
  const cover = doc.cover ? picturePath(doc.cover) : null;
  if (cover) parts.push(`![Cover](${cover})`);
  const body = blocks(doc.blocks, picturePath);
  if (body) parts.push(body);
  return `${parts.join("\n\n")}\n`;
}
