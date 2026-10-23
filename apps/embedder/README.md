# embedder

A small local service that turns text into meaning vectors (BGE-M3, 1024 numbers each). The API's
background worker calls it after a piece is saved.

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install --require-hashes -r requirements.txt
python server.py
```

The packages are locked with hashes for Python 3.11 (`requirements.txt`, made from `requirements.in`).

The model reads at most 512 tokens at a time. A longer text is read in parts of up to 500 tokens and
the parts' vectors are averaged, weighted by their length (`parts.py`), so the whole of a long piece
counts. A text that fits is read whole.

It listens on `127.0.0.1:8001` (`EMBEDDER_HOST`, `EMBEDDER_PORT`). The first start downloads the model (about 2 GB).

To listen anywhere but localhost (a private Tailscale address or a private network name, never a public one; the API must list that name in `EMBEDDER_PRIVATE_HOSTS`), set `EMBEDDER_SECRET` (16+ characters) here and the same value for the API; the embedder refuses to start without it. Requests over 1 MB are refused. The model is pinned to one full commit, with safetensors weights (they cannot run code when loaded).

```bash
curl -s localhost:8001/health
curl -s localhost:8001/embed -d '{"texts":["a quiet morning"]}' | head -c 120
```

The part splitting has its own tests (they use the model's tokenizer):

```bash
python -m unittest test_parts
```

After the way vectors are made changes, make every piece's vector again with the API's command
(it needs `EMBEDDER_URL` and logs piece ids only):

```bash
pnpm --filter @ink/api embed:rebuild
```
