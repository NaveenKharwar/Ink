import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./watch";

const token = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))!;
    return JSON.parse(localStorage.getItem(key)!).access_token as string;
  });

// Today as the app writes it, in the browser's own time zone.
const today = (page: Page) =>
  page.evaluate(() => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(new Date()));

test("an open piece shows its dates: in the top bar on desktop, at the foot of Echoes on phone", async ({ page }) => {
  await signIn(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type(`A dated piece ${Date.now()}`);
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible({ timeout: 15_000 });
  const id = page.url().split("/p/")[1]!;
  const date = await today(page);

  // Written and edited today: one date, beside the name.
  await page.reload();
  await expect(page.getByText(date, { exact: true })).toBeVisible();

  // Phone: the top bar has no room; the dates are at the foot of Echoes.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.reload();
  await page.getByRole("button", { name: "Show echoes" }).click();
  await expect(page.getByText(date, { exact: true })).toBeVisible();

  const res = await page.request.delete(`/api/pieces/${id}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  expect(res.status()).toBe(204);
});
