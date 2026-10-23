import type { Mail } from "./mail.js";

const escape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const page = (body: string) =>
  `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;color:#1a1a1a;max-width:480px;margin:0 auto;padding:24px 8px">${body}</div>`;

/** The email with the link that opens the page where the writer deletes their account. */
export function deleteLinkEmail(to: string, link: string): Mail {
  const text = [
    `You asked to delete your Ink account (${to}).`,
    "",
    "Open this link to finish. It works once, for 1 hour:",
    link,
    "",
    "Nothing is deleted until you confirm on that page.",
    "If you didn't ask for this, ignore this email. Your account stays as it is.",
    "",
    "Ink"
  ].join("\n");
  const html = page(
    `<p style="margin:0 0 16px">You asked to delete your Ink account (${escape(to)}).</p>` +
      `<p style="margin:0 0 20px"><a href="${escape(link)}" style="display:inline-block;background:#9a4a3c;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;font-size:15px;padding:10px 18px;border-radius:8px">Delete my account</a></p>` +
      `<p style="margin:0 0 16px">The link works once, for 1 hour. Nothing is deleted until you confirm on that page.</p>` +
      `<p style="margin:0 0 16px;color:#666560">If you didn't ask for this, ignore this email. Your account stays as it is.</p>` +
      `<p style="margin:0">Ink</p>`
  );
  return { to, subject: "Delete your Ink account", text, html };
}

/** The note sent once the account is gone. */
export function deletedEmail(to: string): Mail {
  const text = [
    "Your Ink account is deleted.",
    "",
    "Your writing, your pictures and everything Ink remembered about them are gone, on every device.",
    "",
    "Thank you for writing with Ink."
  ].join("\n");
  const html = page(
    `<p style="margin:0 0 16px">Your Ink account is deleted.</p>` +
      `<p style="margin:0 0 16px">Your writing, your pictures and everything Ink remembered about them are gone, on every device.</p>` +
      `<p style="margin:0">Thank you for writing with Ink.</p>`
  );
  return { to, subject: "Your Ink account is deleted", text, html };
}
