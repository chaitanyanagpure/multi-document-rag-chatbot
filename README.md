# Enterprise Multi-Document RAG Chatbot

An enterprise-grade AI-powered Retrieval-Augmented Generation (RAG) platform that enables users to upload, manage, and query multiple documents through an intelligent conversational interface.

Built using Next.js, FastAPI, PostgreSQL, Redis, FAISS, and Gemini AI, the platform combines semantic vector search and lexical retrieval to provide highly accurate, context-aware responses from uploaded knowledge bases.

---

## Project Highlights

* Multi-document Knowledge Base Management
* AI-powered Conversational Search
* Hybrid Retrieval (FAISS + BM25)
* Role-Based Access Control (RBAC)
* Multi-Tenant Architecture
* FastAPI Backend with Async Processing
* Modern Next.js 14 Frontend
* Redis Caching & Rate Limiting
* Docker & Kubernetes Ready
* Enterprise Dashboard UI

---

## Problem Statement

Organizations often struggle to efficiently retrieve information from large collections of documents.

Traditional keyword search systems fail to understand context and semantics.

This project solves the problem by combining:

* Semantic Vector Search (FAISS)
* Lexical Search (BM25)
* Hybrid Retrieval Pipeline (RRF)
* Large Language Models (Gemini AI)

to deliver accurate answers grounded in organizational knowledge.

---

## System Architecture

```text
User
 │
 ▼
Next.js Frontend
 │
 ▼
FastAPI Backend
 │
 ├── Authentication & RBAC
 ├── Knowledge Base Management
 ├── Chat Service
 └── Retrieval Engine
          │
          ├── FAISS Vector Search
          ├── BM25 Lexical Search
          └── RRF Fusion
                    │
                    ▼
               Gemini AI
                    │
                    ▼
               Final Response

Database Layer
 ├── PostgreSQL
 └── Redis Cache
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

## Local Setup

### Clone Repository

```bash
git clone https://github.com/chaitanyanagpure/multi-document-rag-chatbot.git
```

### Backend Setup

```bash
cd backend

python -m venv venv

source venv/bin/activate

pip install -r requirements.txt
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

### Run Using Docker

```bash
docker-compose up --build
```

---

## Future Enhancements

* Multi-Agent AI Collaboration
* Voice-Based Interaction
* OCR Support for Scanned PDFs
* Real-Time Streaming Responses
* Advanced Analytics Dashboard
* Citation-Based Responses
* Cloud Deployment Automation

---

## Author

### Chaitanya Nagpure

AI/ML Engineer | Full Stack Developer | Generative AI Enthusiast

GitHub:
https://github.com/chaitanyanagpure

LinkedIn:
https://www.linkedin.com/in/chaitanyanagpure?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app

---

## Why This Project Matters

This project demonstrates expertise in:

* Retrieval-Augmented Generation (RAG)
* Generative AI Applications
* Vector Databases
* Full Stack Development
* Backend System Design
* AI Product Engineering
* Enterprise Software Architecture

The solution reflects real-world enterprise AI workflows and showcases practical implementation of modern LLM-powered applications.
