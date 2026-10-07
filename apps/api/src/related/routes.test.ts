import assert from "node:assert/strict";
import { test } from "node:test";
import { buildApp } from "../app.js";
import type { VerifyToken } from "../auth.js";
import { memoryPicturesRepo } from "../pictures/repo.js";
import { memoryPictureStore } from "../pictures/store.js";
import type { PiecesRepo } from "../pieces/repo.js";
import { noticeCrosses, noticeOne, noticeRepeats, noticeReturn } from "./noticed.js";
import { rankRelated, type Candidate } from "./rank.js";
import type { RelatedRepo } from "./repo.js";

const ASHA = "11111111-1111-4111-8111-111111111111";
const RAVI = "22222222-2222-4222-8222-222222222222";
const [A, B, C] = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "cccccccc-cccc-4ccc-8ccc-cccccccccccc"];

const NOW = new Date("2026-09-30T00:00:00Z");
const piece = (id: string, text: string, updatedAt: string, title: string | null = null): Candidate => ({
  id, title, text, language: "en", style: "poem", createdAt: updatedAt, updatedAt
});

test("pieces that share words are related, the closest first", () => {
  const current = piece(A, "The rain kept the window company\nand the kettle went cold", "2026-09-29T00:00:00Z");
  const out = rankRelated(
    current,
    [
      piece(B, "Steam on the window, rain on the steam, the kettle again and again and again and again and again and again and again and again and again and again and again and again", "2026-08-01T00:00:00Z"),
      piece(C, "A bus, a shelter, a quiet stranger with a folded newspaper hat, waiting out the weather together for a very long time, long past the hour that anyone had promised", "2026-08-02T00:00:00Z")
    ],
    NOW
  );
  assert.deepEqual(out.related.map((n) => n.id), [B]);
  assert.deepEqual(out.related[0]!.lines, ["Steam on the window, rain on the steam, the kettle again and again and again and again and again and again and again and again and again and again and again and again"]);
  assert.equal(out.forgotten.length, 0);
});

test("old pieces close enough are forgotten, closest first, at most two, and never also related", () => {
  const current = piece(A, "The kettle knew my name", "2026-09-29T00:00:00Z");
  const old = (id: string, text: string, date: string, similarity: number) => ({ ...piece(id, text, date), similarity });
  const out = rankRelated(
    current,
    [
      old("d1", "a long letter about nothing at all that goes on and on for the whole page and past the edge of what anyone would call a line, honestly, and then some", "2025-01-01T00:00:00Z", 0.58),
      old("d2", "the kettle again, again", "2025-02-01T00:00:00Z", 0.71),
      old("d3", "one more old page with no shared words whatsoever, just to fill the shelf up to the brim with paper and dust and patient old ink that nobody has opened", "2024-12-01T00:00:00Z", 0.55),
      old("d4", "an older page still, close but not quite close enough to be brought back from the shelf, however long it has been waiting there in the dark", "2024-11-01T00:00:00Z", 0.5)
    ],
    NOW
  );
  assert.deepEqual(out.forgotten.map((n) => n.id), ["d2", "d1"]);
  assert.ok(!out.related.some((n) => out.forgotten.some((f) => f.id === n.id)));
});

test("Forgotten shows never-shown pieces first and rests a shown piece, except beside the piece it was shown for", () => {
  const current = piece(A, "The kettle knew my name", "2026-09-29T00:00:00Z");
  const old = (id: string, date: string, similarity: number, shownAt: string | null = null, shownFor: string | null = null) => ({
    ...piece(id, `old page ${id} that goes on well past the edge of any line, long enough to be no loose thing at all, only a page`, date),
    similarity, shownAt, shownFor
  });
  const recent = "2026-09-20T00:00:00Z";
  const long = "2026-07-01T00:00:00Z";
  const others = [
    old("d1", "2025-01-01T00:00:00Z", 0.9, long),
    old("d2", "2025-02-01T00:00:00Z", 0.6),
    old("d3", "2025-03-01T00:00:00Z", 0.7, recent, B),
    old("d4", "2025-04-01T00:00:00Z", 0.55)
  ];
  // d3 rests (shown 10 days ago for another piece); d1 was shown long ago, so it ranks after the unseen ones.
  assert.deepEqual(rankRelated(current, others, NOW).forgotten.map((n) => n.id), ["d2", "d4"]);
  // Beside the piece it was shown for, d3 stays, so the notes do not change while the writer keeps working.
  assert.deepEqual(rankRelated(current, others.map((o) => (o.id === "d3" ? { ...o, shownFor: A } : o)), NOW).forgotten.map((n) => n.id), ["d2", "d4"]);
  assert.deepEqual(rankRelated(current, others.filter((o) => o.id !== "d2" && o.id !== "d4"), NOW).forgotten.map((n) => n.id), ["d1"]);
});

test("short pieces are loose lines; a blank piece has nothing to be close to", () => {
  const current = piece(A, "The kettle knew my name", "2026-09-29T00:00:00Z");
  const out = rankRelated(current, [piece(B, "the kettle again, again", "2026-09-01T00:00:00Z")], NOW);
  assert.deepEqual(out.loose.map((n) => n.id), [B]);
  assert.deepEqual(rankRelated(piece(A, "  ", "2026-09-29T00:00:00Z"), [piece(B, "kettle", "2026-09-01T00:00:00Z")], NOW), {
    related: [], forgotten: [], loose: [], looked: false
  });
});

test("noise stays out: one-word pieces, copies of this page, repeats, and a page too short to compare", () => {
  const current = piece(A, "The kettle knew my name", "2026-09-29T00:00:00Z");
  const out = rankRelated(
    current,
    [
      piece("n1", "sdadsad", "2026-09-01T00:00:00Z"),
      piece("n2", "kettle", "2026-09-02T00:00:00Z"),
      piece("c1", "the kettle knew my name.", "2026-09-03T00:00:00Z"),
      piece("r1", "A kettle clicks off again", "2026-09-04T00:00:00Z"),
      piece("r2", "a kettle clicks off, again!", "2026-09-05T00:00:00Z")
    ],
    NOW
  );
  assert.deepEqual(out.loose.map((n) => n.id), ["r2"]);
  assert.deepEqual(out.related, []);
  // Two words is not a few lines yet.
  assert.deepEqual(rankRelated(piece(A, "kettle again", "2026-09-29T00:00:00Z"), [piece(B, "the kettle again, again", "2026-09-01T00:00:00Z")], NOW), {
    related: [], forgotten: [], loose: [], looked: false
  });
});

test("Devanagari words count too", () => {
  const current = piece(A, "बारिश में टीन की छत बोलती रही", "2026-09-29T00:00:00Z");
  const other = piece(B, "छत पर बारिश की आवाज़ रात भर सुनता रहा, और सोचता रहा कि कितनी बातें हैं जो अब तक अनकही रह गई हैं, कितने ख़त हैं जो भेजे नहीं गए, कितने नाम हैं जिन्हें आवाज़ नहीं मिली", "2026-09-01T00:00:00Z");
  assert.deepEqual(rankRelated(current, [other], NOW).related.map((n) => n.id), [B]);
});

// The routes, over a repo that remembers who asked, to show every call names the signed-in writer.
function stubRepo() {
  const asked: string[] = [];
  const dismissed: string[] = [];
  const mine = new Set([`${ASHA}|${A}`, `${ASHA}|${B}`]);
  const keptOut = new Set<string>();
  const repo: RelatedRepo = {
    async latest(userId) {
      return mine.has(`${userId}|${A}`) ? A : null;
    },
    async candidates(userId, pieceId) {
      asked.push(`${userId}|${pieceId}`);
      if (!mine.has(`${userId}|${pieceId}`)) return null;
      const out = keptOut.has(`${userId}|${pieceId}`);
      return { current: piece(A, "The kettle knew my name", "2026-09-29T00:00:00Z"), others: out ? [] : [piece(B, "the kettle again, again", "2026-09-01T00:00:00Z")], keptOut: out };
    },
    async markShown() {},
    async dismiss(userId, pieceId, otherId) {
      if (!mine.has(`${userId}|${pieceId}`) || !mine.has(`${userId}|${otherId}`)) return false;
      dismissed.push(`${pieceId}>${otherId}`);
      return true;
    },
    async restore(userId, pieceId, otherId) {
      if (!mine.has(`${userId}|${pieceId}`) || !mine.has(`${userId}|${otherId}`)) return false;
      dismissed.length = 0;
      return true;
    }
  };
  return { repo, asked, dismissed, keptOut };
}

async function setup() {
  const stub = stubRepo();
  const noPieces = {} as PiecesRepo;
  const verify: VerifyToken = async (token) => {
    if (!token.startsWith("token-")) throw new Error("bad token");
    return { userId: token.slice("token-".length) };
  };
  const app = await buildApp({ repo: noPieces, related: stub.repo, pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() }, verify });
  const as = (userId: string) => ({ authorization: `Bearer token-${userId}` });
  return { app, as, ...stub };
}

test("the related routes need a token", async () => {
  const { app } = await setup();
  assert.equal((await app.inject({ method: "GET", url: `/api/pieces/${A}/related` })).statusCode, 401);
  assert.equal((await app.inject({ method: "PUT", url: `/api/pieces/${A}/related/${B}/dismissed` })).statusCode, 401);
});

test("the writer gets their notes; someone else's piece is not found", async () => {
  const { app, as, asked } = await setup();
  const mine = await app.inject({ method: "GET", url: `/api/pieces/${A}/related`, headers: as(ASHA) });
  assert.equal(mine.statusCode, 200);
  assert.deepEqual(mine.json().loose.map((n: { id: string }) => n.id), [B]);
  assert.equal(mine.json().keptOut, false);
  const theirs = await app.inject({ method: "GET", url: `/api/pieces/${A}/related`, headers: as(RAVI) });
  assert.equal(theirs.statusCode, 404);
  assert.deepEqual(asked, [`${ASHA}|${A}`, `${RAVI}|${A}`]);
  assert.equal((await app.inject({ method: "GET", url: "/api/pieces/nonsense/related", headers: as(ASHA) })).statusCode, 404);
});

test("a piece kept out of memory says so, and nothing is looked at beside it", async () => {
  const { app, as, keptOut } = await setup();
  keptOut.add(`${ASHA}|${A}`);
  const out = await app.inject({ method: "GET", url: `/api/pieces/${A}/related`, headers: as(ASHA) });
  assert.equal(out.statusCode, 200);
  assert.equal(out.json().keptOut, true);
  assert.deepEqual([out.json().related, out.json().forgotten, out.json().loose], [[], [], []]);
  keptOut.clear();
  assert.equal((await app.inject({ method: "GET", url: `/api/pieces/${A}/related`, headers: as(ASHA) })).json().keptOut, false);
});

test("the log says why pieces were shown by id and score, never by text, and every answer carries a request id", async () => {
  const lines: string[] = [];
  const stub = stubRepo();
  const verify: VerifyToken = async (token) => ({ userId: token.slice("token-".length) });
  const app = await buildApp({
    repo: {} as PiecesRepo, related: stub.repo, pictures: { store: memoryPictureStore(), repo: memoryPicturesRepo() }, verify,
    logger: { write: (line) => void lines.push(line) }
  });
  const res = await app.inject({ method: "GET", url: `/api/pieces/${A}/related`, headers: { authorization: `Bearer token-${ASHA}` } });
  assert.equal(res.statusCode, 200);
  const id = res.headers["x-request-id"];
  assert.match(String(id), /^[0-9a-f-]{36}$/);
  const entry = lines.map((line) => JSON.parse(line)).find((line) => line.msg === "Related looked");
  assert.equal(entry.reqId, id);
  assert.deepEqual(entry.related.picks, [{ id: B, list: "loose", similarity: null, overlap: 1 }]);
  assert.equal(entry.related.considered, 1);
  assert.equal(entry.related.withoutVector, 1);
  assert.doesNotMatch(lines.join(""), /kettle/);
});

test("dismissing and undoing answer 204, repeat safely, and refuse pieces that are not the writer's", async () => {
  const { app, as, dismissed } = await setup();
  const url = `/api/pieces/${A}/related/${B}/dismissed`;
  assert.equal((await app.inject({ method: "PUT", url, headers: as(ASHA) })).statusCode, 204);
  assert.equal((await app.inject({ method: "PUT", url, headers: as(ASHA) })).statusCode, 204);
  assert.deepEqual(dismissed.slice(0, 1), [`${A}>${B}`]);
  assert.equal((await app.inject({ method: "DELETE", url, headers: as(ASHA) })).statusCode, 204);
  assert.equal((await app.inject({ method: "PUT", url, headers: as(RAVI) })).statusCode, 404);
  assert.equal((await app.inject({ method: "PUT", url: `/api/pieces/${A}/related/nope/dismissed`, headers: as(ASHA) })).statusCode, 404);
});

test("close vectors rank first, weak ones are left out, and pieces without a vector fall back to shared words", () => {
  const current = piece(A, "The rain kept the window company", "2026-09-29T00:00:00Z");
  const long = " and a good deal more writing so that this does not count as a loose line, going on well past the short limit of a line, again and again and again and again and again";
  const out = rankRelated(
    current,
    [
      { ...piece("v1", "Monsoon evenings" + long, "2026-08-01T00:00:00Z"), similarity: 0.8 },
      { ...piece("v2", "Taxes and receipts" + long, "2026-08-02T00:00:00Z"), similarity: 0.2 },
      { ...piece("w1", "Rain on the window again" + long, "2026-08-03T00:00:00Z"), similarity: null },
      { ...piece("w2", "Nothing in common here" + long, "2026-08-04T00:00:00Z") }
    ],
    NOW
  );
  assert.deepEqual(out.related.map((n) => n.id), ["v1", "w1"]);
});

test("Forgotten and Loose lines need a clearly close match; with nothing close every section is empty", () => {
  const current = piece(A, "The rain kept the window company", "2026-09-29T00:00:00Z");
  const near = (id: string, text: string, date: string, similarity: number) => ({ ...piece(id, text, date), similarity });
  const out = rankRelated(
    current,
    [
      near("o1", "An old page about letters and stamps, long enough not to be a loose line at all, going on and on well past the short limit", "2025-01-01T00:00:00Z", 0.52),
      near("o2", "An old page about monsoon windows, long enough not to be a loose line at all, going on and on well past the short limit", "2025-02-01T00:00:00Z", 0.6),
      near("s1", "tin roof, all night", "2026-09-01T00:00:00Z", 0.56),
      near("s2", "bus tickets, receipts", "2026-09-02T00:00:00Z", 0.47),
      { ...piece("s3", "the window again", "2026-09-03T00:00:00Z"), similarity: null }
    ],
    NOW
  );
  assert.deepEqual(out.forgotten.map((n) => n.id), ["o2"]);
  // s2 clears Related's floor but not Loose's; s3 has no vector yet and shares a word.
  assert.deepEqual(out.loose.map((n) => n.id), ["s1", "s3"]);
  assert.equal(out.looked, true);

  const none = rankRelated(current, [near("q1", "An old page about taxes and forms", "2025-01-01T00:00:00Z", 0.4), near("q2", "parking ticket", "2026-09-01T00:00:00Z", 0.3)], NOW);
  assert.deepEqual(none, { related: [], forgotten: [], loose: [], looked: true });
});

test("an old piece comes back only when the latest piece is clearly close, in Hindi or English, with a vector", () => {
  const current = { ...piece(A, "The rain kept the window company", "2026-09-29T00:00:00Z"), similarity: null };
  const old = (id: string, similarity: number | null, language: Candidate["language"] = "en") => ({
    ...piece(id, `An old page ${id} about monsoon windows, long enough not to be a loose line at all, going on well past the short limit`, "2025-02-01T00:00:00Z"),
    language, similarity
  });
  assert.deepEqual(noticeReturn(current, [old("o1", 0.6)], NOW)?.note.id, "o1");
  assert.equal(noticeReturn(current, [old("o1", 0.6)], NOW)?.kind, "returns");
  // The closest comes first; below the floor nothing shows.
  assert.equal(noticeReturn(current, [old("o1", 0.56), old("o2", 0.7)], NOW)?.note.id, "o2");
  assert.equal(noticeReturn(current, [old("o1", 0.5)], NOW), null);
  // A shared word is not enough without a vector, and Hinglish is left out on either side.
  assert.equal(noticeReturn(current, [old("o1", null)], NOW), null);
  assert.equal(noticeReturn(current, [old("o1", 0.7, "hi-Latn")], NOW), null);
  assert.equal(noticeReturn({ ...current, language: "hi-Latn" }, [old("o1", 0.7)], NOW), null);
  // Nothing recent, nothing to come back to.
  assert.equal(noticeReturn({ ...current, updatedAt: "2026-06-01T00:00:00Z" }, [old("o1", 0.7)], NOW), null);
  // Pieces that are not old enough are the panel's business, not a remark.
  assert.equal(noticeReturn(current, [{ ...old("o1", 0.7), updatedAt: "2026-09-01T00:00:00Z" }], NOW), null);
});

test("the noticed route needs a token and looks only at the signed-in writer's pieces", async () => {
  const { app, as, asked } = await setup();
  assert.equal((await app.inject({ method: "GET", url: "/api/noticed" })).statusCode, 401);
  const mine = await app.inject({ method: "GET", url: "/api/noticed", headers: as(ASHA) });
  assert.equal(mine.statusCode, 200);
  assert.deepEqual(mine.json(), { noticed: null });
  assert.deepEqual(asked, [`${ASHA}|${A}`]);
  // A writer with no pieces gets nothing, and nothing of anyone else's.
  const theirs = await app.inject({ method: "GET", url: "/api/noticed", headers: as(RAVI) });
  assert.deepEqual(theirs.json(), { noticed: null });
  assert.deepEqual(asked, [`${ASHA}|${A}`]);
});

test("the same thing written three times: the latest piece and two close ones, the earliest speaks, and it wins over a return", () => {
  const current = piece(A, "The rain kept the window company", "2026-09-29T00:00:00Z");
  const near = (id: string, date: string, similarity: number | null, language: Candidate["language"] = "en") => ({
    ...piece(id, `Page ${id} about the rain and the window, long enough not to be a loose line at all, going on well past the short limit of a line`, date),
    language, similarity
  });
  const out = noticeRepeats(current, [near("p1", "2025-02-01T00:00:00Z", 0.6), near("p2", "2026-03-01T00:00:00Z", 0.58), near("p3", "2024-05-01T00:00:00Z", 0.4)], NOW);
  assert.equal(out?.kind, "repeats");
  assert.equal(out?.note.id, "p1");
  assert.deepEqual(out && out.kind === "repeats" ? out.dates : [], ["2025-02-01T00:00:00Z", "2026-03-01T00:00:00Z", "2026-09-29T00:00:00Z"]);
  assert.equal(noticeOne(current, [near("p1", "2025-02-01T00:00:00Z", 0.6), near("p2", "2026-03-01T00:00:00Z", 0.58)], NOW)?.kind, "repeats");
  // Two is not three; weak, vectorless and Hinglish pieces do not count; with one old close piece it is a return.
  assert.equal(noticeRepeats(current, [near("p1", "2025-02-01T00:00:00Z", 0.6)], NOW), null);
  assert.equal(noticeRepeats(current, [near("p1", "2025-02-01T00:00:00Z", 0.6), near("p2", "2026-03-01T00:00:00Z", 0.5)], NOW), null);
  assert.equal(noticeRepeats(current, [near("p1", "2025-02-01T00:00:00Z", 0.6), near("p2", "2026-03-01T00:00:00Z", null)], NOW), null);
  assert.equal(noticeRepeats(current, [near("p1", "2025-02-01T00:00:00Z", 0.6), near("p2", "2026-03-01T00:00:00Z", 0.7, "hi-Latn")], NOW), null);
  assert.equal(noticeOne(current, [near("p1", "2025-02-01T00:00:00Z", 0.6)], NOW)?.kind, "returns");
  assert.equal(noticeOne(current, [near("p1", "2025-02-01T00:00:00Z", 0.4)], NOW), null);
});

test("the same idea in the other language: Hindi for English or English for Hindi, clearly close, with a vector", () => {
  const hi = (id: string, date: string, similarity: number | null, language: Candidate["language"] = "hi") => ({
    ...piece(id, `बारिश में टीन की छत ${id} बोलती रही, और रात भर सुनता रहा कि कितनी बातें हैं जो अब तक अनकही रह गई हैं, कितने ख़त हैं जो भेजे नहीं गए, कितने नाम`, date),
    language, similarity
  });
  const current = piece(A, "The rain kept the window company", "2026-09-29T00:00:00Z");
  const out = noticeCrosses(current, [hi("h1", "2025-02-01T00:00:00Z", 0.56), hi("h2", "2025-03-01T00:00:00Z", 0.64)], NOW);
  assert.equal(out?.kind, "crosses");
  assert.equal(out?.note.id, "h2");
  assert.deepEqual(out && out.kind === "crosses" ? out.other : null, { language: "en", createdAt: "2026-09-29T00:00:00Z" });
  // The other way round too.
  const english = { ...piece(B, "The rain kept the window company, and the kettle went cold, and the night went on for so long that nobody could say when it began or ended", "2025-02-01T00:00:00Z"), similarity: 0.6 };
  const hindiNow = { ...piece(A, "बारिश में टीन की छत बोलती रही", "2026-09-29T00:00:00Z"), language: "hi" as const };
  assert.equal(noticeCrosses(hindiNow, [english], NOW)?.note.id, B);
  // Same language, weak, no vector, Hinglish or mixed on either side: nothing.
  assert.equal(noticeCrosses(current, [hi("h1", "2025-02-01T00:00:00Z", 0.5)], NOW), null);
  assert.equal(noticeCrosses(current, [hi("h1", "2025-02-01T00:00:00Z", null)], NOW), null);
  assert.equal(noticeCrosses(current, [hi("h1", "2025-02-01T00:00:00Z", 0.7, "hi-Latn")], NOW), null);
  assert.equal(noticeCrosses({ ...current, language: "mixed" }, [hi("h1", "2025-02-01T00:00:00Z", 0.7)], NOW), null);
  assert.equal(noticeCrosses(current, [{ ...english, similarity: 0.7 }], NOW), null);
  // Three of the same thing still wins; with one close piece in the other language it is a crossing.
  assert.equal(noticeOne(current, [hi("h1", "2025-02-01T00:00:00Z", 0.7)], NOW)?.kind, "crosses");
});
