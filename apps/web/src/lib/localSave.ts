import { openBuffer } from "./buffer";
import { pieces } from "./api";
import { createSync } from "./sync";

// The one buffer and sync for this browser, wired to the real API.
export const buffer = openBuffer();
export const sync = createSync(buffer, pieces);
