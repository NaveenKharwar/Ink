import type pg from "pg";

/** What the delete page shows before the writer confirms. */
export type PendingDeletion = { userId: string; email: string; pieces: number; pictures: number };

export interface AccountRepo {
  /** The writer's sign-in email, or null when the account is gone. */
  emailOf(userId: string): Promise<string | null>;
  /** Keeps the hash of a new link's token; any earlier link of this writer stops working. */
  saveDeletion(userId: string, tokenHash: Buffer, expiresAt: Date): Promise<void>;
  /** The writer a link belongs to, while it still works. */
  findDeletion(tokenHash: Buffer): Promise<PendingDeletion | null>;
}

export function pgAccountRepo(db: pg.Pool): AccountRepo {
  return {
    async emailOf(userId) {
      const { rows } = await db.query<{ email: string | null }>("select email from auth.users where id = $1", [userId]);
      return rows[0]?.email ?? null;
    },
    async saveDeletion(userId, tokenHash, expiresAt) {
      await db.query(
        `insert into account_deletions (user_id, token_hash, expires_at) values ($1, $2, $3)
         on conflict (user_id) do update set token_hash = excluded.token_hash, expires_at = excluded.expires_at, created_at = now()`,
        [userId, tokenHash, expiresAt]
      );
    },
    async findDeletion(tokenHash) {
      const { rows } = await db.query<{ user_id: string; email: string | null; pieces: number; pictures: number }>(
        `select d.user_id, u.email,
           (select count(*) from pieces p where p.user_id = d.user_id)::int as pieces,
           (select count(*) from pictures q where q.user_id = d.user_id)::int as pictures
         from account_deletions d join auth.users u on u.id = d.user_id
         where d.token_hash = $1 and d.expires_at > now()`,
        [tokenHash]
      );
      const row = rows[0];
      return row && row.email ? { userId: row.user_id, email: row.email, pieces: row.pieces, pictures: row.pictures } : null;
    }
  };
}

/** Deletes the sign-in account itself. Everything of the writer's in the database goes with it (on delete cascade). */
export interface AccountAuth {
  deleteUser(userId: string): Promise<void>;
}

/** Supabase's admin API, with the service key only the API holds. An account already gone counts as deleted. */
export function supabaseAccountAuth(supabaseUrl: string, serviceKey: string): AccountAuth {
  return {
    async deleteUser(userId) {
      const res = await fetch(new URL(`/auth/v1/admin/users/${encodeURIComponent(userId)}`, supabaseUrl), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey }
      });
      if (!res.ok && res.status !== 404) throw new Error(`Sign-in service could not delete the account (${res.status})`);
    }
  };
}

/** Kept in memory: for tests. */
export function memoryAccountRepo(emails: Record<string, string> = {}): AccountRepo & { deleteUser(userId: string): void } {
  const accounts = new Map(Object.entries(emails));
  const links = new Map<string, { userId: string; expiresAt: Date }>();
  return {
    async emailOf(userId) {
      return accounts.get(userId) ?? null;
    },
    async saveDeletion(userId, tokenHash, expiresAt) {
      for (const [hash, link] of links) if (link.userId === userId) links.delete(hash);
      links.set(tokenHash.toString("hex"), { userId, expiresAt });
    },
    async findDeletion(tokenHash) {
      const link = links.get(tokenHash.toString("hex"));
      const email = link && accounts.get(link.userId);
      if (!link || !email || link.expiresAt <= new Date()) return null;
      return { userId: link.userId, email, pieces: 0, pictures: 0 };
    },
    deleteUser(userId) {
      accounts.delete(userId);
      for (const [hash, link] of links) if (link.userId === userId) links.delete(hash);
    }
  };
}
