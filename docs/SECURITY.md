# VerbaFlow AI — Security Documentation

> **Audience:** Security engineers, DevSecOps teams, compliance officers, and developers.  
> **Last Updated:** 2026-06-06  
> **Version:** 1.0.0

---

## Table of Contents

1. [Security Architecture Overview](#1-security-architecture-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Data Encryption](#3-data-encryption)
4. [Multi-tenancy Isolation](#4-multi-tenancy-isolation)
5. [Network Security](#5-network-security)
6. [Rate Limiting & DoS Protection](#6-rate-limiting--dos-protection)
7. [Audit Logging](#7-audit-logging)
8. [Threat Model](#8-threat-model)
9. [Vulnerability Management](#9-vulnerability-management)
10. [Incident Response](#10-incident-response)
11. [Compliance Notes](#11-compliance-notes)
12. [Security Deployment Checklist](#12-security-deployment-checklist)

---

## 1. Security Architecture Overview

VerbaFlow AI implements a defense-in-depth security model with multiple independent security layers:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Security Layers                                 │
├─────────────────────────────────────────────────────────────────────┤
│  Layer 1: Edge       — WAF, DDoS protection, TLS termination        │
│  Layer 2: Network    — VPC isolation, Security Groups, NetworkPol.  │
│  Layer 3: Ingress    — NGINX rate limiting, CORS, security headers  │
│  Layer 4: App        — JWT auth, RBAC, input validation, OWASP      │
│  Layer 5: Data       — Encryption at rest + in transit, PII masking │
│  Layer 6: Secrets    — K8s Secrets, Vault / Cloud SM integration    │
│  Layer 7: Audit      — Immutable audit log, structured logging      │
│  Layer 8: Monitoring — Anomaly detection, SIEM, alerting            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Authentication & Authorization

### 2.1 JWT Authentication

VerbaFlow uses a dual-token JWT strategy:

| Token | Lifetime | Storage | Rotation |
|-------|---------|---------|---------|
| Access Token | 60 minutes | Memory only (not localStorage) | On each refresh |
| Refresh Token | 7 days | HTTP-only, Secure, SameSite=Strict cookie | On use |

**Access token structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@domain.com",
  "org_id": "org-uuid",
  "roles": ["admin"],
  "permissions": ["documents:read", "documents:write"],
  "iat": 1709900000,
  "exp": 1709903600,
  "jti": "unique-token-id"
}
```

**Security properties:**
- Algorithm: HS256 (configurable to RS256 for asymmetric signing)
- `SECRET_KEY` minimum 32 bytes, generated via `openssl rand -hex 32`
- Token blacklisting via Redis for immediate revocation
- JTI (JWT ID) tracking to prevent replay attacks
- Refresh token rotation — old token invalidated on use

### 2.2 Password Security

- **Hashing**: bcrypt with cost factor 12 (configurable)
- **Strength enforcement**: minimum 12 characters, mixed case, numbers, symbols
- **Breach detection**: optional HaveIBeenPwned API integration
- **Reset flow**: time-limited (15 min) single-use token via email

### 2.3 OAuth2 / SSO Integration

VerbaFlow supports OAuth2 providers via standard flow:
- **Google Workspace** (PKCE)
- **Microsoft Azure AD** (OIDC)
- **GitHub** (enterprise)
- **Generic OIDC** provider

### 2.4 Role-Based Access Control (RBAC)

```
┌──────────────────────────────────────────────────────────────┐
│                     RBAC Hierarchy                            │
├──────────────────────────────────────────────────────────────┤
│  SUPER_ADMIN  — Platform-level access; manage all orgs       │
│  ADMIN        — Org-level admin; manage users, billing       │
│  MANAGER      — Manage collections, see all org documents    │
│  USER         — Upload, query assigned collections           │
│  VIEWER       — Read-only: query documents, no upload        │
│  API_KEY      — Service account; scoped to specific actions  │
└──────────────────────────────────────────────────────────────┘
```

**Permission matrix:**

| Permission | Super Admin | Admin | Manager | User | Viewer |
|-----------|------------|-------|---------|------|--------|
| Manage users | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create collections | ✅ | ✅ | ✅ | ❌ | ❌ |
| Upload documents | ✅ | ✅ | ✅ | ✅ | ❌ |
| Delete documents | ✅ | ✅ | ✅ | own | ❌ |
| Query documents | ✅ | ✅ | ✅ | ✅ | ✅ |
| View audit logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage API keys | ✅ | ✅ | ❌ | ❌ | ❌ |

### 2.5 API Key Authentication

For service-to-service or programmatic access:
- Keys prefixed with `vf_` for easy identification
- Hashed with SHA-256 before storage (never stored in plaintext)
- Scoped permissions (e.g., `documents:read` only)
- Per-key rate limits
- Last-used timestamp tracked
- Automatic expiration supported

---

## 3. Data Encryption

### 3.1 Encryption in Transit

- **External traffic**: TLS 1.2+ enforced; TLS 1.3 preferred
- **Cipher suites**: ECDHE-RSA-AES256-GCM-SHA384, ECDHE-RSA-CHACHA20-POLY1305
- **Certificate management**: cert-manager with Let's Encrypt (auto-renewal)
- **HSTS**: `max-age=31536000; includeSubDomains; preload`
- **Internal K8s traffic**: mTLS via service mesh (Istio/Linkerd recommended for PCI/HIPAA)

### 3.2 Encryption at Rest

| Data | Storage | Encryption |
|------|---------|-----------|
| User PII | PostgreSQL | AES-256 (cloud disk encryption) |
| Document content | Local disk / S3 | AES-256-GCM (S3 SSE-KMS) |
| Vector embeddings | FAISS / Pinecone | Cloud provider default |
| Redis cache | Redis AOF | Cloud provider disk encryption |
| API keys (stored hash) | PostgreSQL | SHA-256 one-way hash |
| Passwords | PostgreSQL | bcrypt (irreversible) |

### 3.3 Field-Level Encryption

Sensitive PII fields (email, full name) can be encrypted at the application layer using AES-256-GCM with a key from Vault/KMS before storage.

### 3.4 Secret Management

**Never** store secrets in:
- Source code or git history
- Docker image layers
- ConfigMaps
- Application logs

**Recommended secret backends:**

| Environment | Backend |
|------------|---------|
| Development | `.env` file (gitignored) |
| Staging | K8s Secrets + Sealed Secrets |
| Production | GCP Secret Manager / AWS Secrets Manager / HashiCorp Vault |

---

## 4. Multi-tenancy Isolation

VerbaFlow implements row-level isolation between organisations:

### 4.1 Database Isolation

Every table that contains organisational data includes an `org_id` column. All queries are automatically scoped:

```sql
-- Example: Users can only see their org's collections
SELECT * FROM collections WHERE org_id = :current_org_id;
-- Application-level check enforced on every query via SQLAlchemy scope
```

### 4.2 Vector Store Isolation

- FAISS: Each organisation gets a separate index file at `faiss_indexes/{org_id}/`
- Pinecone: Namespace-based isolation (`namespace=org_id`)
- Qdrant: Collection-per-organisation with API key scoping

### 4.3 File Storage Isolation

Documents are stored at `uploads/{org_id}/{collection_id}/{document_id}/` with:
- Path validation to prevent directory traversal
- Pre-signed URLs with TTL for direct downloads
- Filename sanitization before storage

### 4.4 Tenant Spoofing Prevention

- `org_id` is extracted from the verified JWT, never from user input
- API routes validate that the requested resource belongs to the authenticated organisation
- FastAPI dependency injection enforces org scoping at every endpoint

---

## 5. Network Security

### 5.1 Kubernetes NetworkPolicy

```yaml
# Allow backend to receive traffic only from ingress and frontend
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: verbaflow-backend-policy
  namespace: verbaflow
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/name: verbaflow-backend
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: ingress-nginx
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: verbaflow-frontend
      ports:
        - port: 8000
  egress:
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: verbaflow-postgres
      ports:
        - port: 5432
    - to:
        - podSelector:
            matchLabels:
              app.kubernetes.io/name: verbaflow-redis
      ports:
        - port: 6379
    # Allow external AI API calls
    - ports:
        - port: 443
```

### 5.2 Security Headers

The NGINX Ingress enforces these HTTP response headers:

| Header | Value |
|--------|-------|
| `X-Frame-Options` | `SAMEORIGIN` |
| `X-Content-Type-Options` | `nosniff` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` |
| `Content-Security-Policy` | Strict CSP restricting scripts/styles to self |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |

### 5.3 CORS Policy

- Allowed origins: explicitly listed (no wildcard in production)
- Credentials: true (required for cookie-based refresh tokens)
- Pre-flight cache: 600 seconds

---

## 6. Rate Limiting & DoS Protection

### 6.1 API Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /api/v1/auth/login` | 10 requests | per minute, per IP |
| `POST /api/v1/auth/register` | 5 requests | per minute, per IP |
| `POST /api/v1/chat/query` | 60 requests | per minute, per user |
| `POST /api/v1/documents` (upload) | 20 requests | per minute, per user |
| All other endpoints | 120 requests | per minute, per user |

### 6.2 NGINX Rate Limiting

Configured in `k8s/ingress.yaml`:
- `limit-rps: 50` — requests per second per IP
- `limit-connections: 20` — concurrent connections per IP
- Burst allowance for bursty-but-legitimate traffic

### 6.3 Redis-backed Rate Limiting

Application-level rate limiting uses a sliding window algorithm in Redis:
- Granular per-user, per-endpoint limits
- Distributed across all backend replicas
- Returns `429 Too Many Requests` with `Retry-After` header

---

## 7. Audit Logging

All security-relevant events are logged to an append-only audit table and exported to your SIEM.

### 7.1 Logged Events

| Category | Events |
|----------|--------|
| Authentication | Login, logout, failed login, password reset, token refresh |
| User management | User created, updated, deleted, role changed |
| Document | Uploaded, deleted, accessed, downloaded, shared |
| Collection | Created, updated, deleted, permission changed |
| Query | All chat queries with user ID, collection ID, timestamp |
| API Keys | Created, revoked, used |
| Admin actions | All admin-level operations |

### 7.2 Audit Log Format

```json
{
  "timestamp": "2026-01-15T10:30:00Z",
  "event_type": "document.download",
  "actor": {
    "user_id": "usr_abc123",
    "email": "john@company.com",
    "ip_address": "203.0.113.42",
    "user_agent": "Mozilla/5.0 ..."
  },
  "resource": {
    "type": "document",
    "id": "doc_xyz789",
    "name": "Q4-Report.pdf",
    "org_id": "org_def456",
    "collection_id": "col_ghi012"
  },
  "result": "success",
  "metadata": {
    "request_id": "req_jkl345",
    "duration_ms": 45
  }
}
```

### 7.3 Log Retention

- Application logs: 90 days (compressed after 30 days)
- Audit logs: 1 year (immutable, append-only)
- Security events: 2 years
- Exported to: CloudWatch / Stackdriver / Azure Monitor / Splunk (configurable)

---

## 8. Threat Model

### 8.1 Assets to Protect

| Asset | Sensitivity | Threat |
|-------|------------|--------|
| User credentials | Critical | Credential stuffing, brute force |
| Document contents | High | Unauthorized access, data leak |
| API keys | High | Key theft, privilege escalation |
| Vector embeddings | Medium | Model inversion attacks |
| User PII | High | GDPR breach, identity theft |
| LLM API keys | Critical | Cost explosion, abuse |

### 8.2 Threat Matrix

| Threat | Likelihood | Impact | Mitigation |
|--------|-----------|--------|-----------|
| SQL Injection | Low | Critical | SQLAlchemy parameterized queries; input validation |
| XSS | Medium | High | CSP headers; output encoding; React escaping |
| CSRF | Low | Medium | SameSite cookies; CSRF token on state-changing ops |
| Prompt Injection | Medium | Medium | Input sanitization; system prompt hardening |
| JWT Forgery | Low | Critical | Strong secret; RS256 option; token blacklisting |
| Data exfiltration | Low | Critical | Org scoping; audit logs; DLP rules |
| DoS/DDoS | High | High | Rate limiting; NGINX limits; cloud WAF |
| Supply chain attack | Low | High | Dependency pinning; Trivy scanning; SBOM |
| Insider threat | Low | High | RBAC; audit logs; least-privilege |
| LLM key abuse | Medium | High | Per-user limits; spend monitoring; key rotation |

### 8.3 Prompt Injection Mitigations

- System prompts are not exposed to users
- User input is sanitized before injection into prompts
- Retrieved documents are clearly delimited from instructions
- AI responses are scanned for sensitive data patterns before delivery

---

## 9. Vulnerability Management

### 9.1 Dependency Scanning

- **Python**: `bandit` (SAST) + `safety` (dependency CVE scan) in CI
- **Node.js**: `npm audit` + `snyk` in CI
- **Docker images**: `trivy` scan on every build; results uploaded to GitHub Security tab
- **Infrastructure**: Kubernetes `kube-bench` CIS benchmark checks

### 9.2 Patch Policy

| Severity | Response SLA |
|----------|-------------|
| Critical (CVSS 9.0-10.0) | Patch within 24 hours |
| High (CVSS 7.0-8.9) | Patch within 7 days |
| Medium (CVSS 4.0-6.9) | Patch within 30 days |
| Low (CVSS 0.1-3.9) | Next planned release |

### 9.3 Penetration Testing

- Annual third-party penetration test
- Quarterly internal security review
- Automated DAST scanning with OWASP ZAP in CI

---

## 10. Incident Response

### 10.1 Severity Definitions

| Severity | Definition | Response Time |
|----------|-----------|--------------|
| P0 — Critical | Data breach, service down, ransomware | 15 minutes |
| P1 — High | Auth bypass, data leak, partial outage | 1 hour |
| P2 — Medium | Elevated error rate, performance degradation | 4 hours |
| P3 — Low | Non-critical security finding | 48 hours |

### 10.2 Incident Response Playbook

#### P0/P1 Incident

1. **Detect** — Alert fires in PagerDuty / Slack
2. **Acknowledge** — On-call engineer confirms within 15 minutes
3. **Assess** — Determine blast radius and affected users
4. **Contain** — Isolate affected systems:
   ```bash
   # Block specific IP
   kubectl annotate ingress verbaflow-ingress \
     nginx.ingress.kubernetes.io/server-snippet="deny 203.0.113.42;"

   # Revoke all sessions for a compromised user
   kubectl exec deploy/verbaflow-backend -n verbaflow -- \
     python -m app.cli revoke-user-sessions --user-id USER_ID

   # Emergency: take backend offline
   kubectl scale deployment verbaflow-backend --replicas=0 -n verbaflow
   ```
5. **Investigate** — Analyze audit logs, access logs
6. **Remediate** — Deploy fix, restore service
7. **Post-mortem** — RCA within 48 hours; blameless review
8. **Notify** — Affected users within 72 hours (GDPR requirement)

### 10.3 Security Contacts

- Security team: security@yourdomain.com
- Bug bounty: via HackerOne (if applicable)
- Responsible disclosure: security.txt at `/.well-known/security.txt`

---

## 11. Compliance Notes

### 11.1 GDPR Compliance

| Requirement | Implementation |
|-------------|---------------|
| Data minimization | Only collect essential PII |
| Right to erasure | `DELETE /api/v1/users/me` cascades all data |
| Data portability | `GET /api/v1/users/me/export` — JSON export |
| Processing records | Audit log covers all data access |
| Breach notification | Incident response process (72-hour rule) |
| DPA | Data Processing Agreement template available |
| Cookie consent | Implemented in frontend; only essential cookies |

### 11.2 SOC 2 Type II Readiness

| Control | Status |
|---------|--------|
| Access controls (CC6) | ✅ RBAC + MFA |
| Encryption (CC6.7) | ✅ TLS + at-rest |
| Availability (A1) | ✅ HPA + multi-AZ |
| Change management (CC8) | ✅ CI/CD + approval gates |
| Monitoring (CC7) | ✅ Prometheus + Sentry |
| Incident response (CC7.5) | ✅ Runbook above |
| Vendor management (CC9) | Requires assessment of Gemini/OpenAI DPA |

### 11.3 ISO 27001 Alignment

VerbaFlow's security controls align with ISO 27001:2022 Annex A, including:
- A.5: Organizational controls
- A.8: Technology controls (access, encryption, logging)
- A.9: Physical controls (managed by cloud provider)

### 11.4 AI-Specific Considerations

- **Data residency**: LLM API calls send document chunks to Google/OpenAI servers — ensure this aligns with your data residency requirements
- **Training data opt-out**: Configure Gemini/OpenAI API to opt out of model training
- **Private deployment**: For air-gapped environments, use Ollama or vLLM with local models

---

## 12. Security Deployment Checklist

### Secrets & Configuration
- [ ] `SECRET_KEY` is ≥ 32 bytes, random, never reused across environments
- [ ] `POSTGRES_PASSWORD` is strong (≥ 20 chars, mixed)
- [ ] All API keys stored in cloud secret manager (not K8s Secrets)
- [ ] No secrets in git history (`git log --all -- '*.env'`)
- [ ] Rotate all secrets before first production deployment

### Network
- [ ] NetworkPolicies applied (default-deny + explicit allows)
- [ ] NGINX ingress security headers configured
- [ ] TLS 1.2+ enforced; TLS 1.0/1.1 disabled
- [ ] Rate limiting enabled on all endpoints
- [ ] Metrics endpoint (`/metrics`) restricted to internal network only

### Authentication
- [ ] JWT secret is environment-specific
- [ ] Refresh token is HTTP-only Secure SameSite=Strict cookie
- [ ] Failed login attempts trigger account lockout after 10 attempts
- [ ] MFA enforced for admin accounts
- [ ] Default admin password changed after first deployment

### Application
- [ ] Debug mode disabled (`DEBUG=false`)
- [ ] Stacktraces not exposed in API error responses
- [ ] SQL injection prevention verified (parameterized queries)
- [ ] File upload types restricted; MIME type validation enabled
- [ ] Path traversal prevention in file storage

### Infrastructure
- [ ] All containers run as non-root users
- [ ] `readOnlyRootFilesystem` enabled where possible
- [ ] Pod Security Standards enforced (Restricted profile)
- [ ] Kubernetes API server access restricted (RBAC)
- [ ] Node autoupgrade enabled in GKE/EKS/AKS
- [ ] Trivy image scan: no CRITICAL vulnerabilities

### Monitoring
- [ ] Audit logging enabled and shipping to SIEM
- [ ] Prometheus alert for failed login spike
- [ ] Prometheus alert for error rate > 5%
- [ ] Sentry configured with environment tag
- [ ] On-call rotation configured in PagerDuty
