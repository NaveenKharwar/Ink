import { devices } from "@playwright/test";
import { expect, signIn, test } from "./watch";

// A phone: a touch screen, where small controls get a 44px hit area (touch-44).
test.use({ ...devices["Pixel 7"] });

test("on a touch screen the link card's link, Edit and Remove are 44px to tap", async ({ page }) => {
  await signIn(page);
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Touch test web");
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);
  await page.evaluate(() => {
    const editor = (document.querySelector(".ProseMirror") as unknown as { editor: any }).editor;
    const from = 1 + editor.state.doc.textContent.indexOf("web");
    editor.chain().focus().setTextSelection({ from, to: from + 3 }).setLink({ href: "https://withink.app" }).setTextSelection(from + 1).run();
  });

  const card = page.getByRole("group", { name: "Link" });
  await expect(card).toBeVisible();
  const hitAreas = await card.evaluate((el) =>
    [...el.querySelectorAll("a, button")].map((control) => {
      const area = getComputedStyle(control, "::before");
      return { name: control.textContent!.trim(), width: parseFloat(area.width), height: parseFloat(area.height) };
    })
  );
  expect(hitAreas.map((a) => a.name)).toEqual(["withink.app", "Edit", "Remove"]);
  for (const area of hitAreas) {
    expect(area.height, `${area.name} height`).toBeGreaterThanOrEqual(44);
    expect(area.width, `${area.name} width`).toBeGreaterThanOrEqual(44);
  }

  // Leave nothing behind.
  const mark = page.getByRole("button", { name: "Show echoes" });
  if ((await mark.getAttribute("aria-pressed")) !== "true") await mark.click();
  await page.getByText("Delete this piece").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Piece deleted")).toBeVisible();
});
