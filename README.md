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

## Tech Stack

### Frontend

* Next.js 14
* TypeScript
* React
* Tailwind CSS
* Zustand

### Backend

* FastAPI
* SQLAlchemy 2.0
* Uvicorn

### Database

* PostgreSQL 16

### Caching

* Redis 7

### AI & Retrieval

* Gemini AI
* FAISS Vector Database
* BM25 Search
* Reciprocal Rank Fusion (RRF)

### DevOps

* Docker
* Docker Compose
* Kubernetes

---

## ✨ Core Features

### Knowledge Base Management

* Upload PDF, DOCX, TXT files
* Multi-document indexing
* Metadata management
* Document deletion and updates

### AI Chat Interface

* Context-aware responses
* Source-grounded answers
* Conversational memory
* Natural language querying

### Hybrid Search Engine

* Dense vector retrieval
* Sparse lexical retrieval
* Reciprocal Rank Fusion ranking
* Improved retrieval accuracy

### Security & Administration

* Role-based access control
* Multi-tenant support
* Audit logging
* Rate limiting

---

## Application Screenshots

### Login Page
<img width="1470" height="873" alt="Login Page" src="https://github.com/user-attachments/assets/e0c3550a-5fcd-4192-85ba-d17ef245c79d" />

### knowledge Base
<img width="1470" height="876" alt="Knowledge Base " src="https://github.com/user-attachments/assets/d7ae2997-bb27-499d-b459-a8cd9efe7f46" />

### Ingestion Pipeline Process
<img width="1470" height="878" alt="Ingestion Pipeline Process" src="https://github.com/user-attachments/assets/b2c17c96-9471-4ece-b3ac-2f9f050c9b93" />

### Document upload in Knowledge Base
<img width="1470" height="882" alt="Document upload in Knowledge Base" src="https://github.com/user-attachments/assets/8ca4fb00-faba-470d-83a8-e9a21ca273fe" />

### Chat Interface 1
<img width="1470" height="882" alt="Chat Interfce 1 " src="https://github.com/user-attachments/assets/d789124a-2597-4205-b172-211ffa706a89" />

### Chat Interface 2
<img width="1470" height="884" alt="Chat Interface 2 " src="https://github.com/user-attachments/assets/04aa0527-1c20-4329-b278-798a06542fcf" />

### Analytics Page
<img width="1470" height="886" alt="Analytics Page" src="https://github.com/user-attachments/assets/1d722d45-fe8b-4bdb-8c24-8180cc902837" />

### Screenshots
<img width="1470" height="886" alt="Screenshot 2026-06-14 at 3 08 56 PM" src="https://github.com/user-attachments/assets/d0d2bcab-d776-454d-9878-9f4d17b622b5" />
<img width="1470" height="882" alt="Screenshot 2026-06-14 at 3 08 48 PM" src="https://github.com/user-attachments/assets/0bae26a2-09d3-4d67-802c-8eda4a7fb642" />

---

## Key Engineering Achievements

* Implemented enterprise-grade RAG architecture
* Designed hybrid retrieval pipeline combining FAISS and BM25
* Built scalable FastAPI backend with asynchronous processing
* Developed responsive and modern Next.js UI
* Integrated Gemini AI for contextual answer generation
* Containerized application using Docker for easy deployment

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
