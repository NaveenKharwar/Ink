export type PictureType = "image/jpeg" | "image/webp";
export type Picture = { bytes: Buffer; type: PictureType };
// Each picture is kept twice: as it is ("full") and a small copy for grids ("small").
export type PictureSize = "full" | "small";

/**
 * Where a writer's pictures (covers, pictures in Notes) are kept. Every call names the
 * writer, and a store only ever looks inside that writer's own folder.
 */
export interface PictureStore {
  put(userId: string, id: string, picture: Picture, size?: PictureSize): Promise<void>;
  get(userId: string, id: string, size?: PictureSize): Promise<Picture | null>;
  /** Deletes both sizes. */
  delete(userId: string, id: string): Promise<void>;
  /** Deletes every file in the writer's folder (their account is being deleted). */
  deleteAll(userId: string): Promise<void>;
}

const BUCKET = "pictures";

/**
 * Supabase Storage, private bucket, one folder per writer. Only this API reaches it (with the
 * service key); the bucket has no policies, so browsers cannot read it directly.
 */
export function supabasePictureStore(supabaseUrl: string, serviceKey: string): PictureStore {
  const path = (userId: string, id: string, size: PictureSize = "full") =>
    `${encodeURIComponent(userId)}/${encodeURIComponent(id)}${size === "small" ? "-small" : ""}`;
  const url = (userId: string, id: string, size?: PictureSize) =>
    new URL(`/storage/v1/object/${BUCKET}/${path(userId, id, size)}`, supabaseUrl);
  const auth = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };

  return {
    async put(userId, id, picture, size) {
      // Upsert: a retried upload of the same picture replaces it instead of failing.
      const res = await fetch(url(userId, id, size), {
        method: "POST",
        headers: { ...auth, "Content-Type": picture.type, "x-upsert": "true", "Cache-Control": "private, max-age=31536000" },
        body: new Uint8Array(picture.bytes)
      });
      if (!res.ok) throw new Error(`Storage refused the picture (${res.status})`);
    },
    async get(userId, id, size) {
      const res = await fetch(url(userId, id, size), { headers: auth });
      // Storage answers a missing object with 400 or 404.
      if (res.status === 400 || res.status === 404) return null;
      if (!res.ok) throw new Error(`Storage could not read the picture (${res.status})`);
      const type = res.headers.get("content-type");
      return { bytes: Buffer.from(await res.arrayBuffer()), type: type === "image/webp" ? "image/webp" : "image/jpeg" };
    },
    async delete(userId, id) {
      const res = await fetch(new URL(`/storage/v1/object/${BUCKET}`, supabaseUrl), {
        method: "DELETE",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ prefixes: [path(userId, id), path(userId, id, "small")] })
      });
      if (!res.ok) throw new Error(`Storage could not delete the picture (${res.status})`);
    },
    async deleteAll(userId) {
      const folder = encodeURIComponent(userId);
      // A page at a time: each page is deleted before the next is listed, so the list always starts at the top.
      for (let round = 0; round < 1000; round += 1) {
        const listed = await fetch(new URL(`/storage/v1/object/list/${BUCKET}`, supabaseUrl), {
          method: "POST",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ prefix: folder, limit: 100, offset: 0 })
        });
        if (!listed.ok) throw new Error(`Storage could not list the pictures (${listed.status})`);
        const names = ((await listed.json()) as Array<{ name: string }>).map((item) => `${folder}/${item.name}`);
        if (names.length === 0) return;
        const res = await fetch(new URL(`/storage/v1/object/${BUCKET}`, supabaseUrl), {
          method: "DELETE",
          headers: { ...auth, "Content-Type": "application/json" },
          body: JSON.stringify({ prefixes: names })
        });
        if (!res.ok) throw new Error(`Storage could not delete the pictures (${res.status})`);
      }
      throw new Error("Storage kept listing pictures after they were deleted");
    }
  };
}

/** Kept in memory: for tests. */
export function memoryPictureStore(): PictureStore {
  const pictures = new Map<string, Picture>();
  return {
    async put(userId, id, picture, size = "full") {
      pictures.set(`${userId}/${id}/${size}`, picture);
    },
    async get(userId, id, size = "full") {
      return pictures.get(`${userId}/${id}/${size}`) ?? null;
    },
    async delete(userId, id) {
      pictures.delete(`${userId}/${id}/full`);
      pictures.delete(`${userId}/${id}/small`);
    },
    async deleteAll(userId) {
      for (const key of [...pictures.keys()]) if (key.startsWith(`${userId}/`)) pictures.delete(key);
    }
  };
}
