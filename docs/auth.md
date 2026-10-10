# CareConnect — Phase 3: Secure User Authentication Documentation

## 1. Authentication Architecture

CareConnect uses an enterprise-grade, cookie-based session architecture powered by JSON Web Tokens (JWT) and Double-Submit CSRF protection:

* **Session Credential:** Signed JWT stored exclusively in an `HttpOnly`, `SameSite`, and `Secure` (production) cookie named `careconnect_token`.
* **Zero Storage Leakage:** Tokens and session identifiers are **never** stored in `localStorage`, `sessionStorage`, or window global variables.
* **Password Hashing:** Passwords hashed with `bcryptjs` using a cost factor of 12 with automatic cryptographic salting.
* **CSRF Mitigation:** Double-Submit Cookie pattern with cryptographic 256-bit random tokens via `careconnect_csrf_token` cookie and `X-CSRF-Token` HTTP headers for state-changing operations (`POST`, `PUT`, `PATCH`, `DELETE`).
* **Brute-Force Defense:** Rate limiting on `/api/auth/login` and `/api/auth/register` (20 attempts per 15-minute window per IP) using `express-rate-limit`.
* **Account Enumeration Defense:** Generic `"Invalid email or password."` response for all failed login attempts; normalized email lowercasing.
* **Role Safety:** Public registration strictly forces the `patient` role. Attempts to submit privileged roles (`admin`, `doctor`) are rejected with `400 Bad Request`.

---

## 2. Environment Variables

Configure the following variables in `.env` or `backend/.env`. Use placeholders only in `.env.example`:

```env
# Server Runtime
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

# Database Connection
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.usdcl3x.mongodb.net/careconnect?retryWrites=true&w=majority

# Phase 3 Authentication Secret
# Must be a cryptographically strong random string in production (>= 32 characters)
JWT_SECRET=your_jwt_signing_secret_here

# Frontend Environment (Vite)
VITE_API_URL=http://localhost:5000/api
```

---

## 3. Endpoints Implemented

| Method | Path | Auth Required | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | No (Rate limited) | Registers new patient account, sets session cookies |
| `POST` | `/api/auth/login` | No (Rate limited) | Authenticates user, verifies bcrypt hash, sets session cookies |
| `POST` | `/api/auth/logout` | No | Clears `careconnect_token` and `careconnect_csrf_token` cookies |
| `GET` | `/api/auth/me` | Yes (`authenticate`) | Validates cookie, returns safe user payload and active CSRF token |
| `GET` | `/api/user/profile` | Yes (`authenticate`) | Returns safe authenticated user profile |
| `PUT` | `/api/user/profile` | Yes (`authenticate` + CSRF) | Updates permitted fields (`name`, `phone`, `bloodGroup`, `allergies`, `emergencyContact`) |
| `PATCH` | `/api/user/notifications`| Yes (`authenticate` + CSRF) | Updates notification toggles |
| `POST` | `/api/articles/:slug/bookmark` | Yes (`authenticate` + CSRF) | Toggles article bookmark isolated to the authenticated user |
| `POST` | `/api/conditions/:slug/bookmark`| Yes (`authenticate` + CSRF)| Toggles condition bookmark isolated to the authenticated user |
| `POST` | `/api/medicines/:slug/bookmark` | Yes (`authenticate` + CSRF)| Toggles medicine bookmark isolated to the authenticated user |

---

## 4. Local Development Instructions

### Starting the Backend
```bash
npm run dev:backend
# or directly in backend/:
cd backend && npm run dev
```

### Starting the Frontend
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` and communicate with the backend at `http://localhost:5000/api`.

---

## 5. How to Run Tests

Phase 3 includes an automated 13-point test suite using `MongoMemoryServer` for isolated execution without affecting production data:

```bash
# Run backend tests
npm run test

# Run full project builds and linter
npm run build
npm run lint
```

---

## 6. How to Register, Log In, and Log Out

1. **Register:** Visit `/register`, enter Full Name, Email, Password (minimum 8 characters), and Confirm Password. Click **Create account**.
2. **Log In:** Visit `/login`, enter registered Email and Password. Upon submission, an `HttpOnly` cookie is set and you are securely redirected to your target destination or `/dashboard`.
3. **Session Refresh:** On application startup, `AuthProvider` automatically checks `GET /api/auth/me` with `credentials: 'include'`.
4. **Log Out:** Click **Sign out** in the sidebar or profile page to clear authentication cookies.

---

## 7. Current Scope & Remaining Limitations

* **Phase 3 Scope:** User authentication, password encryption, cookie sessions, user profiles, and user-isolated bookmarks.
* **Future Phases:**
  * Multi-factor authentication (MFA/TOTP).
  * Password reset via email verification token.
  * Role-based clinical workflow for `doctor` and `admin` portals.
