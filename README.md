# VerbaFlow AI 🚀
### Enterprise-Grade Multi-Document RAG & Chat Intelligence Platform

[![CI](https://github.com/your-org/verbaflow-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/verbaflow-ai/actions/workflows/ci.yml)
[![CD](https://github.com/your-org/verbaflow-ai/actions/workflows/cd.yml/badge.svg)](https://github.com/your-org/verbaflow-ai/actions/workflows/cd.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-ready-326CE5?logo=kubernetes&logoColor=white)](https://kubernetes.io)

**VerbaFlow AI** is a production-ready, highly optimized **Multi-Document Retrieval-Augmented Generation (RAG)** platform designed for enterprise environments. It provides isolated multi-tenant workspaces where teams can ingest high volumes of documents (PDFs, Docx, spreadsheets, and more), process them through an advanced hybrid search pipeline, and query them via real-time SSE (Server-Sent Events) streaming with inline citations and full developer telemetry diagnostics.

---

## 🏗️ Architectural Blueprint

```
                     ┌──────────────────────────────────────────────────────────┐
                     │              VerbaFlow AI Web Application                │
                     └──────────────────────────────────────────────────────────┘
                                                   │
                          ┌────────────────────────┴────────────────────────┐
                          ▼                                                 ▼
             ┌─────────────────────────┐                       ┌─────────────────────────┐
             │    Next.js Frontend     │                       │     FastAPI Backend     │
             │   (React 18 / TS)       │       REST / SSE      │    (Python 3.12 async)  │
             │  • Port 3000            ├──────────────────────►│   • Port 8000           │
             │  • Tailwind CSS         │      WebSockets       │   • Uvicorn ASGI Server │
             └─────────────────────────┘                       └────────────+────────────┘
                                                                            │
                                         ┌──────────────────────────────────+──────────────────────────────────┐
                                         ▼                                  ▼                                  ▼
                            ┌─────────────────────────┐        ┌─────────────────────────┐        ┌─────────────────────────┐
                            │      PostgreSQL 16      │        │         Redis 7         │        │    Vector Database      │
                            │  • Multi-tenant DB      │        │  • Sliding Rate Limits  │        │  • Per-KB FAISS Indices │
                            │  • User Profiles & RBAC │        │  • Token cache store    │        │  • Pinecone (Optional)  │
                            │  • Diagnostic Audit Logs│        │  • Ingestion worker queue│       └─────────────────────────┘
                            └─────────────────────────┘        └─────────────────────────┘
```

---

## 🧠 Advanced Core Engineering & Features

This platform is built using enterprise software design patterns. Here are the core engineering solutions implemented:

### 1. Advanced Hybrid Search & RAG Orchestration
* **Dual Retrieval Engine**: Combines **dense vector search** (FAISS FlatIP vector indices, capturing semantic meaning) with **sparse lexical retrieval** (BM25Okapi, catching exact keywords, codes, and IDs) to achieve high recall and precision.
* **Reciprocal Rank Fusion (RRF)**: Merges sparse and dense search results using an algebraic rank-fusion scorer ($RRF\_Score = \sum_{m \in M} \frac{1}{k + r_m(d)}$) to generate the optimal context set.
* **Smart Context Optimization**: Filters retrieved chunks based on strict cosine similarity thresholds, dynamically compresses prompts to respect LLM token constraints, and appends structured inline citations (mapping page numbers, sources, and similarity scores) to all responses.
* **SSE Token Streaming**: Deliver real-time answers utilizing async HTTP generators via Server-Sent Events (SSE) directly to the user bubble.

### 2. High-Throughput 10-Step Ingestion Pipeline
* **Asynchronous processing**: Large document ingestion is decoupled from the request cycle using background workers powered by Redis queues.
* **Parallel processing**: Implements parallel batch uploads in the frontend, sending document-level ingestion events to the client via a persistent `EventSource` connection.
* **Dynamic Backoffs & Quota Protection**: Integrates Tenacity retries and regular-expression based rate-limit parsing (reading Google's `retry_delay` seconds directly from 429 quota errors) to safely resume operations without failing jobs.
* **Thread-Safe Vector Locks**: Synchronizes document additions, deletions, and updates to the FAISS and BM25 index stores using a per-Knowledge-Base **async lock registry** to prevent index corruption.
* **Stuck Job Recovery Loop**: A lightweight background cleaner executes every 30 seconds to recover files stuck in processing states beyond 300 seconds, transitioning them to `FAILED` and logging detailed telemetry contexts.

### 3. Enterprise Security & Isolation
* **Row-Level Tenant Isolation**: All queries, collections, chats, and files are scoped using dynamic Organization Tenant IDs.
* **JWT Session Rotation**: Employs secure cryptographic access tokens (short lifespan) and refresh tokens (long lifespan, stored in localStorage) to authenticate sessions.
* **Role-Based Access Control (RBAC)**: Fine-grained user role permissions (`ORG_ADMIN`, `MANAGER`, `EMPLOYEE`, `VIEWER`) restrict administrative dashboards and settings adjustments.

### 4. Telemetry, Metrics & Observability
* **Performance Telemetry Logging**: Stores queried token volumes, vector search durations, LLM response latencies, and token costs in JSON diagnostics fields in the database.
* **Developer Diagnostics Panel**: A collapsible panel on each assistant message displays detailed vector metrics, similarity matches, and traceback trace logs directly in the UI.
* **Prometheus Metrics**: Exposes custom application metrics at the `/metrics` endpoint, ready for ingestion into Prometheus and visualization in Grafana.

---

## 🛠️ Tech Stack & Dependencies

### Backend (API & RAG)
* **FastAPI**: Async ASGI web framework.
* **SQLAlchemy 2.0**: Modern async ORM mappings.
* **Alembic**: Database schema migrations.
* **FAISS**: High-dimensional vector similarity search.
* **pypdf / python-docx**: Document parsers.
* **httpx**: Async HTTP client for external LLM API calls.
* **jose / bcrypt**: JWT token operations and password hashing.

### Frontend (User Interface)
* **Next.js 14**: Standalone production build configuration.
* **TypeScript**: Strict compile-time type safety.
* **Tailwind CSS**: Dark/light theme variable styling.
* **Zustand**: Lightweight client state management.
* **Framer Motion**: Interactive UI micro-animations.
* **Lucide React**: Vector dashboard icons.

### Infrastructure & DevOps
* **Docker & Compose**: Local container runtime.
* **Kubernetes (1.28+)**: Production deployments with Horizontal Pod Autoscalers (HPA), StatefulSets, ConfigMaps, and Ingress rules.
* **Prometheus & Grafana**: Live server monitoring.
* **GitHub Actions**: Continuous integration (eslint, pytest, black, mypy) and deployments.

---

## 🚀 Local Development Quick Start

### 1. Clone & Set Environment
```bash
git clone https://github.com/your-org/verbaflow-ai.git
cd verbaflow-ai
cp .env.example .env
```
Open `.env` and configure your API key and secrets:
```env
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=generate_with_openssl_rand_hex_32
```

### 2. Start Services
Launch PostgreSQL, Redis, backend, and frontend containers:
```bash
docker compose up -d --build
```

### 3. Verify Deployments
* **Frontend UI**: http://localhost:3000
* **API Documentation**: http://localhost:8000/docs
* **Health Endpoint**: http://localhost:8000/health

### 4. Run Tests
Verify compile constraints and execution safety:
```bash
docker compose exec backend pytest
```

---

## 📂 Project Structure

```
verbaflow-ai/
├── backend/                    # FastAPI ASGI Python backend
│   ├── app/
│   │   ├── api/               # Router endpoints (v1/)
│   │   ├── core/              # Security, settings, config
│   │   ├── models/            # SQLAlchemy database entities
│   │   ├── repositories/      # Database abstraction layers
│   │   ├── schemas/           # Pydantic validation schemas
│   │   └── services/          # RAG, LLM, ingestion pipelines
│   ├── tests/                 # Unit and E2E integration test suite
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                   # Next.js 14 React frontend
│   ├── app/                   # App Router pages and layouts
│   ├── components/            # Reusable UI widgets and layout modules
│   ├── lib/                   # API clients and Zustand stores
│   ├── Dockerfile
│   └── package.json
│
├── k8s/                       # Production Kubernetes manifests
│   ├── postgres-statefulset.yaml
│   ├── backend-deployment.yaml
│   ├── frontend-deployment.yaml
│   └── monitoring/            # Grafana/Prometheus dashboard mappings
│
├── docker-compose.yml         # Container orchestrator configuration
├── .env.example               # Template environment configuration
└── LICENSE                    # Project license
```

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
