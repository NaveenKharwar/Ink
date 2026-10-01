# embedder

A small local service that turns text into meaning vectors (BGE-M3, 1024 numbers each). The API's
background worker calls it after a piece is saved.

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

It listens on `127.0.0.1:8001` (`EMBEDDER_HOST`, `EMBEDDER_PORT`). The first start downloads the model (about 2 GB).

```bash
curl -s localhost:8001/health
curl -s localhost:8001/embed -d '{"texts":["a quiet morning"]}' | head -c 120
```
