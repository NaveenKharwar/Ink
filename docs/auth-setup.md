# Sign-in and password emails: setup and checks

The sign-in code, the sign-up welcome and the password link are Supabase emails. Their settings live in the Supabase dashboard, not in the code, so this list is repeated for each place Ink runs (a laptop, a phone on the same network, production). A wrong setting only shows when someone tries the flow.

## How it works

- Sign in and sign up: one emailed 6-digit code.
- Adding or changing a password: Profile sends an email with a link. The link works for 2 hours and only once, and opens on any device. It opens `/set-password`, which asks for the new password after a click on Continue (a mail scanner that opens the link cannot use it up). Other devices are signed out once the password is saved.
- A writer who forgot a password signs in with a code.

## Supabase settings

1. **Authentication → URL Configuration → Redirect URLs.** One entry per origin that opens the app, each ending in `/set-password`: `http://localhost:5173/set-password`, `http://<this machine's address>:5173/set-password` for a phone, and the production address. An address that is not listed sends the link to the main page.
2. **Authentication → Sign In / Providers → Email.** Email OTP expiry is `7200` seconds (2 hours). It applies to sign-in codes and password links alike; each works once.
3. **Authentication → Sign In / Providers → Email.** Secure password change is on.
4. **Authentication → Emails → SMTP Settings.** Custom SMTP through the email service, sender `hello@<Ink's domain>`, sender name `Ink`.
5. **Authentication → Emails → Templates.** Each template below is pasted whole, with its subject:

| Template | Subject | File |
| --- | --- | --- |
| Confirm sign up | Welcome to Ink, here is your code | `email-templates/confirm-signup.html` |
| Magic link or OTP | Your Ink sign-in code | `email-templates/sign-in-code.html` |
| Reset password | Set your Ink password | `email-templates/reset-password.html` |

The Reauthentication template is not used.

## Checks, in order

1. **Link goes to the right page.** In Profile press Add a password (or Change password). The email arrives with the subject "Set your Ink password", and the button opens `/set-password` on the same origin, showing "Choose your new password".
2. **Set the password.** Press Continue, choose a password of 8 or more characters, save. The page says "Your password is saved".
3. **Used link.** Open the same link again and press Continue. The page says "This link can't be used".
4. **Another device.** Press Change password again and open the new link on a phone or another browser. The password saves there without signing in first.
5. **Other devices are signed out.** The browser that asked for the link shows the sign-in page within a minute or on its next click. Signing in with the new password works.
6. **Sign-in emails.** A new address gets "Welcome to Ink, here is your code"; an existing account gets "Your Ink sign-in code". Each code works once.
7. **Old link.** A link older than 2 hours shows "This link can't be used".
