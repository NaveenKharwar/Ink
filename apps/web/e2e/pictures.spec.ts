import { fileURLToPath } from "node:url";
import { expect, signIn, test } from "./watch";

const SAMPLE = fileURLToPath(new URL("../../api/bruno/4 Pictures/sample.jpg", import.meta.url));

test("a writer adds a picture, sees it on the Pictures page and deletes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/pictures");
  const count = async () => Number((await page.getByText(/\d+ pictures? ·/).textContent())?.match(/\d+/)?.[0] ?? 0);
  await expect(page.getByText(/\d+ pictures? ·/)).toBeVisible();
  const before = await count();

  await page.goto("/");
  await page.getByRole("button", { name: "Add a cover" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload a picture" }).click();
  await (await chooser).setFiles(SAMPLE);
  await expect(page.getByText("Crop the cover")).toBeVisible();
  // Uploaded in the background: the picture, then its small copy.
  await page.waitForResponse((r) => /\/api\/pictures\/[0-9a-f-]{36}\?size=small$/.test(r.url()) && r.request().method() === "PUT");
  await page.keyboard.press("Escape");

  await page.goto("/pictures");
  await expect.poll(count).toBe(before + 1);
  await page.getByRole("button", { name: "Open picture" }).first().click();
  await expect(page.getByText("Not in any piece yet.")).toBeVisible();
  await page.getByRole("button", { name: "Delete picture" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(count).toBe(before);
});
