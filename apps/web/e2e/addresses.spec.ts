import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./watch";

const SAMPLE = fileURLToPath(new URL("../../api/bruno/4 Pictures/sample.jpg", import.meta.url));

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

const token = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"))!;
    return JSON.parse(localStorage.getItem(key)!).access_token as string;
  });

test("All writing keeps its narrowing in the address through refresh and Back", async ({ page }) => {
  await signIn(page);
  // A poem and a Notes piece, so the list holds more than one style.
  const stamp = Date.now();
  const line = `An address test note ${stamp}`;
  const ids = [await write(page, "Poem", `An address test poem ${stamp}`), await write(page, "Notes", line)];
  const id = ids[1]!;

  // Drafts from the menu, then Notes on the page: the address says both.
  await page.goto("/all");
  const menu = page.getByRole("button", { name: "Open menu" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("button", { name: /^Drafts/ }).click();
  await expect(page).toHaveURL(/\/all\?filter=draft$/);
  await page.getByRole("group", { name: "Writing style" }).getByRole("button", { name: /^Notes/ }).click();
  await expect(page).toHaveURL(/\/all\?filter=draft&style=notes$/);

  // A refresh keeps it.
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Drafts");
  await expect(page.getByRole("group", { name: "Writing style" }).getByRole("button", { name: /^Notes/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(line)).toBeVisible();

  // Opening a piece and coming Back returns to the same narrowed list.
  await page.getByText(line).click();
  await expect(page).toHaveURL(new RegExp(`/p/${id}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/all\?filter=draft&style=notes$/);
  await expect(page.getByRole("group", { name: "Writing style" }).getByRole("button", { name: /^Notes/ })).toHaveAttribute("aria-pressed", "true");

  // Choosing again replaced the step: Back leaves All writing instead of undoing each choice.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/all/);

  for (const piece of ids) {
    const res = await page.request.delete(`/api/pieces/${piece}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
    expect(res.status()).toBe(204);
  }
});

test("the open picture is in the address: Back closes it, a refresh opens it, an unknown one shows the grid", async ({ page }) => {
  await signIn(page);
  await page.goto("/pictures");
  await expect(page.getByText(/^\d+ pictures?\b/)).toBeVisible();
  const uploaded = page.waitForResponse((r) => r.request().method() === "PUT" && /\/api\/pictures\/[0-9a-f-]{36}\?size=small$/.test(r.url()));
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await (await chooser).setFiles(SAMPLE);
  const id = (await uploaded).url().match(/pictures\/([0-9a-f-]{36})/)![1]!;

  await page.getByRole("button", { name: "Open picture" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/pictures\\?picture=${id}$`));
  await expect(page.getByRole("dialog", { name: "Picture" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/pictures$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/pictures?picture=${id}`);
  await expect(page.getByRole("dialog", { name: "Picture" })).toBeVisible();
  // Opened from the address, closing has no step to take back: the address just drops the picture.
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/pictures$/);

  await page.goto("/pictures?picture=00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(/^\d+ pictures?\b/)).toBeVisible();
  await expect(page).toHaveURL(/\/pictures$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const res = await page.request.delete(`/api/pictures/${id}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  expect(res.status()).toBe(204);
});
