import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./watch";

// Writes a new piece in the given style and waits until it is saved; returns its id.
async function write(page: Page, style: "Poem" | "Notes", text: string) {
  await page.goto("/");
  const styles = page.getByRole("group", { name: "How do you want to write?" });
  if (style === "Notes") {
    const window = styles.locator("button[aria-pressed]").filter({ hasText: "Notes" });
    if (await window.count()) await window.click();
    else await styles.getByRole("button", { name: /^Notes/ }).click();
  }
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(text);
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("button", { name: `Writing style: ${style}` })).toBeVisible();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  return page.url().split("/p/")[1]!;
}

test("All writing narrows to one writing style and back", async ({ page }) => {
  await signIn(page);
  const stamp = Date.now();
  const poemLine = `A style test poem ${stamp}`;
  const notesLine = `A style test note ${stamp}`;
  const ids = [await write(page, "Poem", poemLine), await write(page, "Notes", notesLine)];

  await page.goto("/all");
  const styles = page.getByRole("group", { name: "Writing style" });
  await expect(styles.getByRole("button", { name: "All", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(poemLine)).toBeVisible();
  await expect(page.getByText(notesLine)).toBeVisible();

  await styles.getByRole("button", { name: /^Notes/ }).click();
  await expect(styles.getByRole("button", { name: /^Notes/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(notesLine)).toBeVisible();
  await expect(page.getByText(poemLine)).toHaveCount(0);

  await styles.getByRole("button", { name: /^Poems/ }).click();
  await expect(page.getByText(poemLine)).toBeVisible();
  await expect(page.getByText(notesLine)).toHaveCount(0);

  await styles.getByRole("button", { name: "All", exact: true }).click();
  await expect(page.getByText(notesLine)).toBeVisible();

  // Leave nothing behind.
  const token = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))!;
    return JSON.parse(localStorage.getItem(key)!).access_token as string;
  });
  for (const id of ids) {
    const res = await page.request.delete(`/api/pieces/${id}`, { headers: { Authorization: `Bearer ${token}` } });
    expect(res.status()).toBe(204);
  }
});
