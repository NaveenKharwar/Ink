"""Turns text into meaning vectors for Ink's related writing.

POST /embed  {"texts": ["..."]}  ->  {"model": "...", "vectors": [[...1024 numbers...]]}
GET  /health                     ->  {"ok": true, "model": "..."}

Listens on localhost unless EMBEDDER_HOST says otherwise (a private Tailscale address, never a
public one). When EMBEDDER_SECRET is set, every request must carry it in the X-Embedder-Secret
header; a non-local address without a secret refuses to start. Uses BGE-M3, run locally.
"""
import hmac
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from sentence_transformers import SentenceTransformer

MODEL = "BAAI/bge-m3"
# The full commit, so the weights can never change under the same name. It is BAAI's model as
# converted to safetensors (pull request 130 on the model page): weights that cannot run code when
# loaded. Checked against the official commit 5617a9f61b028005a4858fdac845db406aefb181: every other
# file is byte-identical and the vectors are the same.
REVISION = "9a0624b896d81da7492a910ffa53731274b6cf3d"
HOST = os.environ.get("EMBEDDER_HOST", "127.0.0.1")
PORT = int(os.environ.get("EMBEDDER_PORT", "8001"))
MAX_TEXTS = 32
MAX_CHARS = 20000
MAX_BODY = 1_000_000
SECRET = os.environ.get("EMBEDDER_SECRET", "")

if HOST not in ("127.0.0.1", "localhost", "::1") and len(SECRET) < 16:
    raise SystemExit("EMBEDDER_SECRET (16+ characters) is required when listening on " + HOST)

model = SentenceTransformer(MODEL, revision=REVISION, model_kwargs={"use_safetensors": True})
model.max_seq_length = 512
# The server answers requests on separate threads (the background queue and a search can arrive
# together), but the model crashes the whole process when two encodes run at once on Apple's GPU.
encode_lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/health":
            return self._send(200, {"ok": True, "model": MODEL})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/embed":
            return self._send(404, {"error": "not found"})
        if SECRET and not hmac.compare_digest(self.headers.get("X-Embedder-Secret", ""), SECRET):
            return self._send(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > MAX_BODY:
                return self._send(413, {"error": "too large"})
            texts = json.loads(self.rfile.read(length))["texts"]
            ok = isinstance(texts, list) and 0 < len(texts) <= MAX_TEXTS and all(isinstance(t, str) for t in texts)
        except (ValueError, KeyError, TypeError):
            ok = False
        if not ok:
            return self._send(400, {"error": f"send {{\"texts\": [1 to {MAX_TEXTS} strings]}}"})
        with encode_lock:
            vectors = model.encode([t[:MAX_CHARS] for t in texts], normalize_embeddings=True)
        self._send(200, {"model": MODEL, "vectors": vectors.tolist()})

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"embedder ready on http://{HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
