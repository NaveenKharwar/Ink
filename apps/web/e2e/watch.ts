import { expect, test as base, type Page } from "@playwright/test";

// Every test watches the page: a Content-Security-Policy block or an uncaught error fails it.
export const test = base.extend<{ problems: string[] }>({
  problems: async ({ page }, use) => {
    const problems: string[] = [];
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        console.error(`CSP blocked ${e.violatedDirective}: ${e.blockedURI}`);
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().startsWith("CSP blocked")) problems.push(message.text());
    });
    page.on("pageerror", (err) => problems.push(`Page error: ${err.message}`));
    await use(problems);
    expect(problems, "the page blocked something or threw").toEqual([]);
  }
});

export { expect };

/** Signs in the way a writer does: email, then "Use your password instead". */
export async function signIn(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    if (process.env.E2E_REQUIRE_SIGN_IN) throw new Error("E2E_EMAIL and E2E_PASSWORD are not set");
    test.skip(true, "Set E2E_EMAIL and E2E_PASSWORD (a throwaway writer) to run the signed-in tests");
  }
  // The page's clock runs as usual, but can be moved on.
  await page.clock.install();
  await page.goto("/");
  await page.getByPlaceholder("the.one.who.writes@example.com").fill(email!);
  // Every test signs in as the same writer, and Supabase sends one address at most one code a second.
  // Sign-ins can now come closer together than that, so a "too soon" answer waits and asks again.
  const codeSent = page.getByText("You can ask for a new code in");
  const tooSoon = page.getByText(/can.t send another email just yet/);
  for (let tries = 0; ; tries++) {
    await page.getByRole("button", { name: "Start writing" }).click();
    await expect(codeSent.or(tooSoon)).toBeVisible();
    if (!(await tooSoon.isVisible()) || tries === 3) break;
    await page.waitForTimeout(1_500);
  }
  // "Use your password instead" shows at once, while the wait for a new code is still running.
  await expect(codeSent).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a new code" })).toBeHidden();
  await page.getByRole("button", { name: "Use your password instead" }).click();
  await page.locator("#auth-password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveTitle(/Writing, Ink/, { timeout: 20_000 });
}
