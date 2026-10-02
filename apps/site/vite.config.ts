import { defineConfig } from "vite";

// Where "Start writing" goes: the app's address. Set APP_URL when building; "#" until there is one.
const appUrl = (process.env.APP_URL ?? "#").replace(/\/$/, "");

export default defineConfig({
  base: "./",
  plugins: [
    {
      name: "app-url",
      transformIndexHtml: (html) => html.replaceAll("{{APP_URL}}", appUrl)
    }
  ]
});
