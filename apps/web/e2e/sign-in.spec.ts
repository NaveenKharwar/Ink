import { expect, signIn, test } from "./watch";

test("the sign-in page loads under the security policy", async ({ page, problems }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Sign in, Ink/);
  await expect(page.getByRole("button", { name: "Start writing" })).toBeVisible();
  const policy = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(policy).toContain("default-src 'self'");
  // The colour scheme script in the page's head runs (it is allowed by its hash).
  await page.evaluate(() => localStorage.setItem("ink-scheme", "night"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-scheme", "night");
  // Requests anywhere but Ink and Supabase are refused.
  const outside = await page.evaluate(() => fetch("https://example.com/").then(() => "reached", () => "refused"));
  expect(outside).toBe("refused");
  problems.length = 0; // that refusal was on purpose
});

test("a writer signs in with their password and reaches the writing page", async ({ page, problems }) => {
  await signIn(page);
  await expect(page.locator(".ProseMirror")).toBeVisible();
  expect(problems).toEqual([]);
});
