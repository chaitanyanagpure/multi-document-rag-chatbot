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

<img width="1024" height="1024" alt="system_architecture" src="https://github.com/user-attachments/assets/212dc651-481b-47fe-ab3f-f2503a333e0c" />

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

## Core Features

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
<img width="1470" height="873" alt="Login Page" src="https://github.com/user-attachments/assets/4a048db3-f355-46e4-bd5c-75411687f233" />

### Knowledge Base 
<img width="1470" height="876" alt="Knowledge Base " src="https://github.com/user-attachments/assets/13037d6d-12d0-4625-a9c7-103c8ec05dd3" />

### Ingestion Pipeline Process
<img width="1470" height="878" alt="Ingestion Pipeline Process" src="https://github.com/user-attachments/assets/54ef30b2-e895-4bfa-abc6-f980e97ff3a3" />

### Document upload in Knowledge Base
<img width="1470" height="882" alt="Document upload in Knowledge Base" src="https://github.com/user-attachments/assets/3691593a-da91-4e9d-849a-0d2158d11792" />

### Chat Interface 1
<img width="1470" height="882" alt="Chat Interfce 1 " src="https://github.com/user-attachments/assets/07dabc60-a019-4f30-bdc4-04002d092a09" />

### Chat Interface 2
<img width="1470" height="884" alt="Chat Interface 2 " src="https://github.com/user-attachments/assets/3436cbd8-5416-45cb-b72a-290507d4c288" />

### Analytics Page
<img width="1470" height="886" alt="Analytics Page" src="https://github.com/user-attachments/assets/5da31346-c3bf-46cd-96ef-bd8bb0f98021" />

### Screenshots
<img width="1470" height="886" alt="Screenshot 2026-06-14 at 3 08 56 PM" src="https://github.com/user-attachments/assets/c265d44e-65f0-4d4b-97c5-e215443ad8a0" />
<img width="1470" height="882" alt="Screenshot 2026-06-14 at 3 08 48 PM" src="https://github.com/user-attachments/assets/6bda7454-47f6-4ebf-bed8-1b37186a9435" />

---
## Architucture Diagram
<img width="1536" height="1024" alt="Architecture " src="https://github.com/user-attachments/assets/9daaa48b-31a6-45ce-b3b4-4d4bff55e2c8" />


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
