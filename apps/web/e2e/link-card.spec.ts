import { expect, signIn, test } from "./watch";

// The link card opens a link only for web pages and email; any other address is plain words.
test("the link card follows web and mail links, and shows any other address as plain words", async ({ page }) => {
  await signIn(page);
  await page.getByRole("group", { name: "How do you want to write?" }).getByText("Notes", { exact: true }).click();
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Link test web mail script");
  await expect(page).toHaveURL(/\/p\/[0-9a-f-]{36}$/);

  // A web address, the way a writer adds one: select the word, the tool bar's Link, type, Enter.
  const select = (word: string) =>
    page.evaluate((w) => {
      const editor = (document.querySelector(".ProseMirror") as unknown as { editor: any }).editor;
      const from = 1 + editor.state.doc.textContent.indexOf(w);
      editor.chain().focus().setTextSelection({ from, to: from + w.length }).run();
    }, word);
  await select("web");
  await page.getByRole("button", { name: "Link", exact: true }).click();
  await page.keyboard.type("withink.app");
  await page.keyboard.press("Enter");

  // A mail link through the editor's own command, and an address its command refuses (as a
  // hand-made sync could hold) put straight into the document.
  const refused = await page.evaluate(() => {
    const editor = (document.querySelector(".ProseMirror") as unknown as { editor: any }).editor;
    const at = (w: string) => 1 + editor.state.doc.textContent.indexOf(w);
    const accepted = editor.chain().setTextSelection({ from: at("script"), to: at("script") + 6 }).setLink({ href: "javascript:alert(1)" }).run();
    editor.chain().setTextSelection({ from: at("mail"), to: at("mail") + 4 }).setLink({ href: "mailto:hello@withink.app" }).run();
    editor.chain().setTextSelection({ from: at("script"), to: at("script") + 6 }).setMark("link", { href: "javascript:alert(1)" }).run();
    return !accepted;
  });
  expect(refused, "the editor's link command refuses javascript:").toBe(true);

  const card = page.getByRole("group", { name: "Link" });
  const cursorIn = (word: string) =>
    page.evaluate((w) => {
      const editor = (document.querySelector(".ProseMirror") as unknown as { editor: any }).editor;
      editor.chain().focus().setTextSelection(2 + editor.state.doc.textContent.indexOf(w)).run();
    }, word);

  await cursorIn("web");
  await expect(card.getByRole("link")).toHaveAttribute("href", "https://withink.app");
  await expect(card.getByRole("link")).toHaveAttribute("target", "_blank");

  await cursorIn("mail");
  await expect(card.getByRole("link")).toHaveAttribute("href", "mailto:hello@withink.app");

  await cursorIn("script");
  await expect(card.getByText("javascript:alert(1)")).toBeVisible();
  await expect(card.getByRole("link")).toHaveCount(0);
  await card.getByRole("button", { name: "Remove" }).click();
  await expect(card).toHaveCount(0);

  // Leave nothing behind.
  const mark = page.getByRole("button", { name: "Show echoes" });
  if ((await mark.getAttribute("aria-pressed")) !== "true") await mark.click();
  await page.getByText("Delete this piece").click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Piece deleted")).toBeVisible();
});
