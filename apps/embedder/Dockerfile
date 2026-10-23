# The embedder. Build from the repo root: docker build -f apps/embedder/Dockerfile .
FROM python:3.11-slim
ARG TARGETARCH
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TOKENIZERS_PARALLELISM=false \
    HF_HOME=/models \
    EMBEDDER_HOST=0.0.0.0 \
    EMBEDDER_PORT=8001
WORKDIR /app
# The locked versions, torch as its CPU-only build, every file checked by hash: one list for Intel
# machines, one for ARM (Apple silicon, ARM servers).
COPY apps/embedder/requirements-ci.txt apps/embedder/requirements-arm64.txt ./
RUN python -m pip install --no-cache-dir pip==26.0.1 \
 && if [ "$TARGETARCH" = "arm64" ]; then lock=requirements-arm64.txt; else lock=requirements-ci.txt; fi \
 && pip install --no-cache-dir --require-hashes --no-deps -r "$lock" \
 && pip check
COPY apps/embedder/*.py ./
# The model (about 2 GB) downloads into /models on the first start; keep it on a volume.
RUN useradd --create-home --uid 10001 embedder && mkdir -p /models && chown embedder /models
USER embedder
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=600s \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ['EMBEDDER_PORT']+'/health', timeout=4)"
CMD ["python", "server.py"]
