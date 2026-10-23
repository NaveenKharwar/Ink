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
  await page.goto("/");
  await page.getByPlaceholder("the.one.who.writes@example.com").fill(email!);
  await page.getByRole("button", { name: "Start writing" }).click();
  await page.getByRole("button", { name: "Use your password instead" }).click();
  await page.locator("#auth-password").fill(password!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveTitle(/Writing, Ink/, { timeout: 20_000 });
}
