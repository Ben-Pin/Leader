import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { once } from 'node:events';
import { createStore } from '../server/store.mjs';
import { createCompanyManager } from '../server/companies.mjs';
import { createHttpApp } from '../server/http.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'leader-companies-test-'));
  const manager = createCompanyManager({ directory, seed: false });
  t.after(() => { manager.close(); assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep)); assert.ok(directory.includes('leader-companies-test-')); rmSync(directory, { recursive: true, force: true }); });
  return Object.assign(manager, { testDirectory: directory });
}

test('independent flags preserve comments, enter In work and clear separately with revision checks', () => {
  const db = createStore({ path: ':memory:', seed: false });
  try {
    const list = db.createList({ name: 'Test' });
    let card = db.createCard({ title: 'Flagged company', listId: list.id, flags: { inQuote: { active: true, comment: 'Waiting for price approval' }, logisticsIssue: { active: true, comment: 'Parcel delayed' } } });
    assert.equal(db.listCards({ view: 'active' }).total, 1);
    assert.equal(db.listCards({ view: 'inQuote' }).total, 1);
    assert.equal(db.listCards({ view: 'logisticsIssue' }).total, 1);
    assert.equal(db.bootstrap().stats.inQuote, 1);
    assert.throws(() => db.updateCard(card.id, { version: card.version, flags: { inQuote: { active: true, comment: 'two\nlines' } } }));
    card = db.updateCard(card.id, { version: card.version, flags: { inQuote: { active: false, comment: 'Price approved' } } });
    assert.equal(db.listCards({ view: 'inQuote' }).total, 0);
    assert.equal(card.flags.logisticsIssue.active, true);
    assert.equal(db.listCards({ view: 'active' }).total, 1);
    const previous = card;
    card = db.updateCard(card.id, { version: card.version, flags: { logisticsIssue: { active: false, comment: 'Delivered' } } });
    assert.equal(db.listCards({ view: 'active' }).total, 0);
    assert.equal(card.flags.inQuote.comment, 'Price approved');
    assert.throws(() => db.updateCard(card.id, { version: previous.version, flags: { administrativeIssue: { active: true } } }), e => e.code === 'VERSION_CONFLICT');
  } finally { db.close(); }
});

test('company export/import roundtrips all card fields, flags, archived records, history and identities', t => {
  const manager = fixture(t);
  const clab = manager.getStore('clab'), brothers = manager.getStore('brothers-in-arms');
  const list = clab.bootstrap().lists[0], tag = clab.createTag({ name: 'Embedded' });
  let card = clab.createCard({ title: 'Company fixture', listId: list.id, country: 'France', lastContact: '2026-09-01', tagIds: [tag.id], flags: { inQuote: { active: true, comment: 'Quote 24' } }, checklist: [{ text: 'Follow up', done: false }] });
  card = clab.addComment(card.id, { version: card.version, text: 'Imported history must survive' });
  card = clab.updateCard(card.id, { version: card.version, archived: true });
  assert.equal(brothers.bootstrap().stats.total, 0);
  assert.throws(() => brothers.getCard(card.id), e => e.status === 404);
  const bundle = manager.exportCompany('clab');
  const copy = manager.importCompany({ name: 'Clab copy', bundle });
  const copied = manager.getStore(copy.id);
  assert.deepEqual(copied.getCard(card.id), card);
  copied.updateCard(card.id, { version: card.version, title: 'Independent edit', archived: false });
  assert.equal(clab.getCard(card.id).title, 'Company fixture');
  assert.equal(manager.exportCompany('clab').cards.length, 1);
  assert.throws(() => manager.importCompany({ name: 'Clab', bundle }), e => e.code === 'DUPLICATE_COMPANY');
  const malformed = structuredClone(bundle); malformed.cards[0].lastContact = '2026-02-31';
  assert.throws(() => manager.importCompany({ name: 'Bad import', bundle: malformed }));
  assert.ok(!manager.listCompanies().some(c => c.name === 'Bad import'));
  const reopened = createCompanyManager({ directory: manager.testDirectory, seed: false });
  try { assert.equal(reopened.getStore(copy.id).getCard(card.id).title, 'Independent edit'); }
  finally { reopened.close(); }
});

test('HTTP requires an explicit company for writes and never crosses company boundaries', async t => {
  const manager = fixture(t);
  const server = createHttpApp({ companies: manager, token: 'test' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Leader-Token': 'test', Origin: origin, 'X-Leader-Company': 'clab' };
  try {
    const bootstrap = await (await fetch(`${origin}/api/bootstrap`, { headers })).json();
    assert.equal(bootstrap.company.name, 'Clab');
    assert.ok(bootstrap.companies.some(c => c.name === 'BrothersInArms'));
    const body = JSON.stringify({ title: 'HTTP scoped', listId: bootstrap.lists[0].id, flags: { administrativeIssue: { active: true, comment: 'VAT details' } } });
    const response = await fetch(`${origin}/api/cards`, { method: 'POST', headers, body });
    assert.equal(response.status, 201); const card = await response.json();
    assert.equal((await fetch(`${origin}/api/cards/${card.id}`, { headers: { ...headers, 'X-Leader-Company': 'brothers-in-arms' } })).status, 404);
    const { 'X-Leader-Company': unused, ...withoutCompany } = headers;
    assert.equal((await fetch(`${origin}/api/cards`, { method: 'POST', headers: withoutCompany, body })).status, 400);
    const exported = await (await fetch(`${origin}/api/companies/clab/export`)).json();
    const restored = await fetch(`${origin}/api/companies/import`, { method: 'POST', headers, body: JSON.stringify({ name: 'HTTP restored', bundle: exported }) });
    assert.equal(restored.status, 201);
    assert.equal(manager.getStore((await restored.json()).id).getCard(card.id).flags.administrativeIssue.comment, 'VAT details');
  } finally { await new Promise(resolve => server.close(resolve)); }
});
