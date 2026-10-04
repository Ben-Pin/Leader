import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createStore, StoreError } from './store.mjs';
import { createCompanyManager } from './companies.mjs';
import { createBackupService } from './backups.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function createHttpApp({ store, companies, token = randomBytes(32).toString('hex') }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const host = request.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return response.status(403).json({ error: 'Invalid server address.', code: 'INVALID_HOST' });
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.path.startsWith('/api')) response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '128mb' }));
  app.use('/api', (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const supplied = request.get('X-Leader-Token') || '';
    const suppliedBytes = Buffer.from(supplied);
    const tokenBytes = Buffer.from(token);
    const valid = suppliedBytes.length === tokenBytes.length && timingSafeEqual(suppliedBytes, tokenBytes);
    if (request.get('Origin') !== `http://${request.headers.host}` || !valid) return response.status(403).json({ error: 'Session expired. Reload the page.', code: 'INVALID_SESSION' });
    if (!request.is('application/json')) return response.status(415).json({ error: 'Expected JSON.', code: 'INVALID_CONTENT_TYPE' });
    next();
  });
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  if (companies) {
    app.get('/api/companies', (_request, response) => response.json({ companies: companies.listCompanies() }));
    app.get('/api/companies/disconnected', (_request, response) => response.json({ companies: companies.listDisconnected() }));
    app.post('/api/companies/:id/disconnect', (request,response) => response.json(companies.disconnectCompany(request.params.id)));
    app.post('/api/companies/:id/reconnect', (request,response) => response.json(companies.reconnectCompany(request.params.id)));
    app.post('/api/companies', (request, response) => response.status(201).json(companies.createCompany(request.body)));
    app.post('/api/companies/import', (request, response) => response.status(201).json(companies.importCompany(request.body)));
    app.get('/api/companies/:id/export', (request, response) => {
      response.setHeader('Content-Disposition', `attachment; filename="leader-${request.params.id}.json"`);
      response.json(companies.exportCompany(request.params.id));
    });
  }
  app.use('/api', (request, _response, next) => {
    const companyId = request.get('X-Leader-Company');
    if (companies && !companyId && !['GET', 'HEAD'].includes(request.method)) throw new StoreError('Select a company before changing data.', 400, 'COMPANY_REQUIRED');
    request.company = companies ? companies.getCompany(companyId || 'demo') : { id: 'standalone', name: 'Local' };
    request.store = companies ? companies.getStore(request.company.id) : store;
    next();
  });
  app.get('/api/bootstrap', (request, response) => response.json({ ...request.store.bootstrap(), csrfToken: token, company: request.company, companies: companies?.listCompanies() || [request.company] }));
  app.get('/api/cards', (request, response) => response.json(request.store.listCards(request.query)));
  app.post('/api/lists/import', (request, response) => response.json(request.store.importList(request.body)));
  app.get('/api/geography', (request,response) => response.json(request.store.geography(request.query)));
  app.post('/api/cards/retag-quarters', (request, response) => response.json(request.store.syncContactQuarters()));
  app.get('/api/cards/:id', (request, response) => response.json(request.store.getCard(request.params.id)));
  app.post('/api/cards', (request, response) => response.status(201).json(request.store.createCard(request.body)));
  app.patch('/api/cards/:id', (request, response) => response.json(request.store.updateCard(request.params.id, request.body)));
  app.post('/api/cards/:id/comments', (request, response) => response.status(201).json(request.store.addComment(request.params.id, request.body)));
  app.post('/api/lists', (request, response) => response.status(201).json(request.store.createList(request.body)));
  app.delete('/api/lists/:id', (request, response) => response.json(request.store.deleteList(request.params.id)));
  app.post('/api/tags', (request, response) => response.status(201).json(request.store.createTag(request.body)));
  app.patch('/api/tags/:id', (request, response) => response.json(request.store.updateTag(request.params.id, request.body)));
  app.delete('/api/tags/:id', (request, response) => response.json(request.store.deleteTag(request.params.id)));
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Route not found.', code: 'NOT_FOUND' }));
  const dist = resolve(root, 'dist');
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.method === 'GET' && existsSync(resolve(dist, 'index.html'))) return response.sendFile(resolve(dist, 'index.html'));
    next();
  });
  app.use((error, _request, response, _next) => {
    if (error instanceof StoreError) return response.status(error.status).json({ error: error.message, code: error.code });
    if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'Could not read JSON.', code: 'INVALID_JSON' });
    if (error.type === 'entity.too.large') return response.status(413).json({ error: 'Request is too large.', code: 'PAYLOAD_TOO_LARGE' });
    console.error('Leader API error:', error);
    response.status(500).json({ error: 'Internal server error.', code: 'INTERNAL_ERROR' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.env.LEADER_DB || process.env.LEADER_DB_PATH;
  const store = path ? createStore({ path, seed: process.env.LEADER_SEED !== 'false' }) : null;
  const companies = path ? null : createCompanyManager({ directory: process.env.LEADER_DATA_DIR || resolve(root, 'data'), seed: process.env.LEADER_SEED !== 'false' });
  const backups = companies ? createBackupService({ manager: companies, directory: process.env.LEADER_DATA_DIR || resolve(root, 'data') }) : null;
  if (backups) { try { backups.start(); } catch (error) { console.error('Initial Leader backup failed:', error); } }
  const port = Number(process.env.PORT || 4177);
  const app = createHttpApp({ store, companies });
  const server = app.listen(port, '127.0.0.1', () => console.log(`Leader: http://127.0.0.1:${port}`));
  const close = () => server.close(() => { backups?.stop(); (companies || store).close(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
