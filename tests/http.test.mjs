import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import { createStore } from '../server/store.mjs';
import { createHttpApp } from '../server/http.mjs';

test('HTTP card workflow, revisions, origin protection and filters', async () => {
  const store = createStore({ path: ':memory:', seed: true });
  const server = createHttpApp({ store, token: 'test-token' }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'Content-Type': 'application/json', 'X-Leader-Token': 'test-token', Origin: origin };
  try {
    const bootstrap = await (await fetch(`${origin}/api/bootstrap`)).json();
    assert.equal(bootstrap.csrfToken, 'test-token');
    assert.ok(bootstrap.lists.length);
    const body = { title: 'HTTP acceptance example', contactName: 'QA contact', listId: bootstrap.lists[0].id, country: 'Нидерланды', lastContact: '2026-09-30', status:'evaluation', priority:2 };
    const blocked = await fetch(`${origin}/api/cards`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal(blocked.status, 403);
    const alien = await fetch(`${origin}/api/cards`, { method: 'POST', headers: { ...headers, Origin: 'https://unrelated.invalid' }, body: JSON.stringify(body) });
    assert.equal(alien.status, 403);
    const createdResponse = await fetch(`${origin}/api/cards`, { method: 'POST', headers, body: JSON.stringify(body) });
    assert.equal(createdResponse.status, 201);
    const card = await createdResponse.json();
    assert.equal(card.tags[0].name, '2026-3');
    const filtered=await (await fetch(`${origin}/api/cards?q=HTTP%20acceptance&status=evaluation&priority=2&sort=priority`)).json();
    assert.equal(filtered.total,1);assert.equal(filtered.items[0].id,card.id);
    const geography=await (await fetch(`${origin}/api/geography?q=HTTP%20acceptance&status=evaluation&priority=2`)).json();
    assert.equal(geography.total,1);
    const updatedResponse = await fetch(`${origin}/api/cards/${card.id}`, { method: 'PATCH', headers, body: JSON.stringify({ version: card.version, starred: true, completed: true }) });
    assert.equal(updatedResponse.status, 200);
    const updated = await updatedResponse.json();
    assert.equal(updated.version, card.version + 1);
    const conflict = await fetch(`${origin}/api/cards/${card.id}`, { method: 'PATCH', headers, body: JSON.stringify({ version: card.version, title: 'stale overwrite' }) });
    assert.equal(conflict.status, 409);
    const page = await (await fetch(`${origin}/api/cards?q=HTTP%20acceptance&view=completed&limit=1`)).json();
    assert.equal(page.total, 1);
    assert.equal(page.items[0].id, card.id);
    const invalid = await fetch(`${origin}/api/cards`, { method: 'POST', headers, body: JSON.stringify({ ...body, lastContact: '2026-02-31' }) });
    assert.equal(invalid.status, 400);
    const invalidJson = await fetch(`${origin}/api/cards`, { method: 'POST', headers, body: '{bad' });
    assert.equal(invalidJson.status, 400);
    // Node fetch rewrites Host. Use the low-level client to exercise host validation.
    const spoofStatus = await new Promise((resolve, reject) => {
      const request = httpGet(`${origin}/api/bootstrap`, { headers: { Host: 'attacker.invalid' } }, response => {
        response.resume();
        resolve(response.statusCode);
      });
      request.on('error', reject);
    });
    assert.equal(spoofStatus, 403);
    const comment = await fetch(`${origin}/api/cards/${card.id}/comments`, { method: 'POST', headers, body: JSON.stringify({ version: updated.version, text: 'HTTP history check', contactIds: [updated.contacts[0].id] }) });
    assert.equal(comment.status, 201);
    assert.ok((await comment.json()).activity.some(item => item.text === 'HTTP history check'));
  } finally {
    await new Promise(resolve => server.close(resolve));
    store.close();
  }
});
