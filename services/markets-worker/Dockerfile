FROM python:3.12-slim AS builder

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

WORKDIR /app
COPY pyproject.toml ./
COPY uv.lock ./
COPY src/ src/

# Install production dependencies into /app/.venv
RUN uv sync --no-dev --frozen

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copy virtualenv from builder
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src   /app/src

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH="/app/src"

EXPOSE 8000

# Default: run the API server.
# Override CMD to run the worker: python -m markets_worker.worker
CMD ["uvicorn", "markets_worker.main:app", "--host", "0.0.0.0", "--port", "8000"]
