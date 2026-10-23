import { BUTTON, button, escape, header, page, text, title } from "../emails/layout.js";
import type { Mail } from "./mail.js";

/** The email with the link that opens the page where the writer deletes their account. */
export function deleteLinkEmail(to: string, link: string): Mail {
  const html = page([
    header(),
    title("Delete your Ink account"),
    text(`You asked to delete the Ink account for ${escape(to)}. Open the link below, on any device, to finish.`, { padding: "12px 32px 20px 32px" }),
    button(escape(link), "Delete my account", BUTTON.danger),
    text("Nothing is deleted until you confirm on that page. The link works for 1 hour and only once.", { padding: "0 32px 12px 32px", size: 15, quiet: true }),
    text("If this wasn't you, ignore this email. Your account stays as it is.", { padding: "0 32px 24px 32px", size: 15, quiet: true })
  ]);
  const plain = [
    "Delete your Ink account",
    "",
    `You asked to delete the Ink account for ${to}. Open this link, on any device, to finish:`,
    link,
    "",
    "Nothing is deleted until you confirm on that page. The link works for 1 hour and only once.",
    "If this wasn't you, ignore this email. Your account stays as it is.",
    "",
    "Naveen, Ink"
  ].join("\n");
  return { to, subject: "Delete your Ink account", text: plain, html };
}

/** The note sent once the account is gone. */
export function deletedEmail(to: string): Mail {
  const html = page([
    header(),
    title("Your account is deleted"),
    text("Your writing, your pictures and everything Ink remembered about them are gone, on every device.", { padding: "12px 32px 20px 32px" }),
    text("Thank you for writing with Ink.", { padding: "0 32px 24px 32px" })
  ]);
  const plain = [
    "Your account is deleted",
    "",
    "Your writing, your pictures and everything Ink remembered about them are gone, on every device.",
    "",
    "Thank you for writing with Ink.",
    "",
    "Naveen, Ink"
  ].join("\n");
  return { to, subject: "Your Ink account is deleted", text: plain, html };
}
