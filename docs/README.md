# VerbaFlow AI 🚀
### Your Enterprise Knowledge Intelligence Platform

[![CI](https://github.com/your-org/verbaflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/verbaflow-ai/actions/workflows/ci.yml)
[![CD](https://github.com/your-org/verbaflow-ai/actions/workflows/cd.yml/badge.svg)](https://github.com/your-org/verbaflow-ai/actions/workflows/cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/your-org/verbaflow-ai/releases)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker)](https://ghcr.io/your-org/verbaflow-ai)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi)](https://fastapi.tiangolo.com)

---

**VerbaFlow AI** is a production-ready, enterprise-grade **Multi-Document RAG (Retrieval-Augmented Generation) Chatbot Platform**. It enables organisations to securely ingest, index, and query their private document corpora using state-of-the-art language models — all within their own infrastructure.

> 💡 Upload PDFs, Word docs, spreadsheets, and more. Ask questions in natural language. Get cited, accurate answers grounded in your documents.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VerbaFlow AI — Architecture                      │
└─────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐    HTTPS/WSS     ┌──────────────────────────────────────┐
  │  Browser │ ◄──────────────► │          NGINX Ingress / LB           │
  │  (User)  │                  │   TLS Termination · Rate Limiting     │
  └──────────┘                  └───────────┬──────────────┬────────────┘
                                            │              │
                           ┌────────────────▼──┐    ┌──────▼──────────────┐
                           │   Next.js 14 SSR  │    │   FastAPI Backend   │
                           │   Frontend        │    │   (Uvicorn + async) │
                           │   Port 3000       │    │   Port 8000         │
                           └───────────────────┘    └──────┬──────────────┘
                                                           │
                              ┌────────────────────────────┼────────────────────┐
                              │                            │                    │
                    ┌─────────▼──────┐          ┌──────────▼──────┐   ┌────────▼────────┐
                    │  PostgreSQL 16 │          │   Redis 7        │   │  Vector Store   │
                    │  (Users, Docs, │          │  (Cache, Rate   │   │  FAISS / Pine-  │
                    │   Metadata,    │          │   Limit, Queue) │   │  cone / Qdrant  │
                    │   Audit Log)   │          └─────────────────┘   └─────────────────┘
                    └────────────────┘
                                                           │
                              ┌────────────────────────────┼────────────────────┐
                              │                            │                    │
                    ┌─────────▼──────┐          ┌──────────▼──────┐   ┌────────▼────────┐
                    │  Google Gemini │          │   OpenAI GPT-4o  │   │  File Storage   │
                    │  (LLM + Embed) │          │   (Fallback LLM) │   │  Local / S3 /   │
                    │  Gemini 1.5 Pro│          └─────────────────┘   │  GCS            │
                    └────────────────┘                                 └─────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                     Observability Stack                              │
  │   Prometheus ── Grafana ── Sentry ── OpenTelemetry ── Alertmanager  │
  └─────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────────┐
  │                     CI/CD Pipeline                                   │
  │   GitHub Actions ── GHCR ── GKE/EKS/AKS ── Slack Notifications     │
  └─────────────────────────────────────────────────────────────────────┘
```

### RAG Pipeline Flow

```
  Document Upload
        │
        ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │   Parser    │────►│   Chunker   │────►│  Embedder   │
  │ PDF/DOCX/   │     │ Size: 1000  │     │ Google Emb  │
  │ TXT/CSV...  │     │ Overlap:200 │     │ text-004    │
  └─────────────┘     └─────────────┘     └──────┬──────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  Vector Store │
                                          │  FAISS Index  │
                                          └───────────────┘

  User Query
        │
        ▼
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │   Embed     │────►│   Retrieve  │────►│  Re-rank    │
  │   Query     │     │ Top-K docs  │     │ (optional)  │
  │             │     │ by cosine   │     │ cross-enc.  │
  └─────────────┘     └─────────────┘     └──────┬──────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  LLM (Gemini) │
                                          │  + Context    │
                                          │  + Citations  │
                                          └───────┬───────┘
                                                  │
                                          ┌───────▼───────┐
                                          │  Streamed SSE │
                                          │  Response     │
                                          └───────────────┘
```

---

## ✨ Features

### 🧠 AI & RAG
- **Multi-Model Support** — Google Gemini 1.5 Pro, GPT-4o, and extensible to any LLM
- **Smart Chunking** — Configurable chunk size & overlap with semantic splitting
- **Hybrid Search** — Dense + sparse retrieval for maximum recall
- **Citation Engine** — Every answer is grounded with document citations & page references
- **Re-ranking** — Optional cross-encoder re-ranking for precision boost
- **Streaming Responses** — SSE streaming for real-time token delivery
- **WebSocket Chat** — Persistent bi-directional communication for live sessions
- **Multi-Collection** — Organize documents into isolated knowledge collections
- **Context Window Management** — Smart context pruning for large document sets

### 📄 Document Processing
- **20+ File Formats** — PDF, DOCX, XLSX, PPTX, TXT, MD, CSV, HTML, and more
- **Batch Upload** — Upload multiple documents simultaneously
- **Processing Queue** — Async background processing with Redis queue
- **OCR Support** — Extract text from scanned PDFs and images
- **Metadata Extraction** — Auto-extract titles, authors, dates, and custom tags
- **Version Control** — Track document versions and re-index on update

### 🔐 Security & Multi-tenancy
- **JWT Authentication** — Access + refresh token with automatic rotation
- **Role-Based Access Control** — Admin, Manager, User, Viewer roles
- **Multi-tenant Isolation** — Full data isolation per organisation
- **Collection-level Permissions** — Fine-grained document access control
- **Audit Logging** — Complete audit trail for all data access events
- **Rate Limiting** — Per-user and per-IP rate limiting via Redis

### 🏗️ Infrastructure
- **Docker Compose** — One-command local development environment
- **Kubernetes-ready** — Full K8s manifests with HPA, PDB, anti-affinity
- **Multi-cloud** — Deploy to GKE, EKS, or AKS
- **Auto-scaling** — HPA scales backend 3→20 pods, frontend 2→10 pods
- **Zero-downtime Deploys** — Rolling updates with readiness gates
- **Health Checks** — Comprehensive liveness, readiness, and startup probes

### 📊 Observability
- **Prometheus Metrics** — Custom application metrics exposed at `/metrics`
- **Grafana Dashboard** — Pre-built dashboard with 20+ panels
- **Sentry Error Tracking** — Automatic error capture with context
- **OpenTelemetry** — Distributed tracing across all services
- **Structured Logging** — JSON-formatted logs with correlation IDs
- **Alert Rules** — Pre-configured Prometheus alerts for SLO violations

---

## 🚀 Quick Start

### Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Local orchestration |
| Git | 2.40+ | Version control |
| (Optional) kubectl | 1.28+ | Kubernetes deployment |

### 1. Clone the repository

```bash
git clone https://github.com/your-org/verbaflow-ai.git
cd verbaflow-ai
```

### 2. Configure environment

```bash
cp .env.example .env
nano .env   # Fill in your API keys and passwords
```

**Minimum required variables:**
```bash
POSTGRES_PASSWORD=your_secure_password
SECRET_KEY=$(openssl rand -hex 32)
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Launch with Docker Compose

```bash
docker compose up -d
```

This will start:
- **PostgreSQL 16** on port 5432
- **Redis 7** on port 6379
- **FastAPI Backend** on [http://localhost:8000](http://localhost:8000)
- **Next.js Frontend** on [http://localhost:3000](http://localhost:3000)

### 4. Run database migrations

```bash
docker compose exec backend alembic upgrade head
```

### 5. Create your first admin user

```bash
docker compose exec backend python -m app.cli create-admin \
  --email admin@example.com \
  --password your_password
```

### 6. Open the app

Navigate to [http://localhost:3000](http://localhost:3000) and start uploading documents!

---

## 🔌 API Quick Reference

The full API documentation is available at:
- **Interactive Docs (Swagger)**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **API Guide**: [docs/API.md](API.md)

```bash
# Authenticate
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your_password"}'

# Upload a document
curl -X POST http://localhost:8000/api/v1/documents \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@./my-document.pdf" \
  -F "collection_id=your_collection_id"

# Ask a question
curl -X POST http://localhost:8000/api/v1/chat/query \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is the refund policy?","collection_id":"your_collection_id"}'
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment guide (GKE, EKS, AKS) |
| [API.md](API.md) | Complete REST API and WebSocket reference |
| [SECURITY.md](SECURITY.md) | Security architecture and compliance notes |
| [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) | All environment variables documented |

---

## 🛠️ Tech Stack

### Backend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Python | 3.12 | Runtime |
| FastAPI | 0.110+ | Web framework + async |
| SQLAlchemy | 2.0 | ORM (async) |
| Alembic | 1.13+ | Database migrations |
| Uvicorn | 0.27+ | ASGI server |
| Pydantic | 2.6+ | Data validation |
| LangChain | 0.1+ | LLM orchestration |
| FAISS | 1.7+ | Vector similarity search |
| Redis | 5.0+ (py) | Caching & rate limiting |
| asyncpg | 0.29+ | Async PostgreSQL driver |
| PyJWT | 2.8+ | JWT authentication |
| passlib | 1.7+ | Password hashing |
| python-multipart | 0.0.9+ | File upload handling |
| pypdf | 4.0+ | PDF parsing |
| python-docx | 1.1+ | DOCX parsing |

### Frontend
| Technology | Version | Purpose |
|-----------|---------|---------|
| Next.js | 14 | React SSR framework |
| React | 18 | UI library |
| TypeScript | 5 | Type safety |
| Tailwind CSS | 3 | Utility-first styling |
| shadcn/ui | Latest | Component library |
| Zustand | 4 | State management |
| React Query | 5 | Server state & caching |
| React Hook Form | 7 | Form management |
| Zod | 3 | Schema validation |
| Lucide React | Latest | Icons |

### Infrastructure
| Technology | Purpose |
|-----------|---------|
| PostgreSQL 16 | Relational data store |
| Redis 7 | Cache + rate limiting + queue |
| Docker + Compose | Local development |
| Kubernetes 1.28+ | Production orchestration |
| NGINX Ingress | TLS termination + routing |
| cert-manager | Automatic TLS certificates |
| GitHub Actions | CI/CD pipeline |
| Prometheus + Grafana | Metrics and dashboards |
| Sentry | Error tracking |

---

## 🏗️ Project Structure

```
verbaflow-ai/
├── backend/                    # FastAPI Python backend
│   ├── app/
│   │   ├── api/               # Route handlers (v1/)
│   │   │   ├── auth.py
│   │   │   ├── chat.py
│   │   │   ├── collections.py
│   │   │   ├── documents.py
│   │   │   └── health.py
│   │   ├── core/              # Config, security, deps
│   │   ├── db/                # SQLAlchemy models + sessions
│   │   ├── rag/               # RAG pipeline components
│   │   │   ├── chunker.py
│   │   │   ├── embedder.py
│   │   │   ├── parser.py
│   │   │   ├── retriever.py
│   │   │   └── generator.py
│   │   ├── services/          # Business logic
│   │   └── main.py
│   ├── alembic/               # Database migrations
│   ├── tests/                 # pytest test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Next.js 14 frontend
│   ├── app/                   # App router pages
│   ├── components/            # Reusable components
│   ├── lib/                   # Utilities + API client
│   ├── public/                # Static assets
│   ├── Dockerfile
│   └── package.json
│
├── k8s/                       # Kubernetes manifests
│   ├── namespace.yaml
│   ├── configmap.yaml
│   ├── secrets.yaml
│   ├── postgres-statefulset.yaml
│   ├── redis-deployment.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   ├── ingress.yaml
│   └── monitoring/
│       ├── prometheus-config.yaml
│       └── grafana-dashboard.json
│
├── .github/
│   └── workflows/
│       ├── ci.yml             # Lint, test, build
│       └── cd.yml             # Deploy to K8s
│
├── docs/
│   ├── README.md              # This file
│   ├── DEPLOYMENT.md          # Production deployment guide
│   ├── API.md                 # API reference
│   ├── SECURITY.md            # Security documentation
│   └── ENVIRONMENT_VARIABLES.md
│
├── docker-compose.yml
├── .env.example
└── LICENSE
```

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

We follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## 📸 Screenshots

> *Add screenshots of your deployed application here*

| Feature | Screenshot |
|---------|-----------|
| Chat Interface | *(coming soon)* |
| Document Upload | *(coming soon)* |
| Collection Management | *(coming soon)* |
| Admin Dashboard | *(coming soon)* |

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](../LICENSE) file for details.

---

## 🙏 Acknowledgements

- [LangChain](https://github.com/langchain-ai/langchain) — LLM orchestration framework
- [FAISS](https://github.com/facebookresearch/faiss) — Facebook AI Similarity Search
- [FastAPI](https://fastapi.tiangolo.com/) — Modern Python web framework
- [Next.js](https://nextjs.org/) — React production framework
- [shadcn/ui](https://ui.shadcn.com/) — Beautiful, accessible React components

---

<div align="center">
  <strong>Built with ❤️ by the VerbaFlow AI Team</strong><br>
  <a href="https://github.com/your-org/verbaflow-ai/issues">Report Bug</a> ·
  <a href="https://github.com/your-org/verbaflow-ai/discussions">Request Feature</a> ·
  <a href="https://yourdomain.com">Live Demo</a>
</div>
