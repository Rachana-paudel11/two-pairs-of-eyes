# Two Pairs of Eyes — Security Documentation

**Module:** CET257 Enterprise Project  
**Repository:** [https://github.com/Rachana-paudel11/two-pairs-of-eyes](https://github.com/Rachana-paudel11/two-pairs-of-eyes)  
**Branch:** `feature/security-hardening`  
**Security Baseline:** Prototype Hardened (Authentication, RBAC, Result Integrity, Anti-Tamper)

---

## 1. Security Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                  APPLICATION TRUST BOUNDARIES                                    |
+---------------------------------------------------------------------------------------------------+
|  [ UNTRUSTED CLIENT BROWSER ]                                                                     |
|  - Three.js 3D Viewport & WebGL Canvas                                                            |
|  - Finite State Machine (FSM) Lifecycle Execution                                                |
|  - Local Storage / SessionStorage (Session Checkpoint Resumption)                                 |
|  - IndexedDB Engine (Offline Practice Profiles & Local Reports)                                   |
|                          |                                                                        |
|                          | HTTP/HTTPS (REST API) with JWT Bearer / HttpOnly Secure Cookies        |
|                          v                                                                        |
|  [ TRUSTED BACKEND SERVICE (Node.js / Express) ]                                                  |
|  - Security Headers (nosniff, SAMEORIGIN, Referrer-Policy, Permissions-Policy)                     |
|  - Restricted CORS Whitelist (CLIENT_ORIGIN) & Request Limiting (100 KB payload)                  |
|  - In-Memory IP Rate Limiter (Login & Registration throttling)                                    |
|  - Authentication & Cryptographic Token Verification (HMAC-SHA256)                               |
|  - Role-Based Access Control Middleware (requireAuth, requireRole)                                |
|  - Result Integrity & Authoritative Score Verification Engine                                    |
|  - Structured Audit Logger (No Passwords or Tokens Recorded)                                     |
|                          |                                                                        |
|                          v                                                                        |
|  [ DATABASE LAYER (MongoDB / Mongoose) ]                                                          |
|  - Trainee Schema (bcrypt 10-round salted hashing, role enforcement, toJSON password strip)      |
|  - InspectionReport Schema (authoritative scores, zone logs, verified pass status)                |
+---------------------------------------------------------------------------------------------------+
```

### 1.1 Trust Boundaries
- **Untrusted Client:** The browser environment is treated as untrusted. Client-submitted scores, pass/fail booleans, and trainee IDs cannot be accepted without authoritative server validation.
- **Trusted Server:** All authoritative business rules, score bounds verification, role authorization, and credential evaluations occur server-side.
- **Protected Storage:** The database persists hashed credentials and verified inspection records.

### 1.2 Authentication
- Passwords are encrypted before storage using **bcrypt** with a cost factor of 10 salt rounds.
- Passwords are never stored in plain text, never logged, and stripped from all JSON responses via Mongoose serialization hooks.
- Authenticated sessions issue **HMAC-SHA256 signed tokens** transmitted via both `Authorization: Bearer <token>` and `HttpOnly` cookies.
- Constant-time comparison (`crypto.timingSafeEqual`) is utilized during token verification to defend against timing side-channel attacks.

### 1.3 Authorization (RBAC)
- Role assignment is enforced server-side. Public user registration strictly assigns the `TRAINEE` role, preventing privilege escalation.
- Endpoints are protected by reusable middleware:
  - `requireAuth`: Enforces a valid, unexpired session token (returns `401 Unauthorized`).
  - `requireRole`: Restricts access to specific role tiers (returns `403 Forbidden`).
- IDOR (Insecure Direct Object Reference) protection ensures trainees can only inspect their own reports; cross-trainee queries are rejected.

### 1.4 Offline Behaviour & Integrity
- Trainees operating in connectivity-challenged warehouse environments can access 3D training and practice gameplay offline.
- **Zero Offline Passwords:** IndexedDB stores practice profiles and inspection caches without storing passwords or password hashes.
- Offline practice mode grants no privileged access to organization-wide data or supervisor dashboards.

### 1.5 Result Integrity & Anti-Tamper
- Submitted scores are validated against scenario definitions:
  - Must be a number within `[0, 25]`.
  - Negative values or values exceeding 25 are rejected.
  - Scenario configuration tampering (`maxScore !== 25`, `passMark !== 18`) is rejected.
  - Stop IDs (`stop_01` to `stop_05`), action IDs, and outcome tiers are validated against allowed sets.
  - Authenticated trainees cannot submit scores under another trainee's ID.
  - The final pass/fail determination and rank title (`Safety Champion` vs `Hazards Overlooked`) are authoritatively computed on the server.

### 1.6 Browser Storage Audit

| Storage Mechanism | Key / Store | Stored Content | Sensitivity | Security Handling |
|---|---|---|---|---|
| `localStorage` | `technova_remember_id` | Trainee ID (e.g. `TR-10001`) | Low (Non-sensitive ID) | Retained only when Remember Me is checked. Never stores passwords. |
| `sessionStorage` | `technova_safety_session_checkpoint` | Active stop index, score, timer | Low (Temporary simulation progress) | Cleared automatically upon session completion. |
| `IndexedDB` | `trainees` | Trainee practice profile (ID, name, role) | Low | Password storage completely removed. |
| `IndexedDB` | `inspection_reports` | Local inspection history copy | Low | Client-side cache for offline debriefing. |
| `IndexedDB` | `active_sessions` | Offline simulation checkpoint | Low | Local resume state only. |

---

## 2. Roles and Permissions Matrix

| Endpoint | Method | Public / Guest | Trainee | Trainer (Supervisor) | Admin |
|---|---|:---:|:---:|:---:|:---:|
| `/api/health` | GET | Allowed | Allowed | Allowed | Allowed |
| `/api/auth/register` | POST | Allowed (Trainee only) | Allowed | N/A | N/A |
| `/api/auth/login` | POST | Allowed | Allowed | Allowed | Allowed |
| `/api/auth/me` | GET | Denied (401) | Allowed | Allowed | Allowed |
| `/api/reports` | POST | Denied (401) | Allowed (Own ID only) | Allowed | Allowed |
| `/api/reports/:id` | GET | Denied (401) | Allowed (Own report only; 403 on others) | Allowed | Allowed |
| `/api/reports` | GET | Denied (401) | Denied (403) | Allowed | Allowed |
| `/api/reports/stats` | GET | Denied (401) | Allowed | Allowed | Allowed |
| `/api/reports/leaderboard` | GET | Allowed | Allowed | Allowed | Allowed |

---

## 3. Environment Variables

The following environment variables configure the application. Values must be provided in `.env` (never committed to repository):

| Variable Name | Purpose | Example / Format |
|---|---|---|
| `PORT` | Backend listening port | `5000` |
| `MONGODB_URI` | MongoDB connection connection string | `mongodb://127.0.0.1:27017/two_pairs_of_eyes` |
| `JWT_SECRET` | Secret key for HMAC-SHA256 token signature | High-entropy string (>= 32 chars) |
| `CLIENT_ORIGIN` | Allowed CORS origins for browser communication | `http://localhost:3000,http://localhost:5173` |
| `ENABLE_DEMO_LOGIN` | Flag to enable dev-only demo accounts | `false` (default: false) |
| `NODE_ENV` | Runtime environment mode | `development` or `production` |

---

## 4. Security Controls Summary

1. **Password Policy:** Minimum 12 characters, maximum 128 characters. Allows passphrases and special characters without arbitrary composition rules. Passwords are not trimmed.
2. **ReDoS / Safe Search:** User input for name search is escaped using `escapeRegex()` before regex compilation, preventing regular expression denial of service or injection.
3. **CORS Hardening:** Wildcard `*` origins are rejected; origins are strictly validated against `CLIENT_ORIGIN`. Credentials and headers are explicitly constrained.
4. **Security Headers:** Implemented via middleware setting `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, and `Permissions-Policy`.
5. **Rate Limiting:** In-memory sliding-window throttling on `/api/auth/login` (10 req/min) and `/api/auth/register` (5 req/min). Returns `429 Too Many Requests` with `Retry-After`.
6. **Payload Size Guard:** Request bodies parsed with `express.json({ limit: '100kb' })`, preventing large payload memory exhaustion.
7. **Bounded Pagination:** `getAllReports` caps queries to a maximum of 100 items per page, preventing mass database extraction.
8. **Audit Logging:** Structured logging records security events (`AUTH_LOGIN`, `AUTHZ_DENIED`, `REPORT_SUBMITTED`, `RATE_LIMIT_EXCEEDED`) with IP and User ID, strictly excluding tokens and passwords.
9. **Safe Error Handling:** Production error responses return sanitized messages without stack traces, database schemas, or internal file paths.

---

## 5. Development vs. Production Configuration

| Control | Development Environment | Production Environment |
|---|---|---|
| **Protocol** | HTTP (`http://localhost`) | HTTPS mandatory (TLS terminated at ingress/reverse proxy) |
| **CORS Origins** | `http://localhost:3000`, `http://localhost:5173` | Fully qualified production frontend domain |
| **Cookie Security** | `HttpOnly; SameSite=Lax` | `HttpOnly; SameSite=Lax; Secure` |
| **Demo Authentication** | Gated by `ENABLE_DEMO_LOGIN=true` | Strictly `ENABLE_DEMO_LOGIN=false` (backdoors disabled) |
| **HSTS Header** | Disabled (not applicable over HTTP) | Enabled (`max-age=31536000; includeSubDomains`) |
| **Error Details** | Controlled console diagnostics | Generic client responses; full server-side logging |

---

## 6. Known Security Limitations

1. **Deployment-Dependent HTTPS:** TLS encryption must be provided by the production web server/reverse proxy (Nginx, Caddy, AWS ALB). Local development operates on HTTP.
2. **In-Memory Rate Limiting:** The prototype rate limiter operates in-memory per Node process. In a distributed multi-instance deployment, a shared Redis store would be required.
3. **Multi-Factor Authentication (MFA):** As an educational prototype, MFA is not currently implemented.
4. **Third-Party Development Dependency (esbuild / Vite):** `npm audit` notes a moderate dev-only vulnerability in esbuild bundled within Vite 5. Addressing this requires a major breaking upgrade to Vite 8; it does not affect the production runtime artifact.
5. **Client-Side Simulation Rendering:** WebGL state and 3D animations are computed locally on client hardware; server-side proof-of-play keystroke replay is recommended for future high-stakes compliance certifications.

---

## 7. Security Testing & Verification

Run the complete test suite (40 engine & simulation tests + 28 security hardening tests):
```bash
npm test
```

Execute specific security test suites:
```bash
# Authentication & password policy tests
node --test tests/security/auth.test.js

# Role-based authorization & IDOR tests
node --test tests/security/authorization.test.js

# Result integrity & score anti-tamper tests
node --test tests/security/resultIntegrity.test.js

# Server hardening, headers, & rate limiter tests
node --test tests/security/serverHardening.test.js
```

Verify production bundle build:
```bash
npm run build
```
