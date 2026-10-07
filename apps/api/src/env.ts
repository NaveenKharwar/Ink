import { z } from "zod";

const envSchema = z.object({
  // Unset means production: certificate checks and no API docs. `pnpm dev` sets development.
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  // Path to the database's CA certificate (PEM). Required in production.
  DATABASE_SSL_CA: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url(),
  // Lets the API (and only the API) read and write the private pictures bucket. Never sent to browsers.
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Where the embedder service listens (apps/embedder). Without it nothing is embedded and Related uses shared words.
  // Only this machine, a Tailscale address (100.64.0.0/10) or a private network name listed in EMBEDDER_PRIVATE_HOSTS: the writing must never go to a public host.
  EMBEDDER_URL: z.string().url().optional(),
  // Comma-separated private network names the embedder may live under, e.g. ".railway.internal" or "embedder.flycast". Each needs two or more parts.
  EMBEDDER_PRIVATE_HOSTS: z.string().optional(),
  // Shared with the embedder (sent as X-Embedder-Secret). Required by the embedder when it is not on localhost.
  EMBEDDER_SECRET: z.string().min(16).optional(),
  // A file the API appends its log lines to (ids, scores and errors, never writing). Development defaults to logs/api.log; elsewhere unset means terminal only.
  LOG_FILE: z.string().min(1).optional()
});

export function privateHostEntries(list: string | undefined): string[] {
  return (list ?? "").split(",").map((entry) => entry.trim().toLowerCase().replace(/^\./, "")).filter(Boolean);
}

export function isPrivateEmbedder(url: string, privateHosts: string[] = []): boolean {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (privateHosts.some((entry) => entry.includes(".") && (host === entry || host.endsWith(`.${entry}`)))) return true;
  const parts = host.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) && parts[0] === 100 && parts[1]! >= 64 && parts[1]! <= 127;
}

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment. ${problems.join("; ")}`);
  }
  const { EMBEDDER_URL, EMBEDDER_PRIVATE_HOSTS } = result.data;
  const privateHosts = privateHostEntries(EMBEDDER_PRIVATE_HOSTS);
  const tooBroad = privateHosts.filter((entry) => !entry.includes("."));
  if (tooBroad.length > 0) throw new Error(`Invalid environment. EMBEDDER_PRIVATE_HOSTS: ${tooBroad.join(", ")} needs two or more parts (like .railway.internal)`);
  if (EMBEDDER_URL && !isPrivateEmbedder(EMBEDDER_URL, privateHosts)) {
    throw new Error("Invalid environment. EMBEDDER_URL: must be localhost, a Tailscale (100.64.0.0/10) address or a name under EMBEDDER_PRIVATE_HOSTS");
  }
  return result.data;
}
