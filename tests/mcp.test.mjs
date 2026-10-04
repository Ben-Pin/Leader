import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { createStore } from '../server/store.mjs';
import { createCompanyManager } from '../server/companies.mjs';

function value(result) {
  assert.notEqual(result.isError, true, JSON.stringify(result));
  return result.structuredContent ?? JSON.parse(result.content.find(item => item.type === 'text').text);
}

test('real stdio MCP client shares persistent cards, detects conflicts, and restores archives', { timeout: 30000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'leader-mcp-test-'));
  const dbPath = join(directory, 'cards.sqlite');
  const store = createStore({ path: dbPath, seed: false });
  const list = store.createList({ name: 'MCP integration test', color: '#4772FA' });
  const original = store.createCard({ listId: list.id, title: 'Written by shared service' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL('../server/mcp.mjs', import.meta.url))],
    cwd: directory,
    env: { ...process.env, LEADER_DB: dbPath, LEADER_SEED: 'false' },
    stderr: 'pipe',
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: 'leader-integration-test', version: '1.0.0' });
  let clientClosed = false;
  let storeClosed = false;
  t.after(async () => {
    if (!clientClosed) await client.close();
    if (!storeClosed) store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  await client.connect(transport);
  assert.equal(client.getServerVersion().name, 'leader');
  const discovery = await client.listTools();
  assert.deepEqual(discovery.tools.map(tool => tool.name).sort(), ['country_coverage', 'list_lists', 'list_tags', 'search_cards', 'get_card', 'create_card', 'update_card', 'add_comment', 'create_list', 'create_tag'].sort());
  assert.ok(discovery.tools.find(tool => tool.name === 'update_card').inputSchema.required.includes('version'));
  assert.equal(discovery.tools.find(tool => tool.name === 'get_card').annotations.readOnlyHint, true);
  const call = async (name, args = {}) => value(await client.callTool({ name, arguments: args }));

  const lists = await call('list_lists');
  assert.ok(lists.lists.some(item => item.id === list.id));
  assert.equal((await call('get_card', { id: original.id })).title, original.title);
  const secondList = await call('create_list', { name: 'Created by MCP', color: '#44AA77' });
  const tag = await call('create_tag', { name: 'Integration', color: '#55AA88' });
  assert.ok((await call('list_tags')).tags.some(item => item.id === tag.id));
  const card = await call('create_card', {
    listId: secondList.id, title: 'Connector test client', country: 'Israel', company: 'Fictional test company',
    lastContact: '2026-09-28', status: 'rampUp', priority: 2, tagIds: [tag.id], checklist: [{ text: 'Prepare sample', done: false }],
  });
  assert.equal(card.tags[0].id, 'quarter:2026-3');
  assert.equal(card.country, 'Israel');
  assert.equal(card.status, 'rampUp');
  assert.equal((await call('search_cards', {status:'rampUp',priority:2,sort:'priority'})).items[0].id,card.id);
  assert.equal((await call('search_cards', {status:'legacy',priority:2})).total,0);
  assert.equal(store.getCard(card.id).title, 'Connector test client', 'MCP writes are immediately visible through another SQLite connection');
  const page = await call('search_cards', { listId: secondList.id, q: 'Connector', limit: 1, offset: 0 });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, card.id);
  assert.equal((await call('search_cards', { listId: secondList.id, limit: 1, offset: 1 })).items.length, 0);

  const updated = await call('update_card', { id: card.id, version: card.version, title: 'Updated over MCP', contacts: [{name:'QA buyer',role:'Purchasing',email:'buyer@demo.example'},{name:'QA engineer',role:'Engineering',email:'engineer@demo.example'}], lastContact: '2024-05-03', starred: true });
  assert.ok(updated.version > card.version);
  assert.equal(store.getCard(card.id).contacts[1].role, 'Engineering');
  assert.equal((await call('search_cards', {q:'engineer@demo.example'})).items[0].id, card.id);
  assert.equal(updated.tags[0].id, 'quarter:2024-2');
  const stale = await client.callTool({ name: 'update_card', arguments: { id: card.id, version: card.version, title: 'Stale overwrite' } });
  assert.equal(stale.isError, true);
  const stalePayload = stale.structuredContent ?? JSON.parse(stale.content[0].text);
  assert.equal(stalePayload.status, 409);
  assert.equal(store.getCard(card.id).title, 'Updated over MCP');
  const commented = await call('add_comment', { id: card.id, version: updated.version, text: 'A persisted connector comment', contactIds: [updated.contacts[1].id] });
  assert.ok(commented.activity.some(item => item.text === 'A persisted connector comment'));
  const archived = await call('update_card', { id: card.id, version: commented.version, archived: true });
  assert.equal((await call('search_cards', { listId: secondList.id })).total, 0);
  assert.equal((await call('get_card', { id: card.id })).archived, true);
  const restored = await call('update_card', { id: card.id, version: archived.version, archived: false, listId: list.id });
  assert.equal(restored.listId, list.id);
  assert.equal((await call('search_cards', { listId: list.id })).total, 2);

  const missingVersion = await client.callTool({ name: 'update_card', arguments: { id: card.id, title: 'No version' } });
  assert.equal(missingVersion.isError, true);
  const invalidDate = await client.callTool({ name: 'update_card', arguments: { id: card.id, version: restored.version, lastContact: '2026-02-31' } });
  assert.equal(invalidDate.isError, true, 'The shared service must reject invalid calendar dates');
  assert.equal(store.getCard(card.id).lastContact, '2024-05-03');

  await client.close();
  clientClosed = true;
  store.close();
  storeClosed = true;
  const reopened = createStore({ path: dbPath, seed: false });
  try {
    const persisted = reopened.getCard(card.id);
    assert.equal(persisted.title, 'Updated over MCP');
    assert.equal(persisted.archived, false);
    assert.equal(persisted.tags[0].name, '2024-2');
    assert.ok(persisted.activity.some(item => item.text === 'A persisted connector comment'));
  } finally { reopened.close(); }
  assert.doesNotMatch(stderr, /Startup failed|failed:/);
});

test('MCP selects companies explicitly and roundtrips flags and company exports', { timeout: 30000 }, async () => {
  const directory = mkdtempSync(join(tmpdir(), 'leader-mcp-companies-test-'));
  const companies = createCompanyManager({ directory, seed: false });
  const transport = new StdioClientTransport({ command: process.execPath, args: [fileURLToPath(new URL('../server/mcp.mjs', import.meta.url))],
    env: { ...process.env, LEADER_DB: '', LEADER_DB_PATH: '', LEADER_DATA_DIR: directory, LEADER_SEED: 'false' }, stderr: 'pipe' });
  const client = new Client({ name: 'leader-company-test', version: '1.0.0' });
  try {
    await client.connect(transport);
    const call = async (name, args = {}) => value(await client.callTool({ name, arguments: args }));
    const discovery = await client.listTools();
    assert.ok(discovery.tools.find(tool => tool.name === 'create_card').inputSchema.required.includes('companyId'));
    assert.ok((await call('list_companies')).companies.some(company => company.name === 'BrothersInArms'));
    const lists = await call('list_lists', { companyId: 'clab' });
    const card = await call('create_card', { companyId: 'clab', listId: lists.lists[0].id, title: 'Scoped fixture', flags: { inQuote: { active: true, comment: 'Waiting' }, swIssue: { active: true, comment: 'Kernel test' }, hwIssue: { active: true, comment: 'Board test' } } });
    assert.equal((await call('search_cards', { companyId: 'clab', view: 'inQuote' })).total, 1);
    assert.equal((await call('search_cards', { companyId: 'brothers-in-arms' })).total, 0);
    assert.equal((await client.callTool({ name: 'get_card', arguments: { companyId: 'brothers-in-arms', id: card.id } })).isError, true);
    for (const view of ['swIssue','hwIssue']) assert.equal((await call('search_cards', { companyId: 'clab', view })).total, 1);
    const bundle = await call('export_company', { id: 'clab' });
    const copy = await call('import_company', { name: 'MCP copy', bundle });
    assert.equal((await call('get_card', { companyId: copy.id, id: card.id })).flags.inQuote.comment, 'Waiting');
    await call('update_card', { companyId: 'clab', id: card.id, version: card.version, flags: { inQuote: { active: false, comment: 'Accepted' }, swIssue: { active: false, comment: 'Kernel test' }, hwIssue: { active: false, comment: 'Board test' } } });
    assert.equal((await call('search_cards', { companyId: 'clab', view: 'active' })).total, 0);
    const copied = await call('get_card', { companyId: copy.id, id: card.id });
    assert.equal(copied.flags.inQuote.active, true);
    assert.equal(copied.flags.swIssue.comment, 'Kernel test');
    assert.equal(copied.flags.hwIssue.active, true);
  } finally { await client.close(); companies.close(); rmSync(directory, { recursive: true, force: true }); }
});
