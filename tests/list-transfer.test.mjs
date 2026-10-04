import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';
import { createHttpApp } from '../server/http.mjs';
import { once } from 'node:events';

function permanentLists(db) {
  return Object.fromEntries(['Customers', 'Prospects', 'Partners', 'Distributors'].map(name => [name, db.createList({ name }).id]));
}

test('list import preserves or overrides card categories, history, and Imported marker', () => {
  const source = createStore({ path: ':memory:', seed: false });
  const target = createStore({ path: ':memory:', seed: false });
  try {
    const sourceLists = permanentLists(source);
    const targetLists = permanentLists(target);
    const tag = source.createTag({ name: 'Hardware', color: '#4975ba', category: 'Product' });
    let card = source.createCard({ title: 'Fixture customer', listId: sourceLists.Customers, accountType: 'client', description: 'Private discussion', tagIds: [tag.id], contacts: [{ name: 'Buyer', email: 'buyer@example.test' }], flags: { swIssue: { active: true, comment: 'Waiting for fix' } } });
    card = source.addComment(card.id, { version: card.version, text: 'Called buyer', contactIds: [card.contacts[0].id] });
    const bundle = { format: 'leader-list', version: 1, cards: [card] };
    assert.deepEqual(target.importList({ bundle, mode: 'preserve' }), { created: 1, skipped: 0, omittedLinks: 0 });
    const imported = target.getCard(card.id);
    assert.equal(imported.listId, targetLists.Customers);
    assert.equal(imported.accountType, 'client');
    assert.equal(imported.importedPending, true);
    assert.equal(imported.description, 'Private discussion');
    assert.equal(imported.activity[0].text, 'Called buyer');
    assert.equal(imported.tags.some(item => item.name === 'Hardware'), true);
    assert.deepEqual(target.importList({ bundle, mode: 'preserve' }), { created: 0, skipped: 1, omittedLinks: 0 });
    const saved = target.updateCard(imported.id, { version: imported.version, description: 'Reviewed' });
    assert.equal(saved.importedPending, false);

    const second = source.createCard({ title: 'Fixture prospect', listId: sourceLists.Prospects, accountType: 'unspecified' });
    const forced = target.importList({ bundle: { format: 'leader-list', version: 1, cards: [second] }, mode: 'target', targetListId: targetLists.Distributors });
    assert.equal(forced.created, 1);
    assert.equal(target.getCard(second.id).listId, targetLists.Distributors);
    assert.equal(target.getCard(second.id).accountType, 'distributor');
  } finally { source.close(); target.close(); }
});

test('list import rolls back all cards when a later record is invalid', () => {
  const source = createStore({ path: ':memory:', seed: false });
  const target = createStore({ path: ':memory:', seed: false });
  try {
    const lists = permanentLists(source);
    permanentLists(target);
    const valid = source.createCard({ title: 'Valid', listId: lists.Prospects, accountType: 'unspecified' });
    const invalid = { ...source.createCard({ title: 'Invalid', listId: lists.Prospects, accountType: 'unspecified' }), lastContact: '2026-02-31' };
    assert.throws(() => target.importList({ bundle: { format: 'leader-list', version: 1, cards: [valid, invalid] }, mode: 'preserve' }));
    assert.equal(target.listCards().total, 0);
  } finally { source.close(); target.close(); }
});

test('every flag transition records a dated event, including on then off before save', () => {
  const db = createStore({ path: ':memory:', seed: false });
  try {
    const listId = db.createList({ name: 'Test' }).id;
    let card = db.createCard({ title: 'Flag timeline', listId });
    card = db.updateCard(card.id, { version: card.version, flags: { swIssue: { active: false, comment: 'Resolved' } }, flagEvents: [
      { kind: 'swIssue', active: true, comment: 'Connection failed', happenedAt: '2026-10-04T09:00:00.000Z' },
      { kind: 'swIssue', active: false, comment: 'Resolved', happenedAt: '2026-10-04T10:00:00.000Z' },
    ] });
    assert.equal(card.flags.swIssue.active, false);
    assert.deepEqual(card.activity.map(entry => [entry.kind, entry.createdAt, entry.text]), [
      ['flag', '2026-10-04T10:00:00.000Z', 'SW issue disabled\nComment: Resolved'],
      ['flag', '2026-10-04T09:00:00.000Z', 'SW issue enabled\nComment: Connection failed'],
    ]);
    card = db.updateCard(card.id, { version: card.version, flags: { hwIssue: { active: true, comment: 'Cable' } } });
    assert.ok(card.activity.some(entry => entry.kind === 'flag' && /HW issue enabled\nComment: Cable/.test(entry.text)));
    assert.throws(() => db.updateCard(card.id, { version: card.version, flags: { swIssue: { active: false, comment: '' } }, flagEvents: [{ kind: 'swIssue', active: true, happenedAt: '2026-10-04T11:00:00.000Z' }] }));
  } finally { db.close(); }
});

test('HTTP list import requires a valid session and reports imported counts', async () => {
  const source = createStore({ path: ':memory:', seed: false });
  const target = createStore({ path: ':memory:', seed: false });
  const server = createHttpApp({ store: target, token: 'test-token' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const sourceLists = permanentLists(source);
    permanentLists(target);
    const card = source.createCard({ title: 'HTTP transfer', listId: sourceLists.Prospects, accountType: 'unspecified' });
    const body = JSON.stringify({ bundle: { format: 'leader-list', version: 1, cards: [card] }, mode: 'preserve' });
    const denied = await fetch(`${origin}/api/lists/import`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body });
    assert.equal(denied.status, 403);
    const accepted = await fetch(`${origin}/api/lists/import`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Leader-Token': 'test-token', Origin: origin }, body });
    assert.equal(accepted.status, 200);
    assert.equal((await accepted.json()).created, 1);
    assert.equal(target.getCard(card.id).importedPending, true);
  } finally { await new Promise(resolve => server.close(resolve)); source.close(); target.close(); }
});
