import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../server/store.mjs';

test('bidirectional partner links, pagination, atomic validation and portable roundtrip', () => {
  const db = createStore({ path: ':memory:', seed: false });
  const restored = createStore({ path: ':memory:', seed: false });
  try {
    const listId = db.createList({ name: 'Clients' }).id;
    const partner = db.createCard({ listId, title: 'Distributor', accountType: 'distributor' });
    let client = db.createCard({ listId, title: 'Client', accountType: 'client', distributorIds: [partner.id] });
    assert.equal(client.distributors[0].title, partner.title);
    assert.equal(db.getCard(partner.id).clientCount, 1);
    assert.equal(db.listCards({ distributorId: partner.id, limit: 1 }).items[0].id, client.id);
    assert.equal(db.listCards({ distributorId: partner.id, offset: 1 }).items.length, 0);
    assert.equal(db.listCards({ accountType: 'channel' }).total, 1);
    assert.throws(() => db.updateCard(partner.id, { version: partner.version, accountType: 'client' }));
    assert.equal(db.getCard(partner.id).accountType, 'distributor');
    assert.throws(() => db.updateCard(client.id, { version: client.version, distributorIds: ['missing'] }));
    assert.equal(db.getCard(client.id).version, client.version);
    assert.throws(() => db.updateCard(partner.id, { version: partner.version, distributorIds: [partner.id] }));
    client = db.updateCard(client.id, { version: client.version, accountType: 'partner' });
    assert.throws(() => db.updateCard(partner.id, { version: partner.version, distributorIds: [client.id] }));
    const bundle = db.exportData();
    bundle.cards.reverse(); // A client may be restored before its partner.
    restored.importData(bundle);
    assert.deepEqual(restored.getCard(client.id), db.getCard(client.id));
    assert.deepEqual(restored.getCard(partner.id), db.getCard(partner.id));
    client = db.updateCard(client.id, { version: client.version, archived: true });
    assert.equal(db.getCard(partner.id).clientCount, 0);
    assert.equal(db.listCards({ distributorId: partner.id }).total, 0);
    client = db.updateCard(client.id, { version: client.version, archived: false, distributorIds: [] });
    assert.equal(client.distributors.length, 0);
    assert.equal(restored.getCard(partner.id).clientCount, 1);
    assert.throws(() => db.transaction(() => { db.createCard({ title: 'Rollback', listId }); throw new Error('Abort'); }));
    assert.equal(db.listCards({ q: 'Rollback' }).total, 0);
  } finally { db.close(); restored.close(); }
});

test('imported quarter is preserved without fabricating an exact contact date', () => {
  const db = createStore({ path: ':memory:', seed: false });
  try {
    const listId = db.createList({ name: 'Clients' }).id;
    let card = db.createCard({ title: 'Quarter only', listId, contactQuarter: '2026-2' });
    assert.equal(card.lastContact, null);
    assert.equal(card.tags[0].name, '2026-2');
    assert.equal(db.listCards({ tag: 'quarter:2026-2' }).total, 1);
    assert.equal(db.bootstrap().tags[0].count, 1);
    card = db.updateCard(card.id, { version: card.version, lastContact: '2025-01-04' });
    assert.equal(card.tags[0].name, '2025-1');
    assert.equal(db.listCards({ tag: 'quarter:2026-2' }).total, 0);
    assert.equal(db.bootstrap().tags[0].name, '2025-1');
    assert.throws(() => db.createCard({ title: 'Invalid', listId, contactQuarter: '2026-7' }));
  } finally { db.close(); }
});
