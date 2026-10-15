# CareConnect — Phase 10: Production Deployment Guide

## Architecture Overview

CareConnect is deployed as three independent services:

| Service | Type | Directory | Entry point |
|---------|------|-----------|-------------|
| `careconnect-api` | Web Service (Node.js) | `backend/` | `dist/index.js` |
| `careconnect-web` | Static Site | `frontend/` | `dist/` (Vite build) |
| `careconnect-worker` | Background Worker (Node.js) | `backend/` | `dist/worker.js` |

The database is **MongoDB Atlas** (cloud-managed, no self-hosted Mongo needed).

```
Browser
  │  HTTPS
  ▼
careconnect-web (Render Static CDN)
  │  HTTPS API calls to VITE_API_URL
  ▼
careconnect-api (Render Web Service)   ◄──── careconnect-worker (Render Background Worker)
  │  mongoose / mongodb+srv://                │
  ▼                                          ▼
MongoDB Atlas (cloud)  ─────────────────────┘
```

---

## Recommended Hosting: Render.com

The repository includes a [`render.yaml`](../render.yaml) Blueprint that provisions all three services automatically.

### One-time Setup

1. **Push the repo to GitHub** (already done — see `origin/main`).
2. Go to [dashboard.render.com](https://dashboard.render.com) → **New → Blueprint**.
3. Connect your GitHub repository. Render auto-detects `render.yaml`.
4. For each service, Render will prompt for **secret** environment variables (marked `sync: false` in `render.yaml`). Set:

| Variable | Service(s) | Notes |
|----------|-----------|-------|
| `MONGODB_URI` | api, worker | MongoDB Atlas connection string |
| `JWT_SECRET` | api, worker | Minimum 32 random characters |
| `FRONTEND_URL` | api | URL of `careconnect-web` after it is deployed, e.g. `https://careconnect.onrender.com` |
| `VITE_API_URL` | web | URL of `careconnect-api`, e.g. `https://careconnect-api.onrender.com/api` |

> **Generate a secure JWT_SECRET:**
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

5. Click **Apply**. Render builds and deploys all three services.

---

## Environment Variables Reference

### Backend (`backend/.env` / Render Dashboard)

See [`backend/.env.example`](../backend/.env.example) for the full annotated list.

#### Required in Production

| Variable | Example | Purpose |
|----------|---------|---------|
| `NODE_ENV` | `production` | Enables production mode |
| `MONGODB_URI` | `mongodb+srv://...` | Atlas connection string |
| `JWT_SECRET` | `<64-char hex>` | JWT signing key (≥32 chars) |
| `FRONTEND_URL` | `https://careconnect.onrender.com` | CORS allowlist |
| `TRUST_PROXY` | `true` | Enables X-Forwarded-* header trust |
| `COOKIE_SECURE` | `true` | Requires HTTPS for cookies |
| `COOKIE_SAME_SITE` | `strict` | CSRF mitigation |

#### Optional

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `5000` | Listening port (Render injects automatically) |
| `WORKER_ENABLED` | `false` | Run worker in same process (not recommended in prod) |
| `WORKER_POLL_INTERVAL_MS` | `5000` | Worker polling cadence |
| `WORKER_BATCH_SIZE` | `10` | Jobs per poll cycle |
| `WORKER_LEASE_DURATION_MS` | `60000` | Job lease timeout |
| `EMAIL_PROVIDER` | `simulated` | `smtp` for real email |
| `SMTP_HOST/USER/PASS/PORT` | — | Required when `EMAIL_PROVIDER=smtp` |
| `FROM_EMAIL` | `notifications@careconnect.app` | Sender address |

### Frontend (`frontend/.env` / Render Dashboard)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `https://careconnect-api.onrender.com/api` | Backend API base URL |

---

## MongoDB Atlas Configuration

1. **Create a cluster** at [cloud.mongodb.com](https://cloud.mongodb.com).
2. **Database Access** → Add a database user with `readWrite` on the `careconnect` database only.
3. **Network Access** → Add `0.0.0.0/0` (allow all IPs) for Render's dynamic IP pool, or use a Render static IP (paid plan) to whitelist specific CIDRs.
4. **Connection String** → Copy the `mongodb+srv://` URI and paste it as `MONGODB_URI`.
5. **Enable Atlas monitoring and alerts** for connection pool exhaustion and slow queries.

---

## Build Commands

### Backend
```bash
cd backend
npm ci          # install production + dev dependencies
npm run build   # tsc → compiles to dist/
node dist/index.js   # start API server
node dist/worker.js  # start background worker (separate process)
```

### Frontend
```bash
cd frontend
npm ci
npm run build   # vite build → dist/
# Serve dist/ with any static file server (Render CDN, Nginx, Netlify, Vercel)
```

---

## Health Checks & Monitoring

| Endpoint | Expected | Description |
|----------|----------|-------------|
| `GET /api/health` | `200 {"status":"ok"}` | Server liveness |
| `GET /api/health/db` | `200 {"status":"connected"}` | MongoDB connectivity |

Render pings `GET /api/health` every 30 seconds. A non-200 response triggers an automatic restart.

**Recommended additional monitoring:**
- [Better Uptime](https://betteruptime.com) or [UptimeRobot](https://uptimerobot.com) — free external health check pings every 5 minutes.
- MongoDB Atlas built-in performance advisor and slow-query alerts.
- Render's built-in log streaming and deploy notifications.

---

## CORS, Cookies & CSRF in Production

- The backend allows requests **only** from `FRONTEND_URL`. Any other `Origin` header is rejected with a CORS error.
- Auth cookies (`careconnect_token`) are `HttpOnly`, `Secure`, `SameSite=Strict`.
- The CSRF token cookie (`careconnect_csrf_token`) is readable by the frontend script. It is attached as `X-CSRF-Token` header on every mutating request. The backend validates it via the double-submit cookie pattern.
- `TRUST_PROXY=true` is required so that `req.secure` is `true` behind Render's TLS terminator, which ensures `Secure` cookies are set correctly.

---

## Rollback Procedure

### Render (recommended)
1. Go to **Dashboard → careconnect-api → Deploys**.
2. Find the last known-good deploy.
3. Click **Rollback to this deploy**.
4. Repeat for `careconnect-web` and `careconnect-worker`.

### Manual
```bash
# Roll back to a previous commit locally
git log --oneline -10
git revert HEAD   # or git reset --hard <commit-sha> on a branch

git push origin main
# Render auto-deploys on push
```

---

## Scaling

| Concern | Solution |
|---------|---------|
| High API traffic | Upgrade Render plan → enable autoscaling |
| Worker throughput | Increase `WORKER_BATCH_SIZE` or run multiple worker instances |
| DB read scaling | Enable MongoDB Atlas read replicas / connection pooling |
| Global latency | Upgrade to Render's multi-region or use a CDN (Cloudflare) in front of the static site |

---

## CI / CD Integration (GitHub Actions — Optional)

A minimal workflow to run tests before deploying:

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: test
      JWT_SECRET: ci-test-jwt-secret-key-32-chars-long
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend
      - run: npm ci
        working-directory: frontend
      - run: npm test
        working-directory: frontend
      - run: npm run build
        working-directory: backend
      - run: npm run build
        working-directory: frontend
```

Render watches the `main` branch and deploys automatically when CI passes.

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| `❌ JWT_SECRET must be at least 32 characters` at startup | Weak or missing `JWT_SECRET` | Generate a new 64-char hex secret and set it in the dashboard |
| `❌ FRONTEND_URL is required` at startup | Missing `FRONTEND_URL` env var in production | Set it to the deployed static site URL |
| 401 on all API requests | CORS rejection or expired cookies | Check `FRONTEND_URL` matches the browser origin exactly (no trailing slash) |
| Cookies not set | `COOKIE_SECURE=true` on HTTP | Ensure the app is served over HTTPS; `TRUST_PROXY=true` is set |
| Worker not processing jobs | `WORKER_ENABLED=false` and no separate worker service | Deploy the worker service or set `WORKER_ENABLED=true` in the API env |
| MongoDB timeout | Atlas IP allowlist too restrictive | Add `0.0.0.0/0` to Atlas Network Access (or use a static outbound IP) |
| Build fails `tsc` error | Type errors introduced after Phase 10 | Run `npm run build` locally and fix TypeScript errors before pushing |
