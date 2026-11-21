# CareConnect — Phase 14: Render Cloud Deployment & Live URL Verification

**Date:** 2026-11-21
**Phase:** 14 — Render Cloud Deployment & Live URL Verification
**Repository:** `https://github.com/rishukumar938625-ctrl/Careconnect.git`
**Branch:** `main`
**Deployment Tool:** Render Blueprint (`render.yaml`)

---

## 1. Deployment Status Overview

| Component | Service Name | Type | Configured in `render.yaml` | Cloud Status | Live Verification |
|---|---|---|---|---|---|
| **Backend API** | `careconnect-api` | Web Service (Node.js) | Yes (`rootDir: backend`) | Pending Blueprint Apply | Pending Live URL |
| **Frontend Web** | `careconnect-web` | Static Site (React/Vite) | Yes (`rootDir: frontend`) | Pending Blueprint Apply | Pending Live URL |
| **Background Worker** | `careconnect-worker` | Background Worker (Node.js) | Yes (`rootDir: backend`) | Pending Blueprint Apply | Pending Live URL |
| **Database** | MongoDB Atlas | Managed Cloud M0/M10 | Yes (`cluster0.lesmqah.mongodb.net`) | Active & Connected | Seeded & Verified |

> **Status Notice:**
> Preflight verification and production builds have passed 100% locally. The codebase is pushed to `origin/main`. Cloud deployment on Render requires creating a Blueprint instance at [dashboard.render.com](https://dashboard.render.com) linking the GitHub repository.

---

## 2. Preflight Verification Results

### Production Build Validation
- **Backend Build (`npm --prefix backend run build`):**
  - Compiler: TypeScript `tsc` (v5.4.5)
  - Target: Node.js 20 LTS (ES Modules)
  - Output: `backend/dist/index.js` (9.9 KB), `backend/dist/worker.js` (1.1 KB)
  - Result: **0 errors (Clean build)**
- **Frontend Build (`npm --prefix frontend run build`):**
  - Bundler: Vite v5.4.21 + React 18
  - Output: `frontend/dist/index.html` (0.99 KB), `frontend/dist/assets/index-*.css` (38.45 KB), `frontend/dist/assets/index-*.js` (379.09 KB / 99.03 KB gzip)
  - Result: **0 errors (Clean build)**

### Blueprint Configuration Review (`render.yaml`)
- **Backend API (`careconnect-api`):**
  - Runtime: Node.js, `rootDir: backend`
  - Build Command: `npm ci && npm run build`
  - Start Command: `node dist/index.js`
  - Health Check: `GET /api/health`
  - Proxy Trust: `TRUST_PROXY="true"`
  - Cookie Security: `COOKIE_SECURE="true"`, `COOKIE_SAME_SITE="strict"`
- **Frontend Web (`careconnect-web`):**
  - Runtime: Static, `rootDir: frontend`
  - Build Command: `npm ci && npm run build`
  - Publish Directory: `./dist`
  - Rewrite Rules: `/*` -> `/index.html` (SPA routing)
  - Headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Cache-Control headers for immutable assets
- **Background Worker (`careconnect-worker`):**
  - Runtime: Node.js, `rootDir: backend`
  - Build Command: `npm ci && npm run build`
  - Start Command: `node dist/worker.js`
  - Cadence: 5,000ms polling, 60s lease duration, 10 jobs/batch

---

## 3. Environment Configuration Checklist

*(Note: In accordance with security requirements, secret values and private credentials are never printed or committed.)*

| Variable | Target Service | Setting Method | Verification Check |
|---|---|---|---|
| `NODE_ENV` | `api`, `worker` | `render.yaml` (`production`) | Set automatically |
| `PORT` | `api` | Render runtime (`10000`) | Set automatically |
| `TRUST_PROXY` | `api` | `render.yaml` (`true`) | Set automatically |
| `COOKIE_SECURE` | `api` | `render.yaml` (`true`) | Set automatically |
| `COOKIE_SAME_SITE` | `api` | `render.yaml` (`strict`) | Set automatically |
| `EMAIL_PROVIDER` | `api`, `worker` | `render.yaml` (`simulated`) | Set automatically |
| `MONGODB_URI` | `api`, `worker` | Render Dashboard Prompt (`sync: false`) | Atlas connection string (`mongodb+srv://...`) |
| `JWT_SECRET` | `api`, `worker` | Render Dashboard Prompt (`sync: false`) | Cryptographic secret (>= 32 chars) |
| `FRONTEND_URL` | `api` | Render Dashboard Prompt (`sync: false`) | Deployed frontend origin (e.g. `https://careconnect-web.onrender.com`) |
| `VITE_API_URL` | `web` | Render Dashboard Prompt (`sync: false`) | Deployed backend API base URL (e.g. `https://careconnect-api.onrender.com/api`) |
| `WORKER_ENABLED` | `api` | `render.yaml` (`false`) / or `true` if co-hosting | Configured |
| `WORKER_ENABLED` | `worker` | `render.yaml` (`true`) | Configured |

---

## 4. Render Blueprint Deployment Walkthrough

To launch CareConnect into staging/production on Render:

1. **Log in to Render Dashboard:**
   - Open [dashboard.render.com](https://dashboard.render.com).
2. **Create a Blueprint Instance:**
   - Click **New +** (top right) -> **Blueprint**.
   - Select your connected GitHub account and choose repository: `rishukumar938625-ctrl/Careconnect`.
   - Render detects `render.yaml` and parses the 3 services (`careconnect-api`, `careconnect-web`, `careconnect-worker`).
3. **Configure Secrets in the Render Prompt:**
   - `MONGODB_URI`: Paste your MongoDB Atlas connection string.
   - `JWT_SECRET`: Generate a secure 64-character secret using:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `FRONTEND_URL`: Enter the static site URL (Render shows the default subdomain, e.g., `https://careconnect-web.onrender.com`).
   - `VITE_API_URL`: Enter the backend API URL (e.g., `https://careconnect-api.onrender.com/api`).
4. **Worker Plan Selection:**
   - If using the **Render Free Tier**, Render Background Workers are a paid resource ($7/mo). If you wish to stay 100% on the Free Tier:
     - Set `WORKER_ENABLED="true"` on `careconnect-api` Web Service environment variables.
     - You can suspend or omit `careconnect-worker` so the background worker runs directly inside the API instance.
5. **Click "Apply":**
   - Render will build and deploy the services.

---

## 5. MongoDB Atlas Network Access Requirement

Before the Render services can reach MongoDB Atlas:
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) -> **Security** -> **Network Access**.
2. Click **Add IP Address**.
3. Select **Allow Access from Anywhere** (`0.0.0.0/0`) or enter Render's outbound static IP addresses if using an upgraded plan.
4. Save the entry (takes ~30 seconds to propagate).

---

## 6. Live Service Verification Checklist (Post-Deployment)

Once Render assigns live URLs, verify the following endpoints:

### Health Checks
- [ ] **API Liveness Probe:** `GET https://<api-url>/api/health` -> HTTP 200 `{"status":"ok"}`
- [ ] **Database Connectivity:** `GET https://<api-url>/api/health/db` -> HTTP 200 `{"status":"connected","database":"connected","readyState":1}`
- [ ] **Frontend Loading:** `GET https://<web-url>` -> HTTP 200 and loads CareConnect dashboard without console errors.

### Live User Journey Verification (Synthetic Data)
- [ ] **Authentication:** Register synthetic patient, verify session cookie, log in, log out.
- [ ] **Profile:** Update health profile (allergies, emergency contacts, conditions).
- [ ] **Health Information:** Browse conditions, medicines, articles; toggle bookmarks.
- [ ] **Medication Lifecycle:** Add medication, verify today's dose, mark dose as taken, verify adherence tracking.
- [ ] **Appointments:** Search doctors, check availability slot, book appointment, verify double-booking prevention (`409 Conflict`), reschedule, cancel.
- [ ] **Data Isolation:** Verify Patient A cannot view or modify Patient B's records.
- [ ] **Notification Delivery:** Verify in-app notifications and background worker job processing.

---

## 7. Remaining Blockers & Next Action

- **Action Required:** User triggers the Render Blueprint deployment on [dashboard.render.com](https://dashboard.render.com).
- **Following Step:** Once deployed, provide the assigned Render URLs (e.g. `https://careconnect-api.onrender.com` and `https://careconnect-web.onrender.com`) to execute the live automated verification tests.
