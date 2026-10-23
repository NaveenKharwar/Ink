import { expect, signIn, test } from "./watch";

test("a writer writes a piece, it saves, and they delete it for good", async ({ page }) => {
  await signIn(page);
  const line = `A browser test line ${Date.now()}`;
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(line);
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  const id = page.url().split("/p/")[1]!;

  await page.getByRole("button", { name: "Show echoes" }).click();
  await page.getByText("Delete this piece").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Piece deleted")).toBeVisible();

  const status = await page.evaluate(async (pieceId) => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))!;
    const token = JSON.parse(localStorage.getItem(key)!).access_token;
    return (await fetch(`/api/pieces/${pieceId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })).status;
  }, id);
  expect(status).toBe(404);
});
