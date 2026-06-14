# =============================================================================
# VerbaFlow AI — Backend Dockerfile
# =============================================================================
# Multi-stage build:
#   Stage 1 (builder)  — install Python deps in a venv
#   Stage 2 (runtime)  — lean production image, non-root user
# =============================================================================

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Builder — compile Python packages
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

# Build-time metadata
LABEL maintainer="VerbaFlow AI Team <team@verbaflow.ai>"
LABEL stage="builder"

# Build dependencies for packages that need C extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    libpq-dev \
    libhdf5-dev \
    pkg-config \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create & activate a virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Upgrade pip and install wheel/setuptools
RUN pip install --upgrade pip setuptools wheel

# Copy only requirements first (cache layer)
WORKDIR /build
COPY requirements.txt .

# Install all Python dependencies into the venv
RUN pip install --no-cache-dir -r requirements.txt

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Runtime — lean production image
# ─────────────────────────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Runtime metadata
LABEL maintainer="VerbaFlow AI Team <team@verbaflow.ai>"
LABEL org.opencontainers.image.title="VerbaFlow AI Backend"
LABEL org.opencontainers.image.description="FastAPI RAG backend for VerbaFlow AI"
LABEL org.opencontainers.image.version="1.0.0"
LABEL org.opencontainers.image.source="https://github.com/your-org/verbaflow-ai"

# Install only runtime system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    libssl3 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# ── Non-root user ─────────────────────────────────────────────────────────────
ARG UID=1000
ARG GID=1000
RUN groupadd --gid $GID verbaflow \
    && useradd --uid $UID --gid $GID --no-create-home --shell /bin/false verbaflow

# ── Copy venv from builder ────────────────────────────────────────────────────
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONPATH="/app"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONFAULTHANDLER=1

# ── Application directory ─────────────────────────────────────────────────────
WORKDIR /app

# Create data directories with correct ownership
RUN mkdir -p /app/data/uploads /app/data/faiss_indexes /app/logs \
    && chown -R verbaflow:verbaflow /app

# Copy application source code
COPY --chown=verbaflow:verbaflow . .

# Switch to non-root user
USER verbaflow

# Expose application port
EXPOSE 8000

# Expose Prometheus metrics port (optional)
EXPOSE 9090

# ── Health check ──────────────────────────────────────────────────────────────
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# ── Default command ───────────────────────────────────────────────────────────
# --workers: set to number of CPU cores * 2 + 1 for production; overrideable via env
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*", \
     "--access-log"]
