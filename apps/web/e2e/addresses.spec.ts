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

  // A list with one style still shows its words, and a chosen style it doesn't hold leaves the address.
  await page.getByRole("group", { name: "Writing style" }).getByRole("button", { name: /^Poems/ }).click();
  await expect(page).toHaveURL(/\/all\?filter=draft&style=poem$/);
  await page.goto(`/all?season=2020-winter&style=notes`);
  await expect(page).toHaveURL(/\/all\?season=2020-winter$/);
  await page.goBack();

  // Choosing again replaced the step: Back leaves All writing instead of undoing each choice.
  await page.goBack();
  await expect(page).not.toHaveURL(/\/all/);

  for (const piece of ids) {
    const res = await page.request.delete(`/api/pieces/${piece}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
    expect(res.status()).toBe(204);
  }
});

test("the open picture is in the address (/pictures?id=<id>): Back closes it, a refresh opens it, an unknown one shows the grid", async ({ page }) => {
  await signIn(page);
  await page.goto("/pictures");
  await expect(page.getByText(/^\d+ pictures?\b/)).toBeVisible();
  const uploaded = page.waitForResponse((r) => r.request().method() === "PUT" && /\/api\/pictures\/[0-9a-f-]{36}\?size=small$/.test(r.url()));
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload", exact: true }).click();
  await (await chooser).setFiles(SAMPLE);
  const id = (await uploaded).url().match(/pictures\/([0-9a-f-]{36})/)![1]!;

  await page.getByRole("button", { name: "Open picture" }).first().click();
  await expect(page).toHaveURL(new RegExp(`/pictures\\?id=${id}$`));
  await expect(page.getByRole("dialog", { name: "Picture" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/pictures$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/pictures?id=${id}`);
  await expect(page.getByRole("dialog", { name: "Picture" })).toBeVisible();
  // Opened from the address, closing has no step to take back: the address just drops the picture.
  await page.getByRole("dialog", { name: "Picture" }).getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/pictures$/);

  await page.goto("/pictures?id=00000000-0000-4000-8000-000000000000");
  await expect(page.getByText(/^\d+ pictures?\b/)).toBeVisible();
  await expect(page).toHaveURL(/\/pictures$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const res = await page.request.delete(`/api/pictures/${id}`, { headers: { Authorization: `Bearer ${await token(page)}` } });
  expect(res.status()).toBe(204);
});

test("open search is in the address as ?search, never the words typed: Back closes it, a piece from it replaces it", async ({ page }) => {
  await signIn(page);
  const word = `searchaddress${Date.now()}`;
  const id = await write(page, "Notes", `A search address note ${word}`);

  await page.goto("/all?style=notes");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Search your writing" });

  // Opening adds one step; typing never reaches the address.
  await page.keyboard.press("ControlOrMeta+k");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/all\?style=notes&search$/);
  await dialog.getByRole("combobox", { name: "Search" }).fill(word);
  await expect(dialog.getByRole("option").first()).toContainText(word);
  expect(page.url()).not.toContain(word);

  // Back closes search and keeps the list as it was.
  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/all\?style=notes$/);

  // A piece opened from search takes the search step's place: Back returns to the list without search.
  await page.keyboard.press("ControlOrMeta+k");
  await dialog.getByRole("combobox", { name: "Search" }).fill(word);
  await dialog.getByRole("option").first().click();
  await expect(page).toHaveURL(new RegExp(`/p/${id}$`));
  await page.goBack();
  await expect(page).toHaveURL(/\/all\?style=notes$/);
  await expect(dialog).toBeHidden();

  // A refresh with ?search opens an empty search; closing it takes ?search out of the address.
  await page.goto("/all?style=notes&search");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("combobox", { name: "Search" })).toHaveValue("");
  await dialog.getByRole("button", { name: "Close search" }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/all\?style=notes$/);
});

test("a mistyped address says the page isn't here and offers a new piece", async ({ page }) => {
  await signIn(page);

  for (const path of ["/alll", "/profil/x"]) {
    await page.goto(path);
    await expect(page.getByText("This page isn't here.")).toBeVisible();
    await expect(page).toHaveTitle("Not here, Ink");
    // The address stays as typed until the writer moves on.
    expect(new URL(page.url()).pathname).toBe(path);
  }

  await page.getByRole("button", { name: "Write something new" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".ProseMirror")).toBeVisible();

  // A piece address with no real id, or an id no piece of this writer has, says the piece isn't
  // here: with no Echoes (nothing to delete) and nothing marked in the menu.
  for (const path of ["/p/not-an-id", `/p/${crypto.randomUUID()}`]) {
    await page.goto(path);
    await expect(page.getByText("This piece isn't here.")).toBeVisible();
    await expect(page).toHaveTitle("Not here, Ink");
    await expect(page.getByRole("button", { name: "Delete this piece" })).toHaveCount(0);
    const menu = page.getByRole("button", { name: "Open menu" });
    if (await menu.isVisible()) await menu.click();
    await expect(page.getByRole("button", { name: /^All writing/ })).toBeVisible();
    await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
  }
});
