export type Mail = { to: string; subject: string; text: string; html: string };

/** Sends one email. Ink sends only two: the delete-account link and the note that it is done. */
export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export const SENDER = "Ink <hello@withink.app>";

/** Resend, the same service and sender as the sign-in emails. */
export function resendMailer(apiKey: string, from = SENDER): Mailer {
  return {
    async send(mail) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html })
      });
      if (!res.ok) throw new Error(`The email service refused the email (${res.status})`);
    }
  };
}

/**
 * Development without an email key: the email is printed in the terminal that runs the API, never
 * written to the log file. Only `pnpm dev` uses it.
 */
export function terminalMailer(): Mailer {
  return {
    async send(mail) {
      process.stdout.write(`\n--- Email to ${mail.to}: ${mail.subject} ---\n${mail.text}\n--- End of email ---\n\n`);
    }
  };
}

/** Kept in memory: for tests. */
export function memoryMailer(): Mailer & { sent: Mail[] } {
  const sent: Mail[] = [];
  return {
    sent,
    async send(mail) {
      sent.push(mail);
    }
  };
}

/** No way to send email: asking for the link answers that Ink can't send email right now. */
export const noMailer: Mailer = {
  async send() {
    throw new Error("No email service is set up");
  }
};
