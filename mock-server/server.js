/**
 * Mock API Server
 *
 * Serves all RESTful endpoints consumed by the frontend.
 * Runs on http://localhost:8080
 *
 * Routes covered:
 *   Auth          POST /us/common/admin/v1/auth/login
 *                 POST /us/common/admin/v1/auth/refresh
 *                 POST /us/common/admin/v1/auth/logout
 *
 *   Users         GET/POST   /us/common/admin/v1/users
 *                 GET/PUT/DELETE /us/common/admin/v1/users/:id
 *                 PUT        /us/common/admin/v1/users/:id/roles
 *
 *   Roles         GET/POST   /us/common/admin/v1/roles
 *                 GET/PUT/DELETE /us/common/admin/v1/roles/:id
 *
 *   Permissions   GET        /us/common/admin/v1/permissions
 *
 *   Audit Logs    GET        /us/common/admin/v1/audit-logs
 *                 GET        /us/common/admin/v1/audit-logs/:id
 *
 *   Compliance    GET/POST   /us/common/ai/v1/compliance/projects
 *                 GET/PUT/DELETE /us/common/ai/v1/compliance/projects/:id
 *                 POST       /us/common/ai/v1/compliance/projects/:id/run
 *                 POST       /us/common/ai/v1/compliance/projects/:id/run-with-sources
 *                 GET        /us/common/ai/v1/compliance/jobs/:id/details
 *                 GET        /us/common/ai/v1/compliance/jobs/:id/failures
 *                 PATCH      /us/common/ai/v1/compliance/audits/:id/ignore
 *                 POST       /us/common/ai/v1/compliance/validate-prompt
 *                 GET        /us/common/ai/v1/compliance/rules
 *                 POST       /us/common/ai/v1/compliance/projects/:id/rules/upload
 *                 POST       /us/common/ai/v1/compliance/proxy-request
 *
 *   Prompt Injection
 *                 GET/POST   /us/common/ai/v1/compliance/prompt-injection/cases
 *                 PUT/DELETE /us/common/ai/v1/compliance/prompt-injection/cases/:id
 *                 GET        /us/common/ai/v1/compliance/prompt-injection/runs
 *                 GET        /us/common/ai/v1/compliance/prompt-injection/runs/latest
 *                 GET        /us/common/ai/v1/compliance/prompt-injection/runs/:id
 *                 POST       /us/common/ai/v1/compliance/prompt-injection/run
 */

const express = require('express');
const cors = require('cors');
const usersDb = require('./data/users');
const rolesDb = require('./data/roles');
const permissionsDb = require('./data/permissions');
const auditLogsDb = require('./data/audit-logs');
const complianceDb = require('./data/compliance');
const { mockUsers } = require('./data/auth');

const app = express();
const PORT = 8080;

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Simple request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function ok(res, data) {
  return res.json(data);
}

function notFound(res, msg = 'Not found') {
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: msg } });
}

function badRequest(res, msg = 'Bad request') {
  return res.status(400).json({ error: { code: 'BAD_REQUEST', message: msg } });
}

// ─── Auth Routes ─────────────────────────────────────────────────────────────
const authRouter = express.Router();

// GET /auth/login — returns a mock SSO loginUrl (frontend redirects there)
authRouter.get('/login', (req, res) => {
  const returnTo = req.query.returnTo || '/';
  return ok(res, {
    success: true,
    data: {
      loginUrl: `http://localhost:3000/mock-sso-login?returnTo=${encodeURIComponent(returnTo)}`,
      state: 'mock-state-token',
    },
  });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = mockUsers.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } });
  }
  res.cookie('refresh_token', 'mock-refresh-token', { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return ok(res, {
    success: true,
    data: {
      accessToken: `mock-access-token-${user.id}`,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        permissions: user.permissions,
      },
    },
  });
});

authRouter.post('/refresh', (req, res) => {
  // Accept any refresh attempt in mock mode
  return ok(res, {
    success: true,
    data: { accessToken: 'mock-access-token-refreshed' },
  });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('refresh_token');
  return ok(res, { success: true });
});

// GET /auth/me — return the currently "logged in" user from Bearer token
authRouter.get('/me', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const tokenId = auth.replace('Bearer mock-access-token-', '');
  const user = mockUsers.find(u => String(u.id) === tokenId) || mockUsers[0];
  return ok(res, {
    success: true,
    data: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      roles: user.roles,
      permissions: user.permissions,
    },
  });
});

// ─── Users Routes ─────────────────────────────────────────────────────────────
const usersRouter = express.Router();

usersRouter.get('/', (req, res) => {
  const { page = 0, size = 10, status, query, sort } = req.query;
  return ok(res, usersDb.getAll({ page: Number(page), size: Number(size), status, query, sort }));
});

usersRouter.get('/:id', (req, res) => {
  const result = usersDb.getById(req.params.id);
  if (!result) return notFound(res, 'User not found');
  return ok(res, result);
});

usersRouter.post('/', (req, res) => {
  const { email } = req.body || {};
  if (!email) return badRequest(res, 'Email is required');
  return res.status(201).json(usersDb.create(req.body));
});

usersRouter.put('/:id', (req, res) => {
  const result = usersDb.update(req.params.id, req.body);
  if (!result) return notFound(res, 'User not found');
  return ok(res, result);
});

usersRouter.delete('/:id', (req, res) => {
  const removed = usersDb.remove(req.params.id);
  if (!removed) return notFound(res, 'User not found');
  return res.status(204).send();
});

usersRouter.put('/:id/roles', (req, res) => {
  const result = usersDb.getById(req.params.id);
  if (!result) return notFound(res, 'User not found');
  return ok(res, result);
});

// ─── Roles Routes ─────────────────────────────────────────────────────────────
const rolesRouter = express.Router();

rolesRouter.get('/', (_req, res) => {
  return ok(res, rolesDb.getAll());
});

rolesRouter.get('/:id', (req, res) => {
  const result = rolesDb.getById(req.params.id);
  if (!result) return notFound(res, 'Role not found');
  return ok(res, result);
});

rolesRouter.post('/', (req, res) => {
  const { name } = req.body || {};
  if (!name) return badRequest(res, 'Name is required');
  return res.status(201).json(rolesDb.create(req.body));
});

rolesRouter.put('/:id', (req, res) => {
  const result = rolesDb.update(req.params.id, req.body);
  if (!result) return notFound(res, 'Role not found');
  return ok(res, result);
});

rolesRouter.delete('/:id', (req, res) => {
  const removed = rolesDb.remove(req.params.id);
  if (!removed) return notFound(res, 'Role not found');
  return res.status(204).send();
});

// ─── Permissions Routes ───────────────────────────────────────────────────────
const permissionsRouter = express.Router();

permissionsRouter.get('/', (_req, res) => {
  return ok(res, permissionsDb.getAll());
});

// ─── Audit Logs Routes ────────────────────────────────────────────────────────
const auditLogsRouter = express.Router();

auditLogsRouter.get('/', (req, res) => {
  const { page = 0, size = 10, query, action, resource } = req.query;
  return ok(res, auditLogsDb.getAll({ page: Number(page), size: Number(size), query, action, resource }));
});

auditLogsRouter.get('/:id', (req, res) => {
  const result = auditLogsDb.getById(req.params.id);
  if (!result) return notFound(res, 'Audit log not found');
  return ok(res, result);
});

// ─── Compliance Routes ────────────────────────────────────────────────────────
const complianceRouter = express.Router();

// Projects — real backend returns { projects: [...] }
complianceRouter.get('/projects', (_req, res) => {
  return ok(res, { projects: complianceDb.getProjects() });
});

complianceRouter.get('/projects/:id', (req, res) => {
  const project = complianceDb.getProjectById(req.params.id);
  if (!project) return notFound(res, 'Project not found');
  return ok(res, project);
});

complianceRouter.post('/projects', (req, res) => {
  const { project_name } = req.body || {};
  if (!project_name) return badRequest(res, 'project_name is required');
  return res.status(201).json(complianceDb.createProject(req.body));
});

complianceRouter.put('/projects/:id', (req, res) => {
  const project = complianceDb.updateProject(req.params.id, req.body);
  if (!project) return notFound(res, 'Project not found');
  return ok(res, project);
});

complianceRouter.delete('/projects/:id', (req, res) => {
  const removed = complianceDb.deleteProject(req.params.id);
  if (!removed) return notFound(res, 'Project not found');
  return res.status(204).send();
});

// Run audit
complianceRouter.post('/projects/:id/run', (req, res) => {
  const result = complianceDb.runAudit(req.params.id);
  if (!result) return notFound(res, 'Project not found');
  return ok(res, result);
});

// Run audit with sources
complianceRouter.post('/projects/:id/run-with-sources', (req, res) => {
  const result = complianceDb.runAudit(req.params.id);
  if (!result) return notFound(res, 'Project not found');
  return ok(res, result);
});

// Rules upload
complianceRouter.post('/projects/:id/rules/upload', (req, res) => {
  return ok(res, { success: true, message: 'Rules file uploaded (mock)', project_id: req.params.id });
});

// Jobs
complianceRouter.get('/jobs/:id/details', (req, res) => {
  const job = complianceDb.getJobDetails(req.params.id);
  if (!job) return notFound(res, 'Job not found');
  return ok(res, job);
});

// real backend returns { failures: [...] }
complianceRouter.get('/jobs/:id/failures', (req, res) => {
  return ok(res, { failures: complianceDb.getJobFailures(req.params.id) });
});

// Ignore audit
complianceRouter.patch('/audits/:id/ignore', (req, res) => {
  return ok(res, complianceDb.ignoreAudit(req.params.id, req.body));
});

// Validate prompt
complianceRouter.post('/validate-prompt', (req, res) => {
  return ok(res, {
    valid: true,
    score: 82,
    issues: [],
    suggestions: ['Consider adding more specificity to your instructions'],
  });
});

// Rules
complianceRouter.get('/rules', (_req, res) => {
  return ok(res, complianceDb.rules);
});

// Proxy request (passthrough mock)
complianceRouter.post('/proxy-request', (req, res) => {
  return ok(res, {
    status: 200,
    statusText: 'OK',
    headers: { 'content-type': 'application/json' },
    body: { mock: true, message: 'This is a mock proxy response', request: req.body },
    time: Math.floor(Math.random() * 300) + 50,
  });
});

// Prompt Injection
complianceRouter.get('/prompt-injection/cases', (req, res) => {
  const { project_id } = req.query;
  const cases = project_id
    ? complianceDb.promptInjectionCases.filter(c => !c.project_id || c.project_id === String(project_id))
    : complianceDb.promptInjectionCases;
  return ok(res, cases);
});

complianceRouter.post('/prompt-injection/cases', (req, res) => {
  const newCase = {
    id: `pi-${String(complianceDb.piCaseNextId++).padStart(3, '0')}`,
    ...req.body,
    createdAt: new Date().toISOString(),
  };
  complianceDb.promptInjectionCases.push(newCase);
  return res.status(201).json(newCase);
});

complianceRouter.put('/prompt-injection/cases/:id', (req, res) => {
  const idx = complianceDb.promptInjectionCases.findIndex(c => c.id === req.params.id);
  if (idx === -1) return notFound(res, 'Case not found');
  complianceDb.promptInjectionCases[idx] = { ...complianceDb.promptInjectionCases[idx], ...req.body };
  return ok(res, complianceDb.promptInjectionCases[idx]);
});

complianceRouter.delete('/prompt-injection/cases/:id', (req, res) => {
  const idx = complianceDb.promptInjectionCases.findIndex(c => c.id === req.params.id);
  if (idx === -1) return notFound(res, 'Case not found');
  complianceDb.promptInjectionCases.splice(idx, 1);
  return res.status(204).send();
});

complianceRouter.get('/prompt-injection/runs', (req, res) => {
  const { project_id } = req.query;
  const runs = project_id
    ? complianceDb.promptInjectionRuns.filter(r => r.project_id === String(project_id))
    : complianceDb.promptInjectionRuns;
  return ok(res, runs);
});

complianceRouter.get('/prompt-injection/runs/latest', (req, res) => {
  const { project_id } = req.query;
  const runs = project_id
    ? complianceDb.promptInjectionRuns.filter(r => r.project_id === String(project_id))
    : complianceDb.promptInjectionRuns;
  return ok(res, runs[runs.length - 1] || null);
});

complianceRouter.get('/prompt-injection/runs/:id', (req, res) => {
  const run = complianceDb.promptInjectionRuns.find(r => r.run_id === req.params.id);
  if (!run) return notFound(res, 'Run not found');
  return ok(res, { run });
});

complianceRouter.post('/prompt-injection/run', (req, res) => {
  return ok(res, {
    run_id: `pi-run-${Date.now()}`,
    status: 'RUNNING',
    message: 'Prompt injection test started',
  });
});

// ─── Mount All Routers ────────────────────────────────────────────────────────
const ADMIN_BASE = '/us/common/admin/v1';
const AI_BASE = '/us/common/ai/v1';

app.use(`${ADMIN_BASE}/auth`, authRouter);
app.use(`${ADMIN_BASE}/users`, usersRouter);
app.use(`${ADMIN_BASE}/roles`, rolesRouter);
app.use(`${ADMIN_BASE}/permissions`, permissionsRouter);
app.use(`${ADMIN_BASE}/audit-logs`, auditLogsRouter);
app.use(`${AI_BASE}/compliance`, complianceRouter);

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// 404 fallback
app.use((req, res) => {
  console.warn(`[404] No route matched: ${req.method} ${req.path}`);
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route: ${req.method} ${req.path}` } });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n Mock API Server running on http://localhost:${PORT}`);
  console.log(` Admin API : http://localhost:${PORT}${ADMIN_BASE}`);
  console.log(` AI API    : http://localhost:${PORT}${AI_BASE}`);
  console.log(` Health    : http://localhost:${PORT}/health\n`);
  console.log(' Default credentials:');
  console.log('   admin@example.com / admin123');
  console.log('   user@example.com  / user123\n');
});
