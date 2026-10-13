# CareConnect

CareConnect is a modern healthcare web application designed to help patients manage medications, book clinical appointments, and access certified educational health information.

## Tech Stack

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React
* **Backend:** Node.js, Express, TypeScript, Mongoose
* **Database:** MongoDB Atlas
* **Authentication:** Encrypted JWT with `HttpOnly` Secure Cookies, `bcryptjs` hashing, and Double-Submit CSRF protection

---

## Project Structure

The repository is organized into distinct `frontend/` and `backend/` applications with root orchestration:

```
careconnect/
├── backend/                  # Express API backend application
│   ├── src/
│   │   ├── config/           # MongoDB Atlas connection & health probes
│   │   ├── controllers/      # Appointment, auth, doctor, dose, medication, health controllers
│   │   ├── middleware/       # Authentication, CSRF, rate limiter, error handling
│   │   ├── models/           # Mongoose schemas (User, Doctor, Appointment, Medication, DoseRecord, etc.)
│   │   ├── routes/           # Route definitions (/api/appointments, /api/auth, /api/doctors, etc.)
│   │   ├── seed/             # Educational content & demo doctor seeders
│   │   ├── tests/            # Automated integration test suites (Auth, Medication, Appointments)
│   │   ├── types/            # Backend TypeScript definitions
│   │   ├── utils/            # Availability calculations, token signing, pagination helpers
│   │   └── index.ts          # Express server entry point
│   ├── .env.example          # Backend environment template
│   ├── package.json          # Backend dependencies & scripts
│   └── tsconfig.json         # Backend TypeScript configuration
├── frontend/                 # Vite React frontend application
│   ├── public/               # Static assets & favicon
│   ├── src/
│   │   ├── components/       # Layout, appointments, medications, health, auth components
│   │   ├── context/          # AuthContext session provider
│   │   ├── pages/            # Dashboard, Appointments, BookAppointment, Doctors, Medications, etc.
│   │   ├── services/         # API clients with credentials & CSRF token forwarding
│   │   ├── types/            # Frontend interfaces & DTOs
│   │   ├── App.tsx           # Router & protected route definitions
│   │   └── main.tsx          # Application root
│   ├── .env.example          # Frontend environment template
│   ├── index.html            # Vite entry HTML
│   ├── package.json          # Frontend dependencies & scripts
│   ├── postcss.config.js     # PostCSS configuration
│   ├── tailwind.config.js    # Tailwind CSS design tokens
│   ├── tsconfig.json         # Frontend TypeScript configuration
│   └── vite.config.ts        # Vite dev server & proxy configuration
├── docs/                     # Architecture & authentication specifications
│   └── auth.md
├── .env.example              # Unified environment variable template
├── .gitignore                # Git ignore configuration
├── package.json              # Root orchestration scripts
└── README.md
```

---

## Prerequisites

* **Node.js:** v18.0.0 or higher
* **npm:** v9.0.0 or higher
* **MongoDB:** MongoDB Atlas cluster or local MongoDB instance

---

## Installation

Install all dependencies across the workspace using the root command:

```bash
npm run install:all
```

Or install frontend and backend individually:

```bash
# Frontend dependencies
cd frontend && npm install

# Backend dependencies
cd backend && npm install
```

---

## Environment Configuration

### 1. Backend Setup
Copy `backend/.env.example` to `backend/.env` (or configure the root `.env`):

```bash
cp backend/.env.example backend/.env
```

Set the required environment variables:
* `PORT`: Server port (default: `5000`)
* `NODE_ENV`: Runtime environment (`development` or `production`)
* `FRONTEND_URL`: Client URL for CORS whitelist (default: `http://localhost:5173`)
* `MONGODB_URI`: MongoDB connection string
* `JWT_SECRET`: Cryptographically strong signing key (>= 32 characters)

### 2. Frontend Setup
Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

Set the API endpoint:
* `VITE_API_URL`: Backend API base URL (default: `http://localhost:5000/api`)

*(Note: Never commit `.env` files containing real secrets to source control.)*

---

## Development Scripts

### Starting the Applications

* **Start both frontend and backend concurrently:**
  ```bash
  npm run dev
  ```
* **Start only the frontend (Vite on `http://localhost:5173`):**
  ```bash
  npm run dev:frontend
  ```
* **Start only the backend (Express on `http://localhost:5000` / `5001`):**
  ```bash
  npm run dev:backend
  ```
* **Start the background notification worker standalone:**
  ```bash
  npm run worker
  ```

---

## Testing & Quality Assurance

Run the comprehensive test suite (73 automated tests across Auth, Medication, Appointments, Profile, and Notifications):

```bash
# Run all backend automated integration tests (all phases)
npm run test

# Run individual test suites
npm run test:auth           # Phase 3: Auth & session tests (13 tests)
npm run test:medication     # Phase 4: Medication & dose tests (11 tests)
npm run test:appointment    # Phase 5: Doctor directory & appointments (13 tests)
npm run test:profile        # Phase 6: Profile & health profile (16 tests)
npm run test:notifications  # Phase 7: Notification delivery & worker (20 tests)
```

Run code formatting and type checks:

```bash
# Lint frontend code
npm run lint

# Build both applications for production
npm run build

# Build individual applications
npm run build:frontend
npm run build:backend
```

---

## Database Seeding

Populate development data safely:

```bash
# Seed synthetic demo doctors (idempotent, clearly labeled demo profiles)
npm run seed:doctors

# Seed educational health articles and condition guides (idempotent)
npm run seed:health
```

---

## Architecture & Documentation

* **Authentication & Session Security:** [docs/auth.md](docs/auth.md)
* **Notification Delivery & Background Jobs:** [docs/notifications.md](docs/notifications.md)

* **API Base URL:** The frontend communicates with the backend via `frontend/src/services/api.ts` using `VITE_API_URL` (default: `http://localhost:5000/api`).
* **Vite Proxy:** `frontend/vite.config.ts` includes a dev proxy for `/api` targeting `http://localhost:5000`.
* **CORS & Credentials:** The Express backend configures `cors` with `credentials: true` allowing requests from `http://localhost:5173`.
* **Cookie-Based Sessions:** The session token (`careconnect_token`) is stored in an `HttpOnly` cookie.
* **Double-Submit CSRF:** All state-modifying requests (`POST`, `PUT`, `PATCH`, `DELETE`) include an `X-CSRF-Token` header matching the `careconnect_csrf_token` cookie.
