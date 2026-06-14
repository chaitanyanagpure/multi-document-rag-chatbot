# VerbaFlow AI — Environment Variables Reference

> Complete reference for all environment variables used by VerbaFlow AI.  
> See also: [`.env.example`](../.env.example) for a ready-to-copy template.

---

## Table of Contents

1. [Application](#1-application)
2. [Database (PostgreSQL)](#2-database-postgresql)
3. [Redis](#3-redis)
4. [Security / JWT](#4-security--jwt)
5. [AI Providers](#5-ai-providers)
6. [Vector Store](#6-vector-store)
7. [File Storage](#7-file-storage)
8. [RAG Pipeline](#8-rag-pipeline)
9. [CORS](#9-cors)
10. [Frontend (Next.js)](#10-frontend-nextjs)
11. [Monitoring & Observability](#11-monitoring--observability)
12. [Email / SMTP](#12-email--smtp)
13. [Rate Limiting](#13-rate-limiting)
14. [pgAdmin (Dev Only)](#14-pgadmin-dev-only)

---

## 1. Application

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `APP_NAME` | No | `VerbaFlow AI` | Human-readable application name. Used in emails, API responses, and UI |
| `APP_VERSION` | No | `1.0.0` | Semantic version string. Exposed at `/health` endpoint |
| `APP_ENV` | No | `production` | Environment identifier. Options: `development`, `staging`, `production` |
| `DEBUG` | No | `false` | Enable debug mode. **Never `true` in production** — exposes stacktraces |
| `LOG_LEVEL` | No | `INFO` | Logging verbosity. Options: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL` |

**Security note:** `DEBUG=true` exposes internal exception details in API responses and enables auto-reload. Always `false` in production.

**Example:**
```bash
APP_NAME=VerbaFlow AI
APP_VERSION=1.0.0
APP_ENV=production
DEBUG=false
LOG_LEVEL=INFO
```

---

## 2. Database (PostgreSQL)

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `DATABASE_URL` | ✅ | — | Full SQLAlchemy async DSN. Used by FastAPI backend |
| `POSTGRES_DB` | ✅ | — | Database name. Used by the `postgres` Docker container to create the initial DB |
| `POSTGRES_USER` | ✅ | — | PostgreSQL username |
| `POSTGRES_PASSWORD` | ✅ | — | PostgreSQL password. Must be strong in production |
| `POSTGRES_HOST` | No | `postgres` | PostgreSQL hostname. Defaults to Docker service name |
| `POSTGRES_PORT` | No | `5432` | PostgreSQL port |
| `DB_POOL_SIZE` | No | `20` | SQLAlchemy connection pool size. Increase for high concurrency |
| `DB_MAX_OVERFLOW` | No | `40` | Maximum connections above `DB_POOL_SIZE` |
| `DB_POOL_TIMEOUT` | No | `30` | Seconds to wait for a pool connection before raising an error |

**Security note:** 
- `POSTGRES_PASSWORD` must be at least 20 characters with mixed case, numbers, and symbols
- Never use the same password across environments
- In production, manage via cloud secret manager (GCP Secret Manager, AWS Secrets Manager)

**Examples:**
```bash
# Docker Compose
DATABASE_URL=postgresql+asyncpg://verbaflow:my_secure_pass@postgres:5432/verbaflow

# Kubernetes / Cloud SQL
DATABASE_URL=postgresql+asyncpg://verbaflow:my_secure_pass@/verbaflow?host=/cloudsql/project:region:instance

# AWS RDS
DATABASE_URL=postgresql+asyncpg://verbaflow:my_secure_pass@verbaflow.xxxxxxxx.us-east-1.rds.amazonaws.com:5432/verbaflow

POSTGRES_DB=verbaflow
POSTGRES_USER=verbaflow
POSTGRES_PASSWORD=MySecureP@ssword2025!
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=40
```

---

## 3. Redis

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `REDIS_URL` | ✅ | — | Redis connection URL. Format: `redis://[:password@]host:port/db` |
| `REDIS_HOST` | No | `redis` | Redis hostname (used if REDIS_URL not set) |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | `` | Redis AUTH password. Empty string = no password. Set in production |
| `REDIS_CACHE_TTL` | No | `3600` | Default cache TTL in seconds (1 hour) |
| `CELERY_BROKER_URL` | No | `redis://redis:6379/1` | Celery task queue broker URL (uses Redis DB 1) |
| `CELERY_RESULT_BACKEND` | No | `redis://redis:6379/2` | Celery result store URL (uses Redis DB 2) |

**Examples:**
```bash
# No password (development)
REDIS_URL=redis://localhost:6379/0

# With password (production)
REDIS_URL=redis://:my_redis_password@redis:6379/0

# Redis Cluster (Enterprise)
REDIS_URL=redis+cluster://user:password@redis-cluster:6379/

REDIS_CACHE_TTL=3600
```

---

## 4. Security / JWT

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `SECRET_KEY` | ✅ | — | Master secret for JWT signing. **Must be ≥ 32 random bytes** |
| `ALGORITHM` | No | `HS256` | JWT signing algorithm. Options: `HS256`, `RS256` (asymmetric) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Access token lifetime in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifetime in days |
| `BCRYPT_ROUNDS` | No | `12` | bcrypt work factor for password hashing. Higher = more secure but slower |

**Security note — SECRET_KEY:**
- Generate with: `openssl rand -hex 32`
- Never share across environments
- Rotate annually or immediately if compromised (all existing sessions will be invalidated)
- Store in secret manager, not in `.env` for production

**Examples:**
```bash
# Generate: openssl rand -hex 32
SECRET_KEY=a8f5f167f44f4964e6c998dee827110c5e3c2a8d4f3a5a2b1c0d9e8f7a6b5c4

ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=7
BCRYPT_ROUNDS=12
```

---

## 5. AI Providers

### Google Gemini

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `GEMINI_API_KEY` | Conditional | — | Google AI Studio API key. Required if `LLM_PROVIDER=gemini` |
| `GEMINI_MODEL` | No | `gemini-1.5-pro` | Gemini model ID for chat/completion |
| `GEMINI_PRO_VISION_MODEL` | No | `gemini-1.5-pro-vision` | Gemini model for vision/image tasks |
| `GEMINI_MAX_OUTPUT_TOKENS` | No | `8192` | Maximum tokens in model response |
| `GEMINI_TEMPERATURE` | No | `0.2` | Response creativity (0.0 = deterministic, 1.0 = creative) |

### OpenAI

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `OPENAI_API_KEY` | Conditional | — | OpenAI API key. Required if `LLM_PROVIDER=openai` |
| `OPENAI_MODEL` | No | `gpt-4o` | OpenAI model ID for completion |
| `OPENAI_MAX_TOKENS` | No | `4096` | Maximum response tokens |
| `OPENAI_TEMPERATURE` | No | `0.2` | Response temperature |

### Provider Selection

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `LLM_PROVIDER` | No | `gemini` | Active LLM provider. Options: `gemini`, `openai` |
| `EMBEDDING_PROVIDER` | No | `google` | Active embedding provider. Options: `google`, `openai` |
| `GOOGLE_EMBEDDING_MODEL` | No | `models/text-embedding-004` | Google embedding model ID |
| `OPENAI_EMBEDDING_MODEL` | No | `text-embedding-3-large` | OpenAI embedding model ID |
| `EMBEDDING_DIMENSIONS` | No | `768` | Embedding vector dimensions. Must match model output |

**Security note:**
- API keys grant billing access — rotate immediately if leaked
- Opt out of model training data: set `x-goog-user-project` header / OpenAI API opt-out
- Monitor API spend in cloud console; set billing alerts

**Examples:**
```bash
GEMINI_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
GEMINI_MODEL=gemini-1.5-pro
GEMINI_TEMPERATURE=0.2
GEMINI_MAX_OUTPUT_TOKENS=8192

OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
OPENAI_TEMPERATURE=0.2

LLM_PROVIDER=gemini
EMBEDDING_PROVIDER=google
GOOGLE_EMBEDDING_MODEL=models/text-embedding-004
EMBEDDING_DIMENSIONS=768
```

---

## 6. Vector Store

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `VECTOR_STORE_TYPE` | No | `faiss` | Backend for vector search. Options: `faiss`, `pinecone`, `weaviate`, `qdrant` |

### FAISS (default)

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `FAISS_INDEX_PATH` | No | `./data/faiss_indexes` | Directory where FAISS index files are stored. Must be persistent |

### Pinecone

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `PINECONE_API_KEY` | Conditional | — | Pinecone API key. Required if `VECTOR_STORE_TYPE=pinecone` |
| `PINECONE_ENV` | Conditional | — | Pinecone environment (e.g., `us-east-1-aws`) |
| `PINECONE_INDEX` | No | `verbaflow` | Pinecone index name |

### Weaviate

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `WEAVIATE_URL` | Conditional | — | Weaviate instance URL |
| `WEAVIATE_API_KEY` | No | — | Weaviate authentication key |

### Qdrant

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `QDRANT_URL` | Conditional | — | Qdrant instance URL |
| `QDRANT_API_KEY` | No | — | Qdrant API key |

**Examples:**
```bash
# FAISS (development / small scale)
VECTOR_STORE_TYPE=faiss
FAISS_INDEX_PATH=/app/data/faiss_indexes

# Pinecone (production / large scale)
VECTOR_STORE_TYPE=pinecone
PINECONE_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PINECONE_ENV=us-east-1-aws
PINECONE_INDEX=verbaflow-prod
```

---

## 7. File Storage

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `STORAGE_BACKEND` | No | `local` | Storage backend. Options: `local`, `s3`, `gcs` |
| `UPLOAD_DIR` | No | `./data/uploads` | Local filesystem directory for uploads. Must be persistent |
| `MAX_FILE_SIZE_MB` | No | `50` | Maximum allowed upload file size in megabytes |
| `ALLOWED_EXTENSIONS` | No | `pdf,docx,...` | Comma-separated list of allowed file extensions |

### AWS S3

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `AWS_ACCESS_KEY_ID` | Conditional | — | AWS IAM access key. Use IAM roles in production instead |
| `AWS_SECRET_ACCESS_KEY` | Conditional | — | AWS IAM secret key |
| `AWS_REGION` | No | `us-east-1` | AWS region for S3 bucket |
| `S3_BUCKET_NAME` | Conditional | — | S3 bucket name for document uploads |

### Google Cloud Storage

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `GCS_BUCKET_NAME` | Conditional | — | GCS bucket name |
| `GCS_PROJECT_ID` | Conditional | — | GCP project ID |

**Security note:**
- In Kubernetes, use IAM roles/Workload Identity instead of access keys
- Set bucket versioning enabled for accidental deletion recovery
- Enable server-side encryption (SSE-KMS for S3)

**Examples:**
```bash
# Local storage (development)
STORAGE_BACKEND=local
UPLOAD_DIR=/app/data/uploads
MAX_FILE_SIZE_MB=50

# S3 storage (production)
STORAGE_BACKEND=s3
AWS_REGION=us-east-1
S3_BUCKET_NAME=verbaflow-uploads-prod
# Do NOT set AWS_ACCESS_KEY_ID in K8s — use Workload Identity / IAM roles
```

---

## 8. RAG Pipeline

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `CHUNK_SIZE` | No | `1000` | Target token count per text chunk during document splitting |
| `CHUNK_OVERLAP` | No | `200` | Overlapping tokens between adjacent chunks for context continuity |
| `RETRIEVAL_COUNT` | No | `5` | Number of top-K chunks retrieved per query |
| `SIMILARITY_THRESHOLD` | No | `0.7` | Minimum cosine similarity score for a chunk to be included in context |
| `RERANKING_ENABLED` | No | `false` | Enable cross-encoder re-ranking of retrieved chunks |
| `RERANKER_MODEL` | No | `cross-encoder/ms-marco-MiniLM-L-6-v2` | Hugging Face model ID for re-ranking |
| `MAX_CONTEXT_LENGTH` | No | `12000` | Maximum total token length of context passed to LLM |
| `CITATION_ENABLED` | No | `true` | Include document citations in LLM responses |

**Tuning guidelines:**

| Scenario | Chunk Size | Retrieval Count | Notes |
|----------|-----------|----------------|-------|
| Legal documents | 800 | 8 | Smaller chunks for precise retrieval |
| Technical manuals | 1200 | 5 | Default settings work well |
| Short-form content | 500 | 10 | More chunks needed to cover content |
| Code repositories | 600 | 8 | Smaller chunks for code accuracy |

**Examples:**
```bash
CHUNK_SIZE=1000
CHUNK_OVERLAP=200
RETRIEVAL_COUNT=5
SIMILARITY_THRESHOLD=0.7
RERANKING_ENABLED=false
MAX_CONTEXT_LENGTH=12000
CITATION_ENABLED=true
```

---

## 9. CORS

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `ALLOWED_ORIGINS` | No | `["http://localhost:3000"]` | JSON array of allowed CORS origins |
| `ALLOW_CREDENTIALS` | No | `true` | Allow cookies in cross-origin requests |
| `ALLOWED_METHODS` | No | `["GET","POST","PUT","DELETE","PATCH","OPTIONS"]` | Allowed HTTP methods |
| `ALLOWED_HEADERS` | No | `["*"]` | Allowed request headers |

**Security note:** Never use `["*"]` as `ALLOWED_ORIGINS` in production. Always list specific domains.

**Examples:**
```bash
# Development
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:3001"]

# Production
ALLOWED_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]
ALLOW_CREDENTIALS=true
```

---

## 10. Frontend (Next.js)

> Variables prefixed with `NEXT_PUBLIC_` are **baked into the browser bundle at build time**. They are visible to end users.

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | `http://localhost:8000` | Backend API base URL (must be reachable from user browsers) |
| `NEXT_PUBLIC_WS_URL` | ✅ | `ws://localhost:8000` | WebSocket URL for real-time chat |
| `NEXT_PUBLIC_APP_NAME` | No | `VerbaFlow AI` | Application name displayed in the UI |
| `NEXT_PUBLIC_APP_VERSION` | No | `1.0.0` | App version shown in UI footer |
| `NEXT_PUBLIC_SENTRY_DSN` | No | — | Sentry DSN for frontend error tracking |
| `NEXT_TELEMETRY_DISABLED` | No | `1` | Set to `1` to disable Next.js telemetry |

**Security note:** Never put secrets or API keys in `NEXT_PUBLIC_*` variables — they are publicly exposed.

**Examples:**
```bash
# Development
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000

# Production
NEXT_PUBLIC_API_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
NEXT_PUBLIC_APP_NAME=VerbaFlow AI
NEXT_TELEMETRY_DISABLED=1
```

---

## 11. Monitoring & Observability

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `SENTRY_DSN` | No | — | Sentry Data Source Name for backend error tracking |
| `SENTRY_ENVIRONMENT` | No | `production` | Sentry environment tag |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | No | — | OpenTelemetry collector OTLP gRPC endpoint |
| `OTEL_SERVICE_NAME` | No | `verbaflow-backend` | Service name in distributed traces |
| `PROMETHEUS_ENABLED` | No | `true` | Expose Prometheus metrics at `/metrics` |
| `PROMETHEUS_PORT` | No | `9090` | Prometheus metrics port |

**Examples:**
```bash
SENTRY_DSN=https://xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx@o000000.ingest.sentry.io/0000000
SENTRY_ENVIRONMENT=production
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318
OTEL_SERVICE_NAME=verbaflow-backend
PROMETHEUS_ENABLED=true
PROMETHEUS_PORT=9090
```

---

## 12. Email / SMTP

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `SMTP_HOST` | No | — | SMTP server hostname (e.g., `smtp.sendgrid.net`, `smtp.gmail.com`) |
| `SMTP_PORT` | No | `587` | SMTP port. 587 (STARTTLS), 465 (SSL), 25 (unencrypted — not recommended) |
| `SMTP_USER` | No | — | SMTP authentication username |
| `SMTP_PASSWORD` | No | — | SMTP authentication password or API key |
| `EMAIL_FROM` | No | — | From address for system emails |
| `EMAIL_FROM_NAME` | No | `VerbaFlow AI` | Display name in the From field |

**Examples:**
```bash
# SendGrid
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=VerbaFlow AI

# Gmail (dev only — use OAuth2 or dedicated sender in production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## 13. Rate Limiting

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `RATE_LIMIT_ENABLED` | No | `true` | Enable Redis-backed rate limiting |
| `RATE_LIMIT_REQUESTS_PER_MINUTE` | No | `60` | Default requests per minute per authenticated user |
| `RATE_LIMIT_BURST` | No | `20` | Additional burst allowance above the rate limit |

**Examples:**
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
RATE_LIMIT_BURST=20
```

---

## 14. pgAdmin (Dev Only)

> These variables are only needed if you enable the pgAdmin service in `docker-compose.yml`. They have no effect on production deployments.

| Variable | Required | Default | Description |
|----------|---------|---------|-------------|
| `PGADMIN_DEFAULT_EMAIL` | No | `admin@verbaflow.local` | Login email for pgAdmin UI |
| `PGADMIN_DEFAULT_PASSWORD` | No | — | Login password for pgAdmin UI |
| `PGADMIN_LISTEN_PORT` | No | `5050` | Port pgAdmin listens on inside the container |

**Examples:**
```bash
PGADMIN_DEFAULT_EMAIL=admin@verbaflow.local
PGADMIN_DEFAULT_PASSWORD=admin_dev_password
PGADMIN_LISTEN_PORT=5050
```

---

## Quick Reference

### Minimum required for development

```bash
# .env (minimum viable development setup)
POSTGRES_PASSWORD=devpassword123
SECRET_KEY=$(openssl rand -hex 32)
GEMINI_API_KEY=your_gemini_api_key
```

### Minimum required for production

```bash
# Production essentials — all others should use defaults or be tuned
POSTGRES_DB=verbaflow
POSTGRES_USER=verbaflow
POSTGRES_PASSWORD=<strong_random_password>
DATABASE_URL=postgresql+asyncpg://verbaflow:<password>@<host>:5432/verbaflow
REDIS_URL=redis://:<redis_password>@<host>:6379/0
SECRET_KEY=<openssl_rand_hex_32>
GEMINI_API_KEY=<your_key>
ALLOWED_ORIGINS=["https://yourdomain.com"]
NEXT_PUBLIC_API_URL=https://yourdomain.com
NEXT_PUBLIC_WS_URL=wss://yourdomain.com
SENTRY_DSN=<your_sentry_dsn>
STORAGE_BACKEND=s3
S3_BUCKET_NAME=<your_bucket>
```

---

## Security Best Practices Summary

| Practice | Reason |
|---------|--------|
| Use `openssl rand -hex 32` for `SECRET_KEY` | Cryptographically random, sufficient entropy |
| Never commit `.env` to git | Prevents accidental secret exposure |
| Use cloud secret manager in production | Centralized rotation, audit trail, access control |
| Set `DEBUG=false` in production | Prevents stacktrace exposure |
| Use different secrets per environment | Limits blast radius of a single key compromise |
| Rotate secrets annually or on compromise | Minimizes window of exposure |
| Use IAM roles instead of access keys | No long-lived credentials in environment |
| Set billing alerts on AI API keys | Prevents surprise charges from key abuse |
