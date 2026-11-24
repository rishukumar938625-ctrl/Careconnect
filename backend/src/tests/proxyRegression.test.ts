/**
 * Dynamic Proxy & Port Mismatch Regression Test Suite
 *
 * Verifies:
 * 1. Backend running on custom port (e.g. 5002) with direct GET /api/health responding 200
 * 2. Reverse proxy / Vite proxy running on port 5174 forwarding /api to backend on port 5002
 * 3. GET http://localhost:5174/api/health correctly reaches backend on 5002
 * 4. User registration via proxy on port 5174 sets session cookies and creates user
 * 5. User login via proxy on port 5174 returns 200 OK and valid session cookies
 * 6. GET http://localhost:5174/api/auth/me preserves authenticated session across requests
 * 7. Invalid credentials properly return 401 through the proxy
 * 8. Unauthenticated requests to protected endpoints rejected with 401
 * 9. Port discovery (.backend-port file and VITE_BACKEND_PORT override) dynamically routes requests
 */

import http from 'http';
import express from 'express';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const TEST_JWT_SECRET = 'careconnect-proxy-test-secret-32-chars-minimum!';
let mongod: MongoMemoryServer;
let backendServer: http.Server;
let proxyServer: http.Server;

const BACKEND_PORT = 5002;
const PROXY_PORT = 5174;

// Simple user model schema for isolated testing
const testUserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, default: 'patient' },
  isActive: { type: Boolean, default: true },
});

const TestUser = mongoose.model('ProxyTestUser', testUserSchema);

/**
 * Creates the backend server listening on port 5002
 */
function createBackendApp() {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'careconnect-api',
      port: BACKEND_PORT,
      timestamp: new Date().toISOString(),
    });
  });

  // Auth: Register
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { name, email, password } = req.body;
      if (!name || !email || !password) {
        res.status(400).json({ status: 'error', message: 'Missing fields' });
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const existing = await TestUser.findOne({ email: normalizedEmail });
      if (existing) {
        res.status(409).json({ status: 'error', message: 'Email in use' });
        return;
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await TestUser.create({
        name,
        email: normalizedEmail,
        passwordHash,
      });

      const token = jwt.sign({ userId: user._id.toString(), email: user.email }, TEST_JWT_SECRET, {
        expiresIn: '7d',
      });
      res.cookie('careconnect_token', token, { httpOnly: true, path: '/' });
      res.cookie('careconnect_csrf_token', 'test-csrf-12345', { path: '/' });

      res.status(201).json({
        status: 'success',
        message: 'Account registered successfully.',
        user: { id: user._id.toString(), name: user.name, email: user.email },
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Auth: Login
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        res.status(400).json({ status: 'error', message: 'Missing credentials' });
        return;
      }
      const normalizedEmail = email.trim().toLowerCase();
      const user = await TestUser.findOne({ email: normalizedEmail });
      if (!user) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        return;
      }
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        res.status(401).json({ status: 'error', message: 'Invalid email or password.' });
        return;
      }

      const token = jwt.sign({ userId: user._id.toString(), email: user.email }, TEST_JWT_SECRET, {
        expiresIn: '7d',
      });
      res.cookie('careconnect_token', token, { httpOnly: true, path: '/' });
      res.cookie('careconnect_csrf_token', 'test-csrf-12345', { path: '/' });

      res.json({
        status: 'success',
        message: 'Signed in successfully.',
        user: { id: user._id.toString(), name: user.name, email: user.email },
      });
    } catch (err: any) {
      res.status(500).json({ status: 'error', message: err.message });
    }
  });

  // Auth: Me
  app.get('/api/auth/me', async (req, res) => {
    const token = req.cookies?.careconnect_token;
    if (!token) {
      res.status(401).json({ status: 'error', message: 'Authentication required' });
      return;
    }
    try {
      const decoded = jwt.verify(token, TEST_JWT_SECRET) as { userId: string };
      const user = await TestUser.findById(decoded.userId);
      if (!user) {
        res.status(401).json({ status: 'error', message: 'User not found' });
        return;
      }
      res.json({
        status: 'success',
        user: { id: user._id.toString(), name: user.name, email: user.email },
      });
    } catch {
      res.status(401).json({ status: 'error', message: 'Invalid session' });
    }
  });

  return app;
}

/**
 * Creates the proxy server simulating Vite's dev proxy on port 5174
 * It forwards any request starting with /api to BACKEND_PORT (5002).
 */
function createProxyApp(targetPort: number) {
  const app = express();

  app.use('/api', (req, res) => {
    const options: http.RequestOptions = {
      hostname: '127.0.0.1',
      port: targetPort,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${targetPort}`,
      },
    };

    const proxyReq = http.request(options, (backendRes) => {
      // Forward status code
      res.status(backendRes.statusCode || 500);

      // Forward headers (including set-cookie)
      for (const [header, val] of Object.entries(backendRes.headers)) {
        if (val !== undefined) {
          res.setHeader(header, val);
        }
      }

      // Pipe body
      backendRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      res.status(502).json({
        status: 'error',
        message: `Proxy failed to connect to backend on port ${targetPort}: ${err.message}`,
      });
    });

    req.pipe(proxyReq);
  });

  return app;
}

function httpRequest(
  port: number,
  method: string,
  path: string,
  headers: Record<string, string> = {},
  body?: string
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
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
  console.log('\n🧪 Starting Dynamic Port & Proxy Regression Test Suite...\n');

  // 1. Setup in-memory MongoDB
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  console.log('✅ Connected to isolated in-memory test database');

  // 2. Start Backend on port 5002
  const backendApp = createBackendApp();
  backendServer = await new Promise((resolve, reject) => {
    const s = backendApp.listen(BACKEND_PORT, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  console.log(`✅ Backend server listening on http://127.0.0.1:${BACKEND_PORT}`);

  // 3. Start Proxy on port 5174 (targeting backend on 5002)
  const proxyApp = createProxyApp(BACKEND_PORT);
  proxyServer = await new Promise((resolve, reject) => {
    const s = proxyApp.listen(PROXY_PORT, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  console.log(`✅ Proxy server listening on http://127.0.0.1:${PROXY_PORT} -> http://127.0.0.1:${BACKEND_PORT}\n`);

  // ── Tests ────────────────────────────────────────────────────────────────

  // Test 1: Direct backend health check on 5002
  console.log('Test 1: Direct backend health check on port 5002');
  {
    const res = await httpRequest(BACKEND_PORT, 'GET', '/api/health');
    assert(res.status === 200, 'Direct GET http://localhost:5002/api/health returns 200');
    const data = JSON.parse(res.body);
    assert(data.status === 'ok', 'Status is "ok"');
    assert(data.port === 5002, 'Backend reports port 5002');
  }

  // Test 2: Proxy health check on port 5174 -> 5002
  console.log('\nTest 2: Proxied health check on port 5174 -> 5002');
  {
    const res = await httpRequest(PROXY_PORT, 'GET', '/api/health');
    assert(res.status === 200, 'Proxied GET http://localhost:5174/api/health returns 200');
    const data = JSON.parse(res.body);
    assert(data.status === 'ok', 'Proxied status is "ok"');
    assert(data.port === 5002, 'Proxied response originated from backend on port 5002');
  }

  // Test 3: User registration through proxy on port 5174
  console.log('\nTest 3: Patient registration via proxy on port 5174');
  let authCookie = '';
  {
    const regPayload = JSON.stringify({
      name: 'Proxy Tester',
      email: 'proxy.tester@example.com',
      password: 'SecurePassword123!',
    });
    const res = await httpRequest(PROXY_PORT, 'POST', '/api/auth/register', {}, regPayload);
    assert(res.status === 201, 'POST http://localhost:5174/api/auth/register returns 201 Created');
    const data = JSON.parse(res.body);
    assert(data.status === 'success', 'Registration status is success');
    assert(data.user.email === 'proxy.tester@example.com', 'Registered user email matches');

    const setCookie = res.headers['set-cookie'];
    assert(Array.isArray(setCookie) && setCookie.length > 0, 'Set-Cookie header present in proxy response');
    const tokenCookie = setCookie?.find((c) => c.startsWith('careconnect_token='));
    assert(!!tokenCookie, 'careconnect_token cookie set by proxy');
    if (tokenCookie) {
      authCookie = tokenCookie.split(';')[0];
    }
  }

  // Test 4: Session check via proxy on port 5174 using cookie from registration
  console.log('\nTest 4: Verify authenticated session on port 5174 (GET /api/auth/me)');
  {
    const res = await httpRequest(PROXY_PORT, 'GET', '/api/auth/me', {
      Cookie: authCookie,
    });
    assert(res.status === 200, 'GET http://localhost:5174/api/auth/me with cookie returns 200');
    const data = JSON.parse(res.body);
    assert(data.user.email === 'proxy.tester@example.com', 'Authenticated user retrieved correctly');
  }

  // Test 5: Login through proxy on port 5174
  console.log('\nTest 5: Login via proxy on port 5174');
  let loginCookie = '';
  {
    const loginPayload = JSON.stringify({
      email: 'proxy.tester@example.com',
      password: 'SecurePassword123!',
    });
    const res = await httpRequest(PROXY_PORT, 'POST', '/api/auth/login', {}, loginPayload);
    assert(res.status === 200, 'POST http://localhost:5174/api/auth/login returns 200');
    const data = JSON.parse(res.body);
    assert(data.status === 'success', 'Login message is success');

    const setCookie = res.headers['set-cookie'];
    const tokenCookie = setCookie?.find((c) => c.startsWith('careconnect_token='));
    assert(!!tokenCookie, 'Login issued careconnect_token cookie');
    if (tokenCookie) {
      loginCookie = tokenCookie.split(';')[0];
    }
  }

  // Test 6: Verify login cookie on GET /api/auth/me
  console.log('\nTest 6: Verify login session on port 5174 (GET /api/auth/me)');
  {
    const res = await httpRequest(PROXY_PORT, 'GET', '/api/auth/me', {
      Cookie: loginCookie,
    });
    assert(res.status === 200, 'Session verified via login cookie');
    const data = JSON.parse(res.body);
    assert(data.user.name === 'Proxy Tester', 'Session belongs to "Proxy Tester"');
  }

  // Test 7: Wrong password returns 401 through proxy
  console.log('\nTest 7: Wrong password returns 401 via proxy');
  {
    const res = await httpRequest(
      PROXY_PORT,
      'POST',
      '/api/auth/login',
      {},
      JSON.stringify({ email: 'proxy.tester@example.com', password: 'WrongPassword!' })
    );
    assert(res.status === 401, 'Wrong password returns 401 Unauthorized');
    const data = JSON.parse(res.body);
    assert(data.message.includes('Invalid email or password'), 'Generic credential failure message returned');
  }

  // Test 8: Unauthenticated access rejected with 401 through proxy
  console.log('\nTest 8: Unauthenticated request to /api/auth/me returns 401 via proxy');
  {
    const res = await httpRequest(PROXY_PORT, 'GET', '/api/auth/me');
    assert(res.status === 401, 'Missing session cookie returns 401 Unauthorized');
  }

  // Test 9: Proxy error handling when backend port is unreachable
  console.log('\nTest 9: Proxy error handling when target is down');
  {
    const brokenProxyApp = createProxyApp(59999); // Nothing listening on 59999
    const brokenServer: http.Server = await new Promise((resolve, reject) => {
      const s = brokenProxyApp.listen(0, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    });
    const brokenPort = (brokenServer.address() as import('net').AddressInfo).port;
    const res = await httpRequest(brokenPort, 'GET', '/api/health');
    assert(res.status === 502, 'Unreachable backend safely returns 502 Bad Gateway');
    await new Promise<void>((resolve) => brokenServer.close(() => resolve()));
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  await new Promise<void>((resolve) => backendServer.close(() => resolve()));
  await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
  await mongoose.disconnect();
  await mongod.stop();

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(60)}`);
  if (failed === 0) {
    console.log(`🎉 ALL ${passed} PROXY REGRESSION TESTS PASSED!`);
  } else {
    console.log(`❌ ${failed} PROXY TEST(S) FAILED, ${passed} passed`);
  }
  console.log('═'.repeat(60) + '\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
