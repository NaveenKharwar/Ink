import type { ListPiecesResponse, Piece, SyncPieceInput, SyncPieceOutput, UpdatePieceInput } from "@ink/schemas";
import { supabase } from "./supabase";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Every call carries the signed-in writer's access token; supabase-js refreshes it when needed.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "Not signed in");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const res = await fetch(path, { ...init, headers });
  const body: unknown = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, err.error ?? "unknown", err.message ?? res.statusText);
  }
  return body as T;
}

export const pieces = {
  // Writing goes through sync: it merges with what other devices wrote.
  sync: (id: string, input: SyncPieceInput) =>
    request<SyncPieceOutput>(`/api/pieces/${encodeURIComponent(id)}/sync`, { method: "POST", body: JSON.stringify(input) }),
  list: (params: { limit?: number; cursor?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.cursor) q.set("cursor", params.cursor);
    const qs = q.toString();
    return request<ListPiecesResponse>(`/api/pieces${qs ? `?${qs}` : ""}`);
  },
  get: (id: string) => request<Piece>(`/api/pieces/${encodeURIComponent(id)}`),
  update: (id: string, patch: UpdatePieceInput) =>
    request<Piece>(`/api/pieces/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) })
};
