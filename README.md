# CareConnect

CareConnect is a modern healthcare web application designed to help patients manage medications, book clinical appointments, and access certified educational health information.

## Tech Stack

* **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React
* **Backend:** Node.js, Express, TypeScript, Mongoose
* **Database:** MongoDB Atlas
* **Authentication (Phase 3):** Encrypted JWT with `HttpOnly` Secure Cookies, `bcryptjs` hashing, and Double-Submit CSRF protection

## Project Structure

```
careconnect/
├── docs/                 # Documentation (Phase 3 Auth, setup, architecture)
├── public/               # Public assets and favicon
├── server/               # Express backend application
│   ├── src/
│   │   ├── config/       # MongoDB connection & status
│   │   ├── controllers/  # Auth, user, health, conditions, medicines, articles
│   │   ├── middleware/   # Authentication, authorization, CSRF, rate-limiting, error handling
│   │   ├── models/       # Mongoose schemas (User, Article, Condition, Medicine, etc.)
│   │   ├── routes/       # Express route definitions (/api/auth, /api/user, etc.)
│   │   ├── seed/         # Educational health data seeders
│   │   ├── tests/        # Isolated integration test suites
│   │   └── utils/        # Token generation, sanitization, pagination
│   └── package.json
├── src/                  # React frontend application
│   ├── components/       # UI primitives, layout, cards, navigation, protected routes
│   ├── context/          # AuthContext and centralized state
│   ├── pages/            # Login, Register, Profile, Dashboard, Health, etc.
│   ├── services/         # API clients with credentialed fetch & CSRF handling
│   └── types/            # Application-wide TypeScript definitions
├── package.json
└── vite.config.ts
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
npm --prefix server install
```

### 2. Environment Variables
Copy `.env.example` to `.env` and `server/.env.example` to `server/.env`. Fill in:
* `MONGODB_URI`
* `JWT_SECRET`

### 3. Run Development Servers
```bash
# Terminal 1: Backend
npm run server

# Terminal 2: Frontend
npm run dev
```

### 4. Run Automated Tests
```bash
npm run server:test
```

### 5. Validate Builds & Lint
```bash
npm run build
npm run server:build
npm run lint
```

For complete authentication specifications, see [docs/auth.md](docs/auth.md).
