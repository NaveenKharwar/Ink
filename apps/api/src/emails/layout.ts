// The one look of every email Ink sends: the sign-in emails Supabase sends (their templates are
// written from here, see templates.ts) and the ones the API sends itself. Email apps only render
// tables and inline styles reliably, so the pieces below are plain HTML strings.

const INK = "#1f1f1f";
const MUTED = "#6b6b6b";
const SERIF = "font-family:Georgia,'Times New Roman',serif;";
const SANS = "font-family:Arial,Helvetica,sans-serif;";

/** The button colours: the accent for an ordinary step, a muted red for a step that deletes. */
export const BUTTON = { accent: "#456f0c", danger: "#9a4a3c" } as const;

// Each size has its own line height, as in the rest of Ink.
const LINE: Record<number, number> = { 15: 24, 17: 27, 18: 28, 26: 34, 30: 38 };

/** Text to put inside the email, with the characters HTML treats specially made safe. */
export const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The wordmark at the top of every email. */
export const header = () =>
  `<tr><td align="center" style="padding:32px 24px 8px 24px;${SANS}font-size:26px;line-height:30px;font-weight:700;letter-spacing:-1px;color:${INK};">Ink</td></tr>`;

/** The big line under the wordmark. */
export const title = (html: string, size: 26 | 30 = 26) =>
  `<tr><td style="padding:16px 32px 0 32px;${SERIF}font-size:${size}px;line-height:${LINE[size]}px;color:${INK};">${html}</td></tr>`;

/** A paragraph. `padding` is the CSS padding of its row; quiet text is grey and a little smaller by choice of size. */
export const text = (html: string, { padding, size = 17, quiet = false }: { padding: string; size?: 15 | 17 | 18; quiet?: boolean }) =>
  `<tr><td style="padding:${padding};${SERIF}font-size:${size}px;line-height:${LINE[size]}px;color:${quiet ? MUTED : INK};">${html}</td></tr>`;

/** One button: a link styled as a filled box (email apps ignore real buttons). */
export const button = (href: string, label: string, colour: string = BUTTON.accent) =>
  `<tr><td style="padding:0 32px 20px 32px;"><table cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${colour}" style="background-color:${colour};border-radius:8px;"><a href="${href}" style="display:inline-block;padding:14px 28px;${SANS}font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;">${label}</a></td></tr></table></td></tr>`;

/** The shaded box a sign-in code sits in. */
export const codeBox = (code: string) =>
  `<tr><td style="padding:0 32px 20px 32px;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center" bgcolor="#f1f4ee" style="background-color:#f1f4ee;border:1px solid #d9e0d2;border-radius:10px;padding:18px 12px;font-family:Menlo,Consolas,'Courier New',monospace;font-size:32px;line-height:36px;letter-spacing:8px;font-weight:700;color:${INK};">${code}</td></tr></table></td></tr>`;

/** A picture across the card. */
export const picture = (src: string, alt: string, width: number, height: number) =>
  `<tr><td style="padding:0 32px;"><img src="${src}" width="${width}" height="${height}" alt="${alt}" style="display:block;width:100%;height:auto;border:0;"></td></tr>`;

/** The grey page and the white card around the rows. */
export const page = (rows: string[]) =>
  [
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f4f2"><tr><td align="center" style="padding:32px 16px;">`,
    `<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="max-width:520px;background-color:#ffffff;">`,
    ...rows,
    `</table></td></tr></table>`,
    ""
  ].join("\n");
