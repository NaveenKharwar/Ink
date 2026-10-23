import { fileURLToPath } from "node:url";
import { expect, signIn, test } from "./watch";

const SAMPLE = fileURLToPath(new URL("../../api/bruno/4 Pictures/sample.jpg", import.meta.url));

test("a writer adds a picture, sees it on the Pictures page and deletes it", async ({ page }) => {
  await signIn(page);
  await page.goto("/pictures");
  // "0 pictures", or "4 pictures · 1.3 MB" once there are some.
  const summary = page.getByText(/^\d+ pictures?\b/);
  const count = async () => Number((await summary.textContent())?.match(/^\d+/)?.[0] ?? -1);
  await expect(summary).toBeVisible();
  // The page is the writer's own; it needs no line saying the pictures are private.
  await expect(page.getByText("Only you can see these.")).toHaveCount(0);
  const before = await count();

  await page.goto("/");
  // Listen before choosing the file: the uploads can finish before the crop dialog shows.
  const uploads: string[] = [];
  page.on("response", (r) => {
    if (r.request().method() === "PUT" && r.url().includes("/api/pictures/")) uploads.push(`${r.status()} ${r.url().includes("size=small") ? "small copy" : "picture"}`);
  });
  const smallCopy = page.waitForResponse((r) => r.request().method() === "PUT" && /\/api\/pictures\/[0-9a-f-]{36}\?size=small$/.test(r.url()));
  await page.getByRole("button", { name: "Add a cover" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Upload a picture" }).click();
  await (await chooser).setFiles(SAMPLE);
  await expect(page.getByText("Crop the cover")).toBeVisible();
  await smallCopy;
  // Uploaded in the background: the picture first, then its small copy.
  expect(uploads).toEqual(["204 picture", "204 small copy"]);
  await page.keyboard.press("Escape");

  await page.goto("/pictures");
  await expect.poll(count).toBe(before + 1);
  await page.getByRole("button", { name: "Open picture" }).first().click();
  await expect(page.getByText("Not in any piece yet.")).toBeVisible();
  await page.getByRole("button", { name: "Delete picture" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(count).toBe(before);
});
