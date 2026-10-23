import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { expect, signIn, test } from "./watch";

const SAMPLE = fileURLToPath(new URL("../../api/bruno/4 Pictures/sample.jpg", import.meta.url));

// The server's answer when a writer's pictures have used all their space, for every picture upload.
async function spaceIsFull(page: Page) {
  await page.route("**/api/pictures/*", (route) =>
    route.request().method() === "PUT"
      ? route.fulfill({ status: 413, contentType: "application/json", body: JSON.stringify({ error: "picture_space_full", message: "Your pictures have used all their space." }) })
      : route.fallback()
  );
}

async function upload(page: Page, button: string) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: button, exact: true }).click();
  await (await chooser).setFiles(SAMPLE);
}

test("when picture space is full, a piece's picture picker says where to make room", async ({ page }) => {
  await signIn(page);
  await spaceIsFull(page);
  await page.getByRole("button", { name: "Add a cover" }).click();
  await upload(page, "Upload a picture");
  await expect(page.getByText("Your pictures have used all their space. Delete some on the Pictures page to add more.")).toBeVisible();
});

test("when picture space is full, the Pictures page says to delete some here", async ({ page }) => {
  await signIn(page);
  await page.goto("/pictures");
  await expect(page.getByText(/^\d+ pictures?\b/)).toBeVisible();
  const before = await page.getByText(/^\d+ pictures?\b/).textContent();
  await spaceIsFull(page);
  await upload(page, "Upload");
  await expect(page.getByText("Your pictures have used all their space. Delete some here to add more.")).toBeVisible();
  await expect(page.getByText(/^\d+ pictures?\b/)).toHaveText(before!);
});
