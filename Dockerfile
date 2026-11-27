FROM node:22-bookworm-slim AS frontend

WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./frontend/
WORKDIR /build/frontend
RUN npm ci
COPY frontend/ ./
RUN mkdir -p ../src/vsr/web && npm run build

FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    VSR_HOME=/var/lib/vsr

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && python -m pip install --no-cache-dir uv==0.12.10

COPY pyproject.toml uv.lock ./
COPY src/vsr ./src/vsr
COPY --from=frontend /build/src/vsr/web ./src/vsr/web

RUN uv sync --frozen --no-dev --extra plot --extra safetensors \
    && useradd --system --uid 10001 --create-home vsr \
    && install -d --owner=vsr --group=vsr /var/lib/vsr

USER vsr

EXPOSE 8765

CMD ["/app/.venv/bin/vsr", "serve", "--host", "0.0.0.0", "--port", "8765", "--no-browser"]
