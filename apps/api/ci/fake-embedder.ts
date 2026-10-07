// A stand-in for apps/embedder, for CI only. Same words give the same vector, so Related and search
// have something to rank without downloading a model. The privacy checks don't depend on model quality.
import { createServer } from "node:http";
import { fakeEmbeddingProvider } from "../src/embeddings/fake.js";

const provider = fakeEmbeddingProvider();
const port = Number(process.env.FAKE_EMBEDDER_PORT ?? 8001);

createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.method !== "POST" || req.url !== "/embed") {
    res.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  try {
    const { texts } = JSON.parse(Buffer.concat(chunks).toString("utf8")) as { texts: string[] };
    const vectors = await provider.embed(texts);
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({ model: provider.model, vectors }));
  } catch {
    res.writeHead(400).end();
  }
}).listen(port, "127.0.0.1", () => console.log(`fake embedder on 127.0.0.1:${port}`));
