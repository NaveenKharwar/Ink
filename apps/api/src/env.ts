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
  EMBEDDER_URL: z.string().url().optional()
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const cleaned = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ""));
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment. ${problems.join("; ")}`);
  }
  return result.data;
}
