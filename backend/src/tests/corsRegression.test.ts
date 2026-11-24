/**
 * CORS Regression Test Suite
 *
 * Verifies:
 *  1. Allowed local dev frontend origin (http://localhost:5173)
 *  2. Allowed Vite fallback port origin (http://localhost:5174)
 *  3. Allowed 127.0.0.1 origin
 *  4. Rejected unapproved external origin
 *  5. Requests with no Origin header (server-to-server, curl)
 *  6. Allowed production frontend origin via FRONTEND_URL
 *  7. Credentialed requests include Access-Control-Allow-Credentials
 *  8. OPTIONS preflight returns correct headers
 *  9. Registration and login through the configured API route with Origin
 * 10. CORS error handler returns 403 for blocked origins
 */

import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer;
let server: http.Server;
let baseUrl: string;

const FRONTEND_ORIGIN = 'http://localhost:5173';
const PROD_FRONTEND_ORIGIN = 'https://careconnect-web.onrender.com';

/** Minimal Express app that replicates the production CORS configuration */
function createApp(nodeEnv: string, frontendUrl: string) {
  const app = express();

  const devOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:5175',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];
  const allowedOrigins: string[] = (
    nodeEnv === 'production'
      ? [frontendUrl]
      : [frontendUrl, ...devOrigins]
  ).filter(Boolean);

  function isAllowedOrigin(origin: string): boolean {
    if (allowedOrigins.includes(origin)) return true;
    if (nodeEnv !== 'production') {
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          return true;
        }
      } catch {
        // malformed
      }
    }
    return false;
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, origin || true);
        } else {
          callback(new Error(`Origin ${origin} not allowed by CORS`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'x-csrf-token'],
    })
  );

  app.use(cookieParser());
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/auth/login', (req, res) => {
    res.json({ status: 'success', message: 'Signed in successfully.', user: { email: req.body?.email } });
  });

  app.post('/api/auth/register', (req, res) => {
    res.status(201).json({ status: 'success', user: { email: req.body?.email } });
  });

  // CORS error handler (mirrors production errorHandler.ts)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.message && err.message.includes('not allowed by CORS')) {
      res.status(403).json({ status: 'error', message: 'Cross-Origin Request Blocked: Origin not permitted' });
      return;
    }
    res.status(500).json({ status: 'error', message: err.message });
  });

  return app;
}

/** Make an HTTP request with explicit headers */
function request(
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: data }));
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ': ' + detail : ''}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Starting CORS Regression Test Suite...\n');

  // ── Setup ────────────────────────────────────────────────────────────────
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  // ── Development mode tests ───────────────────────────────────────────────
  console.log('=== Development Mode ===');

  const devApp = createApp('development', FRONTEND_ORIGIN);
  server = await new Promise<http.Server>((resolve) => {
    const s = devApp.listen(0, () => resolve(s));
  });
  const addr = server.address() as import('net').AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}`;

  // Test 1: Allowed dev origin (5173)
  console.log('Test 1: Allowed local dev origin (http://localhost:5173)');
  {
    const res = await request('GET', '/api/health', { Origin: 'http://localhost:5173' });
    assert(res.status === 200, 'Status is 200');
    assert(
      res.headers['access-control-allow-origin'] === 'http://localhost:5173',
      'Access-Control-Allow-Origin echoes origin',
      `Got: ${res.headers['access-control-allow-origin']}`
    );
    assert(res.headers['access-control-allow-credentials'] === 'true', 'Credentials header is true');
  }

  // Test 2: Allowed Vite fallback port (5174)
  console.log('Test 2: Allowed Vite fallback port origin (http://localhost:5174)');
  {
    const res = await request('GET', '/api/health', { Origin: 'http://localhost:5174' });
    assert(res.status === 200, 'Status is 200');
    assert(
      res.headers['access-control-allow-origin'] === 'http://localhost:5174',
      'Access-Control-Allow-Origin echoes fallback port origin',
      `Got: ${res.headers['access-control-allow-origin']}`
    );
  }

  // Test 3: Allowed 127.0.0.1 origin
  console.log('Test 3: Allowed 127.0.0.1 origin (any port)');
  {
    const res = await request('GET', '/api/health', { Origin: 'http://127.0.0.1:8080' });
    assert(res.status === 200, 'Status is 200');
    assert(
      res.headers['access-control-allow-origin'] === 'http://127.0.0.1:8080',
      'Access-Control-Allow-Origin echoes 127.0.0.1 origin',
      `Got: ${res.headers['access-control-allow-origin']}`
    );
  }

  // Test 4: Rejected unapproved external origin (dev mode — only localhost/127.0.0.1 pass)
  console.log('Test 4: Rejected unapproved external origin');
  {
    const res = await request('GET', '/api/health', { Origin: 'https://evil-site.example.com' });
    assert(res.status === 403, 'Status is 403', `Got: ${res.status}`);
    assert(
      !res.headers['access-control-allow-origin'],
      'No Access-Control-Allow-Origin header',
      `Got: ${res.headers['access-control-allow-origin']}`
    );
    const body = JSON.parse(res.body);
    assert(body.message.includes('Origin not permitted'), 'Error message mentions origin not permitted');
  }

  // Test 5: No Origin header (curl, server-to-server)
  console.log('Test 5: Requests with no Origin header');
  {
    const res = await request('GET', '/api/health');
    assert(res.status === 200, 'Status is 200');
  }

  // Test 6: OPTIONS preflight with valid origin
  console.log('Test 6: OPTIONS preflight returns correct headers');
  {
    const res = await request('OPTIONS', '/api/auth/login', {
      Origin: 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, X-CSRF-Token',
    });
    assert(res.status === 204 || res.status === 200, 'Preflight status is 200 or 204', `Got: ${res.status}`);
    assert(
      res.headers['access-control-allow-origin'] === 'http://localhost:5173',
      'Preflight echoes origin'
    );
    assert(res.headers['access-control-allow-credentials'] === 'true', 'Preflight includes credentials');
    const allowedMethods = (res.headers['access-control-allow-methods'] || '') as string;
    assert(allowedMethods.includes('POST'), 'Preflight allows POST method');
  }

  // Test 7: Credentialed login request with Origin
  console.log('Test 7: Login request with correct Origin');
  {
    const res = await request(
      'POST',
      '/api/auth/login',
      { Origin: 'http://localhost:5173' },
      JSON.stringify({ email: 'test@example.com', password: 'pass' })
    );
    assert(res.status === 200, 'Login status is 200');
    assert(res.headers['access-control-allow-credentials'] === 'true', 'Credentials header present');
    const body = JSON.parse(res.body);
    assert(body.status === 'success', 'Login response is success');
  }

  // Test 8: Register request with Origin
  console.log('Test 8: Register request with correct Origin');
  {
    const res = await request(
      'POST',
      '/api/auth/register',
      { Origin: 'http://localhost:5173' },
      JSON.stringify({ name: 'Test', email: 'test@example.com', password: 'pass' })
    );
    assert(res.status === 201, 'Register status is 201');
    assert(res.headers['access-control-allow-credentials'] === 'true', 'Credentials header present');
  }

  // Close dev server
  await new Promise<void>((resolve) => server.close(() => resolve()));

  // ── Production mode tests ────────────────────────────────────────────────
  console.log('\n=== Production Mode ===');

  const prodApp = createApp('production', PROD_FRONTEND_ORIGIN);
  server = await new Promise<http.Server>((resolve) => {
    const s = prodApp.listen(0, () => resolve(s));
  });
  const prodAddr = server.address() as import('net').AddressInfo;
  baseUrl = `http://127.0.0.1:${prodAddr.port}`;

  // Test 9: Allowed production frontend origin
  console.log('Test 9: Allowed production frontend origin');
  {
    const res = await request('GET', '/api/health', { Origin: PROD_FRONTEND_ORIGIN });
    assert(res.status === 200, 'Status is 200');
    assert(
      res.headers['access-control-allow-origin'] === PROD_FRONTEND_ORIGIN,
      'Access-Control-Allow-Origin echoes production origin',
      `Got: ${res.headers['access-control-allow-origin']}`
    );
  }

  // Test 10: Rejected localhost in production mode
  console.log('Test 10: Rejected localhost in production mode');
  {
    const res = await request('GET', '/api/health', { Origin: 'http://localhost:5173' });
    assert(res.status === 403, 'Status is 403', `Got: ${res.status}`);
    assert(
      !res.headers['access-control-allow-origin'],
      'No ACAO header for rejected origin'
    );
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  await mongod.stop();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} CORS REGRESSION TESTS PASSED!`);
  } else {
    console.log(`❌ ${failed} CORS TEST(S) FAILED, ${passed} passed`);
  }
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
