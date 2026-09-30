import express from 'express';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createStore, StoreError } from './store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function createHttpApp({ store, token = randomBytes(32).toString('hex') }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((request, response, next) => {
    const host = request.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host)) return response.status(403).json({ error: 'Недопустимый адрес сервера.', code: 'INVALID_HOST' });
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('X-Frame-Options', 'DENY');
    if (request.path.startsWith('/api')) response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '256kb' }));
  app.use('/api', (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    const supplied = request.get('X-Leader-Token') || '';
    const suppliedBytes = Buffer.from(supplied);
    const tokenBytes = Buffer.from(token);
    const valid = suppliedBytes.length === tokenBytes.length && timingSafeEqual(suppliedBytes, tokenBytes);
    if (request.get('Origin') !== `http://${request.headers.host}` || !valid) return response.status(403).json({ error: 'Сессия недействительна. Обновите страницу.', code: 'INVALID_SESSION' });
    if (!request.is('application/json')) return response.status(415).json({ error: 'Ожидается JSON.', code: 'INVALID_CONTENT_TYPE' });
    next();
  });
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  app.get('/api/bootstrap', (_request, response) => response.json({ ...store.bootstrap(), csrfToken: token }));
  app.get('/api/cards', (request, response) => response.json(store.listCards(request.query)));
  app.get('/api/cards/:id', (request, response) => response.json(store.getCard(request.params.id)));
  app.post('/api/cards', (request, response) => response.status(201).json(store.createCard(request.body)));
  app.patch('/api/cards/:id', (request, response) => response.json(store.updateCard(request.params.id, request.body)));
  app.post('/api/cards/:id/comments', (request, response) => response.status(201).json(store.addComment(request.params.id, request.body)));
  app.post('/api/lists', (request, response) => response.status(201).json(store.createList(request.body)));
  app.post('/api/tags', (request, response) => response.status(201).json(store.createTag(request.body)));
  app.use('/api', (_request, response) => response.status(404).json({ error: 'Маршрут не найден.', code: 'NOT_FOUND' }));
  const dist = resolve(root, 'dist');
  app.use(express.static(dist));
  app.use((request, response, next) => {
    if (request.method === 'GET' && existsSync(resolve(dist, 'index.html'))) return response.sendFile(resolve(dist, 'index.html'));
    next();
  });
  app.use((error, _request, response, _next) => {
    if (error instanceof StoreError) return response.status(error.status).json({ error: error.message, code: error.code });
    if (error.type === 'entity.parse.failed') return response.status(400).json({ error: 'Не удалось прочитать JSON.', code: 'INVALID_JSON' });
    if (error.type === 'entity.too.large') return response.status(413).json({ error: 'Запрос слишком большой.', code: 'PAYLOAD_TOO_LARGE' });
    console.error('Leader API error:', error);
    response.status(500).json({ error: 'Внутренняя ошибка сервера.', code: 'INTERNAL_ERROR' });
  });
  return app;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const store = createStore({ path: process.env.LEADER_DB || process.env.LEADER_DB_PATH || resolve(root, 'data/leader.sqlite'), seed: process.env.LEADER_SEED !== 'false' });
  const port = Number(process.env.PORT || 4177);
  const app = createHttpApp({ store });
  const server = app.listen(port, '127.0.0.1', () => console.log(`Leader: http://127.0.0.1:${port}`));
  const close = () => server.close(() => { store.close(); process.exit(0); });
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
