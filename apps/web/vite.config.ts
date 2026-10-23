import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { createHash } from "node:crypto";
import { defineConfig, loadEnv, type Plugin } from "vite";

const rootDir = new URL("../..", import.meta.url).pathname;

/**
 * The built page carries a Content-Security-Policy: scripts only from Ink itself (and the one inline
 * script in index.html, by its hash), requests only to Ink and Supabase, no plugins, no frames.
 * Styles may be inline because the editor adds its own small style tag. The dev server injects
 * inline scripts of its own, so the policy is added to the build only.
 */
function contentSecurityPolicy(supabaseUrl: string): Plugin {
  return {
    name: "content-security-policy",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html) {
        const hashes = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(
          ([, body]) => `'sha256-${createHash("sha256").update(body!).digest("base64")}'`
        );
        const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(" ")}`,
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self' data:",
          `connect-src 'self' ${supabase}`,
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'"
        ].join("; ");
        return html.replace("<head>", `<head>\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`);
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  // The shared .env at the repo root also holds server secrets, so only the two
  // public Supabase values are passed to the browser, one by one.
  const env = loadEnv(mode, rootDir, "");
  return {
    plugins: [react(), tailwindcss(), contentSecurityPolicy(env.SUPABASE_URL ?? "")],
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
