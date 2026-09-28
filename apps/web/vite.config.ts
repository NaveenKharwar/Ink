import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

const rootDir = new URL("../..", import.meta.url).pathname;

export default defineConfig(({ mode }) => {
  // The shared .env at the repo root also holds server secrets, so only the two
  // public Supabase values are passed to the browser, one by one.
  const env = loadEnv(mode, rootDir, "");
  return {
    plugins: [react(), tailwindcss()],
    // Lists every bundled library with its license, served as /licenses.md.
    build: { license: { fileName: "licenses.md" } },
    define: {
      __SUPABASE_URL__: JSON.stringify(env.SUPABASE_URL ?? ""),
      __SUPABASE_ANON_KEY__: JSON.stringify(env.SUPABASE_ANON_KEY ?? "")
    },
    server: {
      proxy: { "/api": `http://localhost:${env.PORT || 3001}` }
    }
  };
});
