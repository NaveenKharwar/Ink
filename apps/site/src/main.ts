import "@fontsource-variable/funnel-display";
import "@fontsource-variable/newsreader";
import "@fontsource/kalam/300.css";
import "@fontsource/kalam/400.css";
import "./styles.css";

// A screenshot that has not been added yet leaves its frame empty instead of a broken-image icon.
for (const img of document.querySelectorAll<HTMLImageElement>("img[data-screen]")) {
  const hide = () => (img.hidden = true);
  if (img.complete && img.naturalWidth === 0) hide();
  else img.addEventListener("error", hide, { once: true });
}
