# embedder

A small local service that turns text into meaning vectors (BGE-M3, 1024 numbers each). The API's
background worker calls it after a piece is saved.

```bash
python3.11 -m venv .venv && source .venv/bin/activate
pip install --require-hashes -r requirements.txt
python server.py
```

The packages are locked with hashes for Python 3.11 (`requirements.txt`, made from `requirements.in`).

It listens on `127.0.0.1:8001` (`EMBEDDER_HOST`, `EMBEDDER_PORT`). The first start downloads the model (about 2 GB).

To listen anywhere but localhost (a private Tailscale address or a private network name, never a public one; the API must list that name in `EMBEDDER_PRIVATE_HOSTS`), set `EMBEDDER_SECRET` (16+ characters) here and the same value for the API; the embedder refuses to start without it. Requests over 1 MB are refused. The model is pinned to one full commit, with safetensors weights (they cannot run code when loaded).

```bash
curl -s localhost:8001/health
curl -s localhost:8001/embed -d '{"texts":["a quiet morning"]}' | head -c 120
```

## Tests

`test_model.py` checks the embedder with the real model through its own HTTP route (vector size and
length, same text same vector, close meanings closer, bad requests and a wrong secret refused):

```bash
python -m unittest discover -v -p "test_*.py"
```

CI runs every `test_*.py` here when a pull request changes the embedder (`.github/workflows/embedder.yml`).
It installs `requirements-ci.txt`: the same versions with hashes, torch as its CPU-only build for Linux.
When `requirements.txt` changes, remake `requirements-ci.txt` too (the command is at its top).

