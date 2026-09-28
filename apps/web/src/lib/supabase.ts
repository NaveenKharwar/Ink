import { createClient } from "@supabase/supabase-js";

const url = __SUPABASE_URL__;
const anonKey = __SUPABASE_ANON_KEY__;

if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in the repo's .env");
}

export const supabase = createClient(url, anonKey, {
  auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
