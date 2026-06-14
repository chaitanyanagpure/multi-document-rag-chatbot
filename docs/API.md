# VerbaFlow AI — API Reference

> **Base URL (production):** `https://yourdomain.com`  
> **Base URL (development):** `http://localhost:8000`  
> **API Version:** v1  
> **Content-Type:** `application/json`  
> **Interactive Docs:** `/docs` (Swagger UI) | `/redoc` (ReDoc)

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Error Codes](#2-error-codes)
3. [Rate Limits](#3-rate-limits)
4. [Health Endpoints](#4-health-endpoints)
5. [Users](#5-users)
6. [Collections](#6-collections)
7. [Documents](#7-documents)
8. [Chat & RAG](#8-chat--rag)
9. [WebSocket Protocol](#9-websocket-protocol)
10. [SSE Streaming](#10-sse-streaming)
11. [API Keys](#11-api-keys)
12. [Admin](#12-admin)

---

## 1. Authentication

VerbaFlow uses JWT Bearer authentication. Include the access token in the `Authorization` header.

```http
Authorization: Bearer <access_token>
```

### 1.1 Register

```http
POST /api/v1/auth/register
```

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecureP@ssword123!",
  "full_name": "Jane Doe",
  "organization_name": "Acme Corp"
}
```

**Response `201 Created`:**
```json
{
  "user": {
    "id": "usr_01HXXXXXXXXXXXXXXXXXX",
    "email": "user@company.com",
    "full_name": "Jane Doe",
    "role": "admin",
    "org_id": "org_01HXXXXXXXXXXXXXXXXXX",
    "created_at": "2026-01-15T10:00:00Z"
  },
  "message": "Registration successful. Please verify your email."
}
```

### 1.2 Login

```http
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@company.com",
  "password": "SecureP@ssword123!"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "rt_01HXXXXXXXXXXXXXXXXXX",
  "user": {
    "id": "usr_01HXXXXXXXXXXXXXXXXXX",
    "email": "user@company.com",
    "full_name": "Jane Doe",
    "role": "admin",
    "org_id": "org_01HXXXXXXXXXXXXXXXXXX"
  }
}
```

> **Note:** The `refresh_token` is also set as an HTTP-only cookie.

### 1.3 Refresh Token

```http
POST /api/v1/auth/refresh
```

**Request Body:**
```json
{
  "refresh_token": "rt_01HXXXXXXXXXXXXXXXXXX"
}
```

**Response `200 OK`:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

### 1.4 Logout

```http
POST /api/v1/auth/logout
Authorization: Bearer <access_token>
```

**Response `200 OK`:**
```json
{ "message": "Logged out successfully." }
```

### 1.5 Forgot Password

```http
POST /api/v1/auth/forgot-password
```

**Request Body:**
```json
{ "email": "user@company.com" }
```

**Response `200 OK`:** (always success to prevent enumeration)
```json
{ "message": "If the email exists, a reset link has been sent." }
```

### 1.6 Reset Password

```http
POST /api/v1/auth/reset-password
```

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "new_password": "NewSecureP@ssword456!"
}
```

---

## 2. Error Codes

All errors follow a consistent structure:

```json
{
  "error": {
    "code": "DOCUMENT_NOT_FOUND",
    "message": "Document with ID doc_abc123 was not found.",
    "details": {},
    "request_id": "req_xyz789"
  }
}
```

### Standard HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200 OK` | Success |
| `201 Created` | Resource created |
| `204 No Content` | Success, no body |
| `400 Bad Request` | Validation error or malformed request |
| `401 Unauthorized` | Missing or invalid authentication token |
| `403 Forbidden` | Authenticated but insufficient permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Resource already exists |
| `413 Payload Too Large` | File exceeds size limit |
| `415 Unsupported Media Type` | File type not supported |
| `422 Unprocessable Entity` | Request body validation failed |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server error |
| `503 Service Unavailable` | Service temporarily down |

### Application Error Codes

| Code | HTTP Status | Description |
|------|------------|-------------|
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `TOKEN_INVALID` | 401 | Token is malformed or blacklisted |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role doesn't allow this action |
| `USER_NOT_FOUND` | 404 | User ID doesn't exist |
| `COLLECTION_NOT_FOUND` | 404 | Collection ID doesn't exist |
| `DOCUMENT_NOT_FOUND` | 404 | Document ID doesn't exist |
| `DOCUMENT_PROCESSING` | 409 | Document is still being processed |
| `FILE_TOO_LARGE` | 413 | File exceeds `MAX_FILE_SIZE_MB` |
| `FILE_TYPE_NOT_SUPPORTED` | 415 | Extension not in allowlist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests; see `Retry-After` header |
| `VECTOR_STORE_ERROR` | 500 | Error querying vector store |
| `LLM_ERROR` | 500 | Error calling the language model |
| `EMBEDDING_ERROR` | 500 | Error generating embeddings |

---

## 3. Rate Limits

Rate limit information is returned in response headers:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1709900060
Retry-After: 30
```

| Endpoint Group | Limit | Window |
|---------------|-------|--------|
| Auth: login/register | 10 | per minute per IP |
| Chat: query | 60 | per minute per user |
| Documents: upload | 20 | per minute per user |
| All other endpoints | 120 | per minute per user |

---

## 4. Health Endpoints

### 4.1 Basic Health Check

```http
GET /health
```

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2026-01-15T10:00:00Z"
}
```

### 4.2 Readiness Check

```http
GET /health/ready
```

Checks database, Redis, and vector store connectivity.

**Response `200 OK`:**
```json
{
  "status": "ready",
  "checks": {
    "database": { "status": "healthy", "latency_ms": 2 },
    "redis": { "status": "healthy", "latency_ms": 1 },
    "vector_store": { "status": "healthy", "latency_ms": 5 }
  }
}
```

**Response `503 Service Unavailable`:**
```json
{
  "status": "unhealthy",
  "checks": {
    "database": { "status": "unhealthy", "error": "Connection refused" },
    "redis": { "status": "healthy", "latency_ms": 1 },
    "vector_store": { "status": "healthy", "latency_ms": 5 }
  }
}
```

---

## 5. Users

### 5.1 Get Current User

```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "id": "usr_01HXXXXXXXXXXXXXXXXXX",
  "email": "user@company.com",
  "full_name": "Jane Doe",
  "role": "admin",
  "org_id": "org_01HXXXXXXXXXXXXXXXXXX",
  "avatar_url": null,
  "is_active": true,
  "last_login": "2026-01-15T09:00:00Z",
  "created_at": "2026-01-01T00:00:00Z",
  "updated_at": "2026-01-15T09:00:00Z",
  "preferences": {
    "default_collection_id": null,
    "language": "en",
    "theme": "light"
  }
}
```

### 5.2 Update Current User

```http
PATCH /api/v1/users/me
Authorization: Bearer <token>
```

**Request Body** (all fields optional):
```json
{
  "full_name": "Jane Smith",
  "preferences": {
    "default_collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
    "theme": "dark"
  }
}
```

### 5.3 Change Password

```http
POST /api/v1/users/me/change-password
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "current_password": "OldP@ssword123!",
  "new_password": "NewP@ssword456!"
}
```

### 5.4 List Org Users (Admin)

```http
GET /api/v1/users?page=1&limit=20&role=user&search=jane
Authorization: Bearer <admin_token>
```

**Response `200 OK`:**
```json
{
  "users": [
    {
      "id": "usr_01HXXXXXXXXXXXXXXXXXX",
      "email": "jane@company.com",
      "full_name": "Jane Doe",
      "role": "user",
      "is_active": true,
      "last_login": "2026-01-15T09:00:00Z",
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "pages": 1
}
```

### 5.5 Update User Role (Admin)

```http
PATCH /api/v1/users/{user_id}/role
Authorization: Bearer <admin_token>
```

**Request Body:**
```json
{ "role": "manager" }
```

### 5.6 Delete User Account

```http
DELETE /api/v1/users/me
Authorization: Bearer <token>
```

Cascades deletion of all user data (GDPR right to erasure).

---

## 6. Collections

A **Collection** is an isolated namespace for documents. Users query documents within a collection.

### 6.1 Create Collection

```http
POST /api/v1/collections
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "Q4 Financial Reports",
  "description": "All financial documents for Q4 2025",
  "is_public": false,
  "metadata": {
    "department": "finance",
    "fiscal_year": "2025"
  }
}
```

**Response `201 Created`:**
```json
{
  "id": "col_01HXXXXXXXXXXXXXXXXXX",
  "name": "Q4 Financial Reports",
  "description": "All financial documents for Q4 2025",
  "org_id": "org_01HXXXXXXXXXXXXXXXXXX",
  "created_by": "usr_01HXXXXXXXXXXXXXXXXXX",
  "is_public": false,
  "document_count": 0,
  "total_chunks": 0,
  "metadata": { "department": "finance" },
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:00:00Z"
}
```

### 6.2 List Collections

```http
GET /api/v1/collections?page=1&limit=20&search=finance
Authorization: Bearer <token>
```

### 6.3 Get Collection

```http
GET /api/v1/collections/{collection_id}
Authorization: Bearer <token>
```

### 6.4 Update Collection

```http
PATCH /api/v1/collections/{collection_id}
Authorization: Bearer <token>
```

### 6.5 Delete Collection

```http
DELETE /api/v1/collections/{collection_id}
Authorization: Bearer <token>
```

Deletes all documents, embeddings, and the FAISS index for this collection.

### 6.6 Collection Members (Permissions)

```http
POST /api/v1/collections/{collection_id}/members
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "user_id": "usr_01HXXXXXXXXXXXXXXXXXX",
  "permission": "read"
}
```

---

## 7. Documents

### 7.1 Upload Document

```http
POST /api/v1/documents
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Fields:**

| Field | Type | Required | Description |
|-------|------|---------|-------------|
| `file` | File | ✅ | The document file |
| `collection_id` | string | ✅ | Target collection ID |
| `title` | string | ❌ | Override document title |
| `tags` | string (JSON array) | ❌ | e.g. `["finance","q4"]` |
| `metadata` | string (JSON object) | ❌ | Custom metadata |

**Supported File Types:** PDF, DOCX, DOC, XLSX, XLS, PPTX, TXT, MD, CSV, HTML, HTM

**Response `202 Accepted`:**
```json
{
  "id": "doc_01HXXXXXXXXXXXXXXXXXX",
  "filename": "q4-report.pdf",
  "title": "Q4 2025 Financial Report",
  "collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
  "status": "processing",
  "file_size_bytes": 2048000,
  "mime_type": "application/pdf",
  "created_at": "2026-01-15T10:00:00Z",
  "estimated_processing_time_seconds": 45
}
```

**Document statuses:** `processing` → `ready` | `failed`

### 7.2 Get Document Status

```http
GET /api/v1/documents/{document_id}
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "id": "doc_01HXXXXXXXXXXXXXXXXXX",
  "filename": "q4-report.pdf",
  "title": "Q4 2025 Financial Report",
  "collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
  "status": "ready",
  "file_size_bytes": 2048000,
  "mime_type": "application/pdf",
  "page_count": 42,
  "chunk_count": 187,
  "word_count": 12450,
  "tags": ["finance", "q4"],
  "metadata": { "author": "Finance Team" },
  "processing_time_seconds": 38,
  "created_at": "2026-01-15T10:00:00Z",
  "updated_at": "2026-01-15T10:01:00Z"
}
```

### 7.3 List Documents in Collection

```http
GET /api/v1/collections/{collection_id}/documents?page=1&limit=20&status=ready
Authorization: Bearer <token>
```

### 7.4 Delete Document

```http
DELETE /api/v1/documents/{document_id}
Authorization: Bearer <token>
```

Removes file, database record, and all vector embeddings for this document.

### 7.5 Download Document

```http
GET /api/v1/documents/{document_id}/download
Authorization: Bearer <token>
```

Returns a redirect to a pre-signed URL (valid 5 minutes).

---

## 8. Chat & RAG

### 8.1 Query (Non-streaming)

```http
POST /api/v1/chat/query
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "question": "What was the total revenue in Q4 2025?",
  "collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
  "conversation_id": "conv_01HXXXXXXXXXXXXXXXXXX",
  "options": {
    "retrieval_count": 5,
    "similarity_threshold": 0.7,
    "include_citations": true,
    "language": "en",
    "temperature": 0.2
  }
}
```

**Response `200 OK`:**
```json
{
  "answer": "The total revenue in Q4 2025 was $4.2 billion, representing a 15% year-over-year increase.",
  "conversation_id": "conv_01HXXXXXXXXXXXXXXXXXX",
  "message_id": "msg_01HXXXXXXXXXXXXXXXXXX",
  "citations": [
    {
      "document_id": "doc_01HXXXXXXXXXXXXXXXXXX",
      "document_title": "Q4 2025 Financial Report",
      "page_number": 8,
      "chunk_text": "...total revenue for Q4 2025 reached $4.2B...",
      "similarity_score": 0.94,
      "highlight": "total revenue in Q4 2025 was $4.2 billion"
    }
  ],
  "model": "gemini-1.5-pro",
  "usage": {
    "prompt_tokens": 1842,
    "completion_tokens": 64,
    "total_tokens": 1906
  },
  "latency_ms": 1240,
  "created_at": "2026-01-15T10:05:00Z"
}
```

### 8.2 Query (Streaming via SSE)

```http
POST /api/v1/chat/query/stream
Authorization: Bearer <token>
Accept: text/event-stream
```

Same request body as non-streaming. Returns Server-Sent Events. See [SSE Streaming](#10-sse-streaming).

### 8.3 Get Conversation History

```http
GET /api/v1/chat/conversations/{conversation_id}/messages?page=1&limit=50
Authorization: Bearer <token>
```

**Response `200 OK`:**
```json
{
  "conversation_id": "conv_01HXXXXXXXXXXXXXXXXXX",
  "collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
  "messages": [
    {
      "id": "msg_01HXXXXXXXXXXXXXXXXXX",
      "role": "user",
      "content": "What was the total revenue in Q4 2025?",
      "created_at": "2026-01-15T10:05:00Z"
    },
    {
      "id": "msg_01HXXXXXXXXXXXXXXXXXY",
      "role": "assistant",
      "content": "The total revenue in Q4 2025 was $4.2 billion...",
      "citations": [...],
      "created_at": "2026-01-15T10:05:01Z"
    }
  ],
  "total": 2,
  "page": 1
}
```

### 8.4 List Conversations

```http
GET /api/v1/chat/conversations?collection_id=col_xxx&page=1&limit=20
Authorization: Bearer <token>
```

### 8.5 Delete Conversation

```http
DELETE /api/v1/chat/conversations/{conversation_id}
Authorization: Bearer <token>
```

---

## 9. WebSocket Protocol

Connect to the WebSocket endpoint for real-time, persistent chat sessions.

### Connection

```
wss://yourdomain.com/ws/chat?token=<access_token>
```

Or send the token in the first message (see below).

### Message Format

All messages are JSON objects with a `type` field.

#### Client → Server Messages

**Authenticate:**
```json
{
  "type": "auth",
  "token": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Send query:**
```json
{
  "type": "query",
  "conversation_id": "conv_01HXXXXXXXXXXXXXXXXXX",
  "collection_id": "col_01HXXXXXXXXXXXXXXXXXX",
  "question": "What is the refund policy?",
  "options": {
    "retrieval_count": 5,
    "include_citations": true
  }
}
```

**Ping (keep-alive):**
```json
{ "type": "ping" }
```

#### Server → Client Messages

**Auth confirmation:**
```json
{
  "type": "auth_success",
  "user_id": "usr_01HXXXXXXXXXXXXXXXXXX"
}
```

**Stream start:**
```json
{
  "type": "stream_start",
  "message_id": "msg_01HXXXXXXXXXXXXXXXXXX",
  "conversation_id": "conv_01HXXXXXXXXXXXXXXXXXX"
}
```

**Token chunk (streamed):**
```json
{
  "type": "token",
  "content": "The refund",
  "message_id": "msg_01HXXXXXXXXXXXXXXXXXX"
}
```

**Stream end:**
```json
{
  "type": "stream_end",
  "message_id": "msg_01HXXXXXXXXXXXXXXXXXX",
  "citations": [...],
  "usage": { "total_tokens": 842 }
}
```

**Error:**
```json
{
  "type": "error",
  "code": "COLLECTION_NOT_FOUND",
  "message": "Collection not found."
}
```

**Pong:**
```json
{ "type": "pong", "timestamp": "2026-01-15T10:00:00Z" }
```

### Example Client (JavaScript)

```javascript
const ws = new WebSocket('wss://yourdomain.com/ws/chat');

ws.onopen = () => {
  ws.send(JSON.stringify({ type: 'auth', token: accessToken }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  
  switch (msg.type) {
    case 'auth_success':
      console.log('Connected as', msg.user_id);
      ws.send(JSON.stringify({
        type: 'query',
        collection_id: 'col_xxx',
        question: 'What is the refund policy?'
      }));
      break;
    case 'token':
      process.stdout.write(msg.content);
      break;
    case 'stream_end':
      console.log('\n\nCitations:', msg.citations);
      break;
    case 'error':
      console.error('Error:', msg.message);
      break;
  }
};

// Keep-alive
setInterval(() => ws.send(JSON.stringify({ type: 'ping' })), 30000);
```

---

## 10. SSE Streaming

For HTTP clients that prefer SSE over WebSocket.

### Connection

```http
POST /api/v1/chat/query/stream
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: text/event-stream
Cache-Control: no-cache
```

### Event Types

```
event: stream_start
data: {"message_id":"msg_01HXXXXXXXXXXXXXXXXXX","conversation_id":"conv_xxx"}

event: token
data: {"content":"The total"}

event: token
data: {"content":" revenue"}

event: token
data: {"content":" was $4.2 billion"}

event: citations
data: {"citations":[{"document_id":"doc_xxx","page_number":8,"similarity_score":0.94}]}

event: usage
data: {"prompt_tokens":1842,"completion_tokens":64,"total_tokens":1906}

event: stream_end
data: {"message_id":"msg_01HXXXXXXXXXXXXXXXXXX","latency_ms":1240}
```

### Example Client (Python)

```python
import httpx

async def stream_query(question: str, collection_id: str, token: str):
    async with httpx.AsyncClient() as client:
        async with client.stream(
            "POST",
            "https://yourdomain.com/api/v1/chat/query/stream",
            headers={
                "Authorization": f"Bearer {token}",
                "Accept": "text/event-stream",
            },
            json={"question": question, "collection_id": collection_id},
        ) as response:
            async for line in response.aiter_lines():
                if line.startswith("data:"):
                    import json
                    data = json.loads(line[5:].strip())
                    if "content" in data:
                        print(data["content"], end="", flush=True)
```

---

## 11. API Keys

Programmatic access via long-lived API keys.

### 11.1 Create API Key

```http
POST /api/v1/api-keys
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "My Automation Script",
  "permissions": ["documents:read", "chat:query"],
  "expires_at": "2027-01-01T00:00:00Z",
  "rate_limit_per_minute": 30
}
```

**Response `201 Created`:**
```json
{
  "id": "key_01HXXXXXXXXXXXXXXXXXX",
  "name": "My Automation Script",
  "key": "vf_01HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  "permissions": ["documents:read", "chat:query"],
  "expires_at": "2027-01-01T00:00:00Z",
  "created_at": "2026-01-15T10:00:00Z"
}
```

> ⚠️ **The key value is only shown once.** Store it securely.

**Usage:**
```http
Authorization: ApiKey vf_01HXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

### 11.2 List API Keys

```http
GET /api/v1/api-keys
Authorization: Bearer <token>
```

### 11.3 Revoke API Key

```http
DELETE /api/v1/api-keys/{key_id}
Authorization: Bearer <token>
```

---

## 12. Admin

> Requires `admin` or `super_admin` role.

### 12.1 Organization Stats

```http
GET /api/v1/admin/stats
Authorization: Bearer <admin_token>
```

**Response `200 OK`:**
```json
{
  "org_id": "org_01HXXXXXXXXXXXXXXXXXX",
  "users": { "total": 25, "active": 23, "by_role": { "admin": 2, "user": 21, "viewer": 2 } },
  "collections": { "total": 8 },
  "documents": { "total": 312, "ready": 308, "processing": 2, "failed": 2 },
  "storage": { "total_bytes": 524288000, "formatted": "500 MB" },
  "queries": {
    "last_24h": 450,
    "last_7d": 3200,
    "last_30d": 12800
  },
  "tokens_used": {
    "last_30d": 8450000,
    "estimated_cost_usd": 12.68
  }
}
```

### 12.2 Audit Logs

```http
GET /api/v1/admin/audit-logs?page=1&limit=50&event_type=document.download&user_id=usr_xxx&from=2026-01-01T00:00:00Z&to=2026-01-31T23:59:59Z
Authorization: Bearer <admin_token>
```

### 12.3 System Health (Admin)

```http
GET /api/v1/admin/system
Authorization: Bearer <admin_token>
```

**Response `200 OK`:**
```json
{
  "version": "1.0.0",
  "uptime_seconds": 86400,
  "database": { "status": "healthy", "pool_size": 20, "pool_used": 3 },
  "redis": { "status": "healthy", "memory_used_mb": 128 },
  "vector_store": { "type": "faiss", "index_count": 8, "total_vectors": 58420 },
  "llm_provider": { "name": "gemini", "model": "gemini-1.5-pro", "status": "operational" },
  "embedding_provider": { "name": "google", "model": "text-embedding-004", "status": "operational" }
}
```
