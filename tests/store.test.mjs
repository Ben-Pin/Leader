import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { createStore } from '../server/store.mjs';

function fixture(t, options = {}) {
  const folder = mkdtempSync(join(tmpdir(), 'leader-store-test-'));
  const path = join(folder, 'test.sqlite');
  const stores = [];
  const open = (extra = {}) => {
    const store = createStore({ path, seed: false, ...options, ...extra });
    stores.push(store);
    return store;
  };
  t.after(() => {
    for (const store of stores.reverse()) { try { store.close(); } catch { /* Already closed by persistence test. */ } }
    assert.ok(resolve(folder).startsWith(resolve(tmpdir()) + sep));
    assert.ok(folder.includes('leader-store-test-'));
    rmSync(folder, { recursive: true, force: true });
  });
  return { store: open(), open, path };
}

test('fictional demo is complete, quarter-first and idempotent on restart', t => {
  const { store, open } = fixture(t, { seed: true });
  const bootstrap = store.bootstrap();
  assert.equal(bootstrap.demo, true);
  assert.equal(bootstrap.stats.total, 12);
  assert.equal(bootstrap.lists.length, 3);
  const cards = store.listCards({ sort: 'contact' }).items;
  assert.ok(cards.every(card => card.description.startsWith('Демо-компания')));
  assert.ok(cards.every(card => card.email.endsWith('.example')));
  assert.ok(cards.every(card => card.country && card.tags[0].id.startsWith('quarter:')));
  assert.equal(cards[0].title, 'Nordwell Systems');
  assert.equal(cards[0].tags[0].color, '#36c96b');
  assert.equal(cards.find(card => card.lastContact.startsWith('2023')).tags[0].color, '#e27370');
  assert.equal(open({ seed: true }).bootstrap().stats.total, 12);
});

test('shared CRUD persists all fields, ordered tags, checklist and comments', t => {
  const { store, open } = fixture(t);
  const list = store.createList({ name: 'Клиенты', color: '#123abc' });
  const destination = store.createList({ name: 'Партнёры' });
  const first = store.createTag({ name: 'Первый' });
  const second = store.createTag({ name: 'Второй' });
  let card = store.createCard({ title: 'Северный свет', listId: list.id, country: 'Германия', company: 'Fictional Demo', contactName: 'Alex', email: 'alex@demo.example', lastContact: '2024-02-29', dueDate: '2026-12-31', tagIds: [second.id, first.id], checklist: [{ text: 'Call', done: false }] });
  assert.equal(card.version, 1);
  assert.deepEqual(card.tags.map(tag => tag.id), ['quarter:2024-1', second.id, first.id]);
  card = store.updateCard(card.id, { version: card.version, listId: destination.id, priority: 3, status: 'proposal', starred: true, lastContact: '2026-09-01', checklist: [{ ...card.checklist[0], done: true }] });
  assert.equal(card.version, 2);
  assert.equal(card.checklist[0].done, true);
  assert.equal(card.tags[0].name, '2026-3');
  card = store.addComment(card.id, { version: 2, text: 'Обсудили пилот.' });
  assert.equal(card.version, 3);
  assert.equal(card.activity[0].text, 'Обсудили пилот.');
  assert.equal(store.bootstrap().lists.find(value => value.id === destination.id).count, 1);
  store.close();
  assert.deepEqual(open().getCard(card.id), card);
});

test('rejects impossible dates, unsafe values, unknown fields and reserved quarter tags', t => {
  const { store } = fixture(t);
  const list = store.createList({ name: 'Test' });
  const create = extra => store.createCard({ title: 'Test', listId: list.id, ...extra });
  for (const invalid of ['2025-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '2026-1-01', 'abc', 20260901]) {
    assert.throws(() => create({ lastContact: invalid }), error => error.code === 'VALIDATION_ERROR');
  }
  assert.throws(() => create({ dueDate: '2026-02-30' }));
  assert.throws(() => create({ priority: 4 }));
  assert.throws(() => create({ completed: 'false' }));
  assert.throws(() => create({ status: 'unknown' }));
  assert.throws(() => create({ extra: 'not a column' }));
  assert.throws(() => create({ tagIds: ['quarter:2026-3'] }));
  assert.throws(() => store.createTag({ name: '2026-3' }));
  assert.throws(() => store.createList({ name: 'test' }), error => error.code === 'DUPLICATE_NAME');
  assert.throws(() => store.createTag({ name: 'Color', color: 'red' }));
  assert.equal(store.bootstrap().stats.total, 0);
  assert.equal(create({ lastContact: '2024-02-29' }).lastContact, '2024-02-29');
});

test('transaction rolls back scalar and tag mutations when checklist validation fails', t => {
  const { store } = fixture(t);
  const list = store.createList({ name: 'Test' });
  const originalTag = store.createTag({ name: 'Original' });
  const changedTag = store.createTag({ name: 'Changed' });
  const owner = store.createCard({ title: 'Owner', listId: list.id, checklist: [{ text: 'Owned item' }] });
  const target = store.createCard({ title: 'Unchanged', listId: list.id, tagIds: [originalTag.id] });
  assert.throws(() => store.updateCard(target.id, { version: target.version, title: 'Wrong', tagIds: [changedTag.id], checklist: [{ id: owner.checklist[0].id, text: 'Steal item' }] }));
  assert.deepEqual(store.getCard(target.id), target);
  assert.equal(store.getCard(owner.id).checklist[0].text, 'Owned item');
  assert.throws(() => store.createCard({ title: 'Failed create', listId: list.id, checklist: [{ id: owner.checklist[0].id, text: 'Steal item' }] }));
  assert.equal(store.bootstrap().stats.total, 2);
});

test('separate HTTP/MCP connections reject stale revisions and preserve winning write', t => {
  const { store, open } = fixture(t);
  const list = store.createList({ name: 'Test' });
  const card = store.createCard({ title: 'Initial', listId: list.id });
  const secondConnection = open();
  const stale = secondConnection.getCard(card.id);
  const winner = store.updateCard(card.id, { version: card.version, title: 'HTTP edit' });
  assert.throws(() => secondConnection.updateCard(card.id, { version: stale.version, title: 'MCP edit' }), error => error.code === 'VERSION_CONFLICT' && error.status === 409);
  assert.throws(() => secondConnection.addComment(card.id, { version: stale.version, text: 'Stale comment' }), error => error.code === 'VERSION_CONFLICT');
  assert.deepEqual(secondConnection.getCard(card.id), winner);
  assert.throws(() => store.updateCard(card.id, { title: 'Missing version' }));
});

test('filters, unicode search, literal wildcard search and reversible archive agree', t => {
  const { store } = fixture(t);
  const list = store.createList({ name: 'Test' });
  const tag = store.createTag({ name: 'IoT' });
  const card = store.createCard({ title: 'Север 100%', listId: list.id, country: 'Германия', lastContact: '2026-07-01', starred: true, tagIds: [tag.id] });
  store.createCard({ title: 'Other', listId: list.id, lastContact: '2026-06-30', completed: true });
  assert.equal(store.listCards({ q: 'сЕвЕр' }).total, 1);
  assert.equal(store.listCards({ q: '%' }).total, 1);
  assert.equal(store.listCards({ q: 'германия' }).total, 1);
  assert.equal(store.listCards({ view: 'active' }).total, 0, 'Only active attention flags put a company in work');
  assert.equal(store.listCards({ view: 'completed' }).total, 1);
  assert.equal(store.listCards({ view: 'starred' }).items[0].id, card.id);
  assert.equal(store.listCards({ tag: 'quarter:2026-3' }).items[0].id, card.id);
  assert.equal(store.listCards({ tag: tag.id }).total, 1);
  const archived = store.updateCard(card.id, { version: 1, archived: true });
  assert.equal(store.listCards({ tag: tag.id }).total, 0);
  assert.equal(store.bootstrap().stats.total, 1);
  assert.equal(store.bootstrap().tags.find(item => item.id === tag.id).count, 0);
  assert.equal(store.getCard(card.id).archived, true);
  store.updateCard(card.id, { version: archived.version, archived: false });
  assert.equal(store.bootstrap().stats.total, 2);
  assert.throws(() => store.listCards({ limit: 201 }));
  assert.throws(() => store.listCards({ offset: -1 }));
  assert.throws(() => store.listCards({ sort: '__proto__' }));
  assert.throws(() => store.listCards({ tag: 'quarter:2026-5' }));
});

test('10,025 cards in one list remain paginated, searchable and durable', t => {
  const { store, open } = fixture(t);
  const list = store.createList({ name: 'Scale fixture' });
  const start = performance.now();
  for (let index = 0; index < 10025; index++) store.createCard({ title: `Demo company ${String(index).padStart(5, '0')}`, listId: list.id, country: 'Fictional', lastContact: '2026-09-01' });
  const inserted = performance.now();
  const page = store.listCards({ listId: list.id, sort: 'title', limit: 200, offset: 9800 });
  const pageDone = performance.now();
  const search = store.listCards({ q: 'company 10024', limit: 50 });
  const searchDone = performance.now();
  assert.equal(page.total, 10025);
  const geography = store.geography({ listId: list.id, limit: 200, offset: 9800 });
  assert.equal(geography.total, 10025);
  assert.equal(geography.countries[0].count, 10025);
  assert.equal(store.geography({ q: 'company 10024' }).total, 1);
  assert.equal(page.items.length, 200);
  assert.equal(page.items[0].title, 'Demo company 09800');
  assert.equal(store.listCards({ listId: list.id, sort: 'title', limit: 200, offset: 10000 }).items.length, 25);
  assert.equal(search.total, 1);
  assert.equal(search.items[0].title, 'Demo company 10024');
  assert.equal(store.bootstrap().lists[0].count, 10025);
  store.close();
  assert.equal(open().listCards({ listId: list.id, limit: 1 }).total, 10025);
  t.diagnostic(`10,025 inserts: ${(inserted - start).toFixed(0)} ms; deep 200-card page: ${(pageDone - inserted).toFixed(0)} ms; search: ${(searchDone - pageDone).toFixed(0)} ms.`);
});
