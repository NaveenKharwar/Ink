import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type VerifyToken = (token: string) => Promise<{ userId: string }>;

declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

/** Verifies Supabase access tokens against the project's published signing keys. */
export function supabaseTokenVerifier(supabaseUrl: string): VerifyToken {
  const issuer = new URL("/auth/v1", supabaseUrl).toString();
  const keys = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (token) => {
    const { payload } = await jwtVerify(token, keys, { issuer, audience: "authenticated" });
    if (typeof payload.sub !== "string" || payload.sub === "") throw new Error("Token has no subject");
    return { userId: payload.sub };
  };
}

export function requireUser(verify: VerifyToken) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
    if (!token) {
      return reply.code(401).send({ error: "unauthorized", message: "Sign in to continue." });
    }
    try {
      request.userId = (await verify(token)).userId;
    } catch {
      return reply.code(401).send({ error: "unauthorized", message: "Your session has expired. Sign in again." });
    }
  };
}
