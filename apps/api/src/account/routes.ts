import { createHash, randomBytes } from "node:crypto";
import { deletionTokenInput, type PendingDeletionResponse } from "@ink/schemas";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { PictureStore } from "../pictures/store.js";
import { tooMany, type RateLimits } from "../rate-limit.js";
import { deletedEmail, deleteLinkEmail } from "./emails.js";
import type { Mailer } from "./mail.js";
import type { AccountAuth, AccountRepo } from "./repo.js";

/** How long the emailed link works. */
export const DELETE_LINK_MINUTES = 60;
/** The page the link opens, in the app. The token rides in the address's #fragment, which browsers never send to a server. */
export const DELETE_PAGE = "/delete-account";

export type AccountDeps = {
  repo: AccountRepo;
  auth: AccountAuth;
  pictures: PictureStore;
  mailer: Mailer;
  /** Where the app lives, for the link in the email ("https://app.example"). Without it no link is sent. */
  appUrl: string | null;
};

export const hashToken = (token: string) => createHash("sha256").update(token).digest();
export const newToken = () => randomBytes(32).toString("base64url");

const cannotSend = (reply: FastifyReply) =>
  reply.code(503).send({ error: "email_unavailable", message: "Ink can't send email right now. Try again later." });
const linkExpired = (reply: FastifyReply) =>
  reply.code(404).send({ error: "link_expired", message: "This link has expired or was already used." });

/** Signed in: asks for the emailed link. Nothing is deleted here. */
export function registerAccountRoutes(app: FastifyInstance, deps: AccountDeps, limits: RateLimits) {
  app.post("/api/account/delete-link", async (request, reply) => {
    if (!deps.appUrl) return cannotSend(reply);
    if (!(await limits.allow(request.userId, "deleteLinks"))) return tooMany(reply);
    const email = await deps.repo.emailOf(request.userId);
    if (!email) return reply.code(404).send({ error: "not_found", message: "This account doesn't exist." });

    const token = newToken();
    // Saved before sending, so the link in the email always works; a new link replaces the old one.
    await deps.repo.saveDeletion(request.userId, hashToken(token), new Date(Date.now() + DELETE_LINK_MINUTES * 60_000));
    const link = new URL(`${DELETE_PAGE}#t=${token}`, deps.appUrl).toString();
    try {
      await deps.mailer.send(deleteLinkEmail(email, link));
    } catch (err) {
      request.log.error({ err: { message: (err as Error).message } }, "Delete link email failed");
      return cannotSend(reply);
    }
    return reply.code(204).send();
  });
}

/**
 * Not signed in: the page the link opens works on any device. The link's token is the proof: it
 * reached the writer's own email. Opening the page only reads; deleting needs the second call.
 */
export function registerAccountDeletionRoutes(app: FastifyInstance, deps: AccountDeps) {
  app.post("/api/account/deletion/check", async (request, reply) => {
    const body = deletionTokenInput.safeParse(request.body);
    if (!body.success) return linkExpired(reply);
    const pending = await deps.repo.findDeletion(hashToken(body.data.token));
    if (!pending) return linkExpired(reply);
    const response: PendingDeletionResponse = { email: pending.email, pieces: pending.pieces, pictures: pending.pictures };
    return response;
  });

  app.post("/api/account/deletion", async (request, reply) => {
    const body = deletionTokenInput.safeParse(request.body);
    if (!body.success) return linkExpired(reply);
    const pending = await deps.repo.findDeletion(hashToken(body.data.token));
    if (!pending) return linkExpired(reply);

    // The picture files first: if storage fails, nothing else is gone and the same link works again.
    await deps.pictures.deleteAll(pending.userId);
    // Then the account: every row of the writer's goes with it, and so do their sign-ins on every device.
    await deps.auth.deleteUser(pending.userId);
    request.log.info({ deleted: pending.userId }, "Account deleted");
    try {
      await deps.mailer.send(deletedEmail(pending.email));
    } catch (err) {
      request.log.error({ err: { message: (err as Error).message } }, "Account deleted email failed");
    }
    return reply.code(204).send();
  });
}
