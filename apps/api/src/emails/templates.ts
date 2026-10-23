import { button, codeBox, header, page, picture, text, title } from "./layout.js";

// The emails Supabase sends (sign-up, sign-in code, set password), written from the shared layout.
// `pnpm --filter @ink/api emails:write` writes them to docs/email-templates/, to paste into
// Supabase (Authentication → Emails → Templates); a test fails when the files and this drift apart.
// `{{ .Token }}` and the like are Supabase's own placeholders, filled in when it sends.

export type SupabaseTemplate = { file: string; name: string; subject: string; html: string };

export const SUPABASE_TEMPLATES: SupabaseTemplate[] = [
  {
    file: "confirm-signup.html",
    name: "Confirm sign up",
    subject: "Welcome to Ink, here is your code",
    html: page([
      header(),
      title("Welcome to Ink!", 30),
      text("Hi, I'm Naveen, and I'm so glad you're here. Ready to write something only you will read?", { padding: "12px 32px 24px 32px", size: 18 }),
      picture("https://withink.app/email/welcome.jpg", "An open notebook, a fountain pen, jasmine, chai and a small lamp on a pale blue desk", 456, 304),
      text("Enter this code to finish signing up:", { padding: "24px 32px 12px 32px" }),
      codeBox("{{ .Token }}"),
      text("What you write in Ink stays private. If you didn't try to sign up, you can ignore this email.", { padding: "0 32px 24px 32px" }),
      text("Naveen, Ink", { padding: "0 32px 32px 32px" })
    ])
  },
  {
    file: "sign-in-code.html",
    name: "Magic link or OTP",
    subject: "Your Ink sign-in code",
    html: page([
      header(),
      title("Sign in to Ink"),
      text("Someone asked to sign in to your Ink account. Enter this code to continue:", { padding: "12px 32px 12px 32px" }),
      codeBox("{{ .Token }}"),
      text("If this wasn't you, you can ignore this email. Nothing will change.", { padding: "0 32px 32px 32px" })
    ])
  },
  {
    file: "reset-password.html",
    name: "Reset password",
    subject: "Set your Ink password",
    html: page([
      header(),
      title("Choose your password"),
      text("You asked to add or change the password on your Ink account. Open the link below, on any device, to choose it.", { padding: "12px 32px 20px 32px" }),
      button("{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery", "Choose my password"),
      text("This link works for 2 hours and only once.", { padding: "0 32px 12px 32px", size: 15, quiet: true }),
      text("If this wasn't you, ignore this email. Your account stays as it is.", { padding: "0 32px 32px 32px", size: 15, quiet: true })
    ])
  }
];
