import type {
  LibraryResponse,
  NoticedResponse,
  Piece,
  RelatedResponse,
  PictureListResponse,
  PictureUsesResponse,
  SearchResponse,
  SyncPieceInput,
  SyncPieceOutput
} from "@ink/schemas";
import { supabase } from "./supabase";
import { reportTrouble, troubleOf } from "./trouble";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// `quiet` is for calls that handle being offline themselves (saving keeps the writing on the device,
// the Noticed remark is only extra): they never take the screen over. A session that ended still does.
type Init = RequestInit & { quiet?: boolean };

// Every call carries the signed-in writer's access token; supabase-js refreshes it when needed.
// When a call fails because of Ink or the connection, the whole app is told once (lib/trouble.ts),
// so the writer sees one screen and no call has to show its own complaint.
async function send(path: string, { quiet = false, ...init }: Init = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "Not signed in");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch (err) {
    if ((err as { name?: string })?.name !== "AbortError") {
      const trouble = troubleOf(null, quiet);
      if (trouble) reportTrouble(trouble);
    }
    throw err;
  }
  if (!res.ok) {
    const trouble = troubleOf(res.status, quiet);
    if (trouble) reportTrouble(trouble);
    const err = ((await res.json().catch(() => null)) ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? "unknown", err.message ?? res.statusText);
  }
  return res;
}

async function request<T>(path: string, init: Init = {}): Promise<T> {
  const res = await send(path, init);
  return (res.status === 204 ? null : await res.json().catch(() => null)) as T;
}

export const pieces = {
  // Writing goes through sync: it merges with what other devices wrote.
  sync: (id: string, input: SyncPieceInput) =>
    request<SyncPieceOutput>(`/api/pieces/${encodeURIComponent(id)}/sync`, { method: "POST", body: JSON.stringify(input), quiet: true }),
  // Only the writer's own answer to "Done with this?" sets this; it does not count as editing the piece.
  setStatus: async (id: string, status: "draft" | "finished") => {
    await send(`/api/pieces/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status }) });
  },
  // "Keep it out of Ink's memory" (false) and "Put it back" (true): a kept-out piece is not looked at beside others.
  setInMemory: async (id: string, include: boolean) => {
    await send(`/api/pieces/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ includeInMemory: include }) });
  },
  // Asks nothing and answers nothing: whether the sign-in is still accepted, before any page is shown.
  session: async () => {
    await send("/api/session");
  },
  library: () => request<LibraryResponse>("/api/library"),
  get: (id: string) => request<Piece>(`/api/pieces/${encodeURIComponent(id)}`),
  // What "Ink sees this too" shows beside a piece. "Not related" hides a piece beside this one for good.
  related: (id: string, signal?: AbortSignal) => request<RelatedResponse>(`/api/pieces/${encodeURIComponent(id)}/related`, { signal }),
  dismiss: async (id: string, otherId: string) => {
    await send(`/api/pieces/${encodeURIComponent(id)}/related/${encodeURIComponent(otherId)}/dismissed`, { method: "PUT" });
  },
  restore: async (id: string, otherId: string) => {
    await send(`/api/pieces/${encodeURIComponent(id)}/related/${encodeURIComponent(otherId)}/dismissed`, { method: "DELETE" });
  },
  // The one quiet remark under the All writing title; `noticed` is null when nothing is close.
  noticed: (signal?: AbortSignal) => request<NoticedResponse>("/api/noticed", { signal, quiet: true }),
  // "words" answers quickly; "close" (close in meaning) waits for the embedder and can be slow.
  search: (q: string, signal?: AbortSignal, part?: "words" | "close") =>
    request<SearchResponse>(`/api/search?${new URLSearchParams(part ? { q, part } : { q })}`, { signal })
};

// The writer's own pictures (covers, pictures in Notes), as their bytes. The API only ever reads
// and writes the signed-in writer's own pictures.
export const pictures = {
  // The small copy (for grids) goes with `size: "small"`; the picture itself carries its tiny preview.
  put: async (id: string, picture: Blob, options: { size?: "small"; preview?: string } = {}) => {
    const headers: Record<string, string> = { "Content-Type": picture.type };
    if (options.preview) headers["Ink-Picture-Preview"] = options.preview;
    const query = options.size ? `?size=${options.size}` : "";
    await send(`/api/pictures/${encodeURIComponent(id)}${query}`, { method: "PUT", body: picture, headers });
  },
  get: async (id: string, size: "full" | "small" = "full") =>
    (await send(`/api/pictures/${encodeURIComponent(id)}${size === "small" ? "?size=small" : ""}`, { quiet: true })).blob(),
  list: () => request<PictureListResponse>("/api/pictures"),
  uses: (id: string) => request<PictureUsesResponse>(`/api/pictures/${encodeURIComponent(id)}/uses`),
  // Also takes it out of every piece that uses it.
  remove: async (id: string) => {
    await send(`/api/pictures/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
};
