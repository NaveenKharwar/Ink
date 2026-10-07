// Prints a real access token that has already run out: the first writer's own token, re-signed with the
// local stack's secret and an expiry in the past. The API must refuse it. CI only.
import { SignJWT, decodeJwt } from "jose";

const { SUPABASE_URL, SUPABASE_ANON_KEY, TEST_EMAIL, TEST_PASSWORD, JWT_SECRET } = process.env;
const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
});
if (!res.ok) throw new Error(`Sign-in answered ${res.status}`);
const { access_token } = await res.json();
const { exp, iat, ...claims } = decodeJwt(access_token);
const past = Math.floor(Date.now() / 1000) - 3600;
const token = await new SignJWT(claims)
  .setProtectedHeader({ alg: "HS256", typ: "JWT" })
  .setIssuedAt(past - 3600)
  .setExpirationTime(past)
  .sign(new TextEncoder().encode(JWT_SECRET));
console.log(token);
