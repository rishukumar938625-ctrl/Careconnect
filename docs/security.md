# CareConnect — Security Architecture

> **Phase 8 Security & Privacy Hardening**  
> Last updated: 2026-10-13  
> Status: Implemented & tested

---

## 1. Threat Model Summary

CareConnect handles personally identifiable health information (medications, appointments, profile data). The threat model prioritises:

- Credential and session hijacking
- Cross-user data leakage (IDOR)
- NoSQL injection / query operator injection
- CSRF state-changing abuse
- Automated abuse (brute-force, scraping, DoS)
- Internal data structure enumeration via error messages

---

## 2. Authentication & Session Management

| Control | Implementation | Location |
|---|---|---|
| Password hashing | bcrypt, cost factor 12 | `authController.ts` |
| Session token | JWT, HS256, 7-day expiry, issuer/audience claims | `token.ts` |
| Session delivery | HttpOnly cookie (`careconnect_token`) | `authController.ts` |
| Secure flag | `secure: true` in production, `false` in dev | `authController.ts` |
| SameSite policy | `strict` in production, `lax` in dev | `authController.ts` |
| CSRF protection | Double-submit cookie token (`careconnect_csrf_token`) | `csrfMiddleware.ts` |
| Account enumeration prevention | Identical 401 for non-existent and wrong-password | `authController.ts` |
| JWT secret minimum length | Enforced ≥ 32 chars in production | `token.ts` |

---

## 3. HTTP Security Headers (Phase 8)

Applied globally via [Helmet](https://helmetjs.github.io/) in [`index.ts`](../backend/src/index.ts):

| Header | Development | Production |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | `nosniff` |
| `X-Frame-Options` | `SAMEORIGIN` | `DENY` |
| `X-XSS-Protection` | `0` (modern) | `0` |
| `Strict-Transport-Security` | Disabled | `max-age=31536000; includeSubDomains; preload` |
| `Content-Security-Policy` | Disabled | Strict: `default-src 'self'` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | `strict-origin-when-cross-origin` |
| `X-Powered-By` | Removed | Removed |

---

## 4. NoSQL Injection Prevention (Phase 8)

A custom middleware [`sanitizeNoSql.ts`](../backend/src/middleware/sanitizeNoSql.ts) recursively strips MongoDB operator keys from all incoming requests before they reach route handlers:

- Removes any key starting with `$` (e.g. `$gt`, `$ne`, `$regex`, `$where`, `$or`)
- Removes any key containing `.` (dot-notation injection)
- Applied to: `req.body`, `req.query`, `req.params`
- Verified by Phase 8 automated tests (S1 and S8)

---

## 5. Rate Limiting (Phase 8)

Four tiered rate limiters defined in [`rateLimiter.ts`](../backend/src/middleware/rateLimiter.ts):

| Limiter | Window | Max Requests | Applied To |
|---|---|---|---|
| `authLimiter` | 15 min | 20 | `POST /api/auth/login`, `POST /api/auth/register` |
| `mutationLimiter` | 15 min | 200 | Medication CRUD, dose status, appointment CRUD |
| `searchLimiter` | 1 min | 60 | Doctor directory, availability |
| `globalApiLimiter` | 1 min | 300 | All `/api/*` routes (fallback) |

All limiters return `{ status: 'error', message: '...' }` JSON with HTTP 429.

---

## 6. CORS Configuration (Phase 8)

| Environment | Allowed Origins |
|---|---|
| Development | `FRONTEND_URL`, `localhost:5173`, `127.0.0.1:5173`, `localhost:3000` |
| Production | `FRONTEND_URL` only (set via environment variable) |

CORS errors return 403 with a sanitised message — the rejected origin is not echoed back.

---

## 7. Access Control & Ownership

All user-specific resource routes enforce strict ownership:

- Medications: `userId: req.user._id` in all queries (GET, PATCH, DELETE)
- Dose records: `userId: req.user._id` (cross-verification via medication ownership too)
- Appointments: `patientId: req.user._id` in all queries
- Notifications: `userId: req.user._id` in all queries
- User profile: operates on `req.user` (the authenticated session user)

Cross-user access returns 404 (not 403) to avoid revealing resource existence (IDOR protection).

---

## 8. Mass-Assignment Protection

The user profile update endpoint ([`userController.ts`](../backend/src/controllers/userController.ts)) maintains an explicit `PROTECTED_FIELDS` denylist:

```
['role', 'passwordHash', 'password', 'isActive', '_id', 'id']
```

Any attempt to send these fields returns HTTP 400.

---

## 9. Input Validation

| Route | Validated Fields |
|---|---|
| Auth register/login | Name, email (regex), password (min 8 chars), role lockout |
| Medication CRUD | Name, dosage, startDate/endDate (YYYY-MM-DD), timesOfDay (HH:MM) |
| Dose status | Enum: pending/taken/skipped/snoozed, snooze bounds (future, ≤24h) |
| Appointment booking | doctorId, date format, time format, past-date rejection, 60-day horizon |
| User profile | Field types, lengths, IANA timezone validation |
| ObjectId params | `mongoose.Types.ObjectId.isValid()` on all `:id` params before DB query |

---

## 10. Error Handling & Information Disclosure

[`errorHandler.ts`](../backend/src/middleware/errorHandler.ts):

- Stack traces suppressed in production
- MongoDB connection strings masked in all error messages (`sanitizeError`)
- Mongoose `ValidationError` messages replaced with generic message in production
- MongoDB E11000 (duplicate key) messages replace with generic conflict message in production
- CORS errors return generic 403, not the raw origin string

---

## 11. Data Minimisation

- `toSafeUser()` always strips `passwordHash` and `__v` before returning user objects
- User schema uses `select: true` for `passwordHash` only where needed
- Adherence stats return aggregate counts, not raw health records
- Doctor directory exposes only public fields (no patient data)

---

## 12. Worker Security

The background notification worker ([`notificationWorker.ts`](../backend/src/services/notificationWorker.ts)):

- Checks user `isActive` before delivery (skips deactivated accounts)
- Verifies notification preference per job type before delivery
- Respects quiet hours — defers rather than cancels
- Atomic MongoDB `findOneAndUpdate` prevents double-processing across worker instances
- `WORKER_ENABLED=true` environment variable required to activate (off by default)

---

## 13. Security Regression Tests

Phase 8 security tests are in [`backend/src/tests/phase8.test.ts`](../backend/src/tests/phase8.test.ts):

```
npm run test:security
```

Covers:
- S1: NoSQL injection prevention (login bypass attempts, query param injection)
- S2: CSRF enforcement (missing token, mismatched token, unauthenticated bypass)
- S3: Cross-user resource isolation (medications, doses)
- S4: Mass-assignment protection (role, passwordHash, isActive)
- S5: Authentication enforcement (7 protected endpoints)
- S6: ObjectId format validation
- S7: JWT secret minimum length enforcement
- S8: sanitizeNoSql middleware unit tests (5 cases)

**Result: 36/36 tests pass**

---

## 14. Known Limitations

- Email notifications are **simulated** — no real email provider is wired. The `SimulatedEmailProvider` logs delivery without actual SMTP/SES delivery.
- HSTS is only active in production over HTTPS. Development runs on plain HTTP.
- No automated penetration testing or dependency vulnerability scanning is included.
- This implementation does **not** claim HIPAA compliance. Health data stored is self-reported by the patient and is not connected to clinical systems.
