import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createStore, StoreError } from './store.mjs';

/** A company is a separate database; selection is explicit per request, never global. */
export function createCompanyManager({ directory, seed = true }) {
  mkdirSync(directory, { recursive: true });
  const catalog = new DatabaseSync(resolve(directory, 'companies.sqlite'));
  catalog.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS companies(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,file TEXT NOT NULL)');
  const stores = new Map();
  if (!catalog.prepare('PRAGMA table_info(companies)').all().some(c => c.name === 'disconnected')) catalog.exec('ALTER TABLE companies ADD COLUMN disconnected INTEGER NOT NULL DEFAULT 0');
  function getCompany(id, includeDisconnected = false) {
    if (typeof id !== 'string' || !/^[a-z0-9-]{1,100}$/.test(id)) throw new StoreError('Select a company.', 400, 'COMPANY_REQUIRED');
    const row = catalog.prepare(`SELECT id,name,file FROM companies WHERE id=?${includeDisconnected ? '' : ' AND disconnected=0'}`).get(id);
    if (!row) throw new StoreError('Company is not connected.', 404, 'COMPANY_NOT_FOUND');
    return row;
  }
  const manager = {
    listCompanies() { return catalog.prepare('SELECT id,name FROM companies WHERE disconnected=0 ORDER BY rowid').all(); },
    listDisconnected() { return catalog.prepare('SELECT id,name FROM companies WHERE disconnected=1 ORDER BY rowid').all(); },
    disconnectCompany(id) {
      getCompany(id);
      if (manager.listCompanies().length <= 1) throw new StoreError('You cannot disconnect the last database. Connect another one first.');
      catalog.prepare('UPDATE companies SET disconnected=1 WHERE id=?').run(id);
      stores.get(id)?.close(); stores.delete(id);
      return { id, disconnected: true, filesPreserved: true };
    },
    reconnectCompany(id) { getCompany(id,true); catalog.prepare('UPDATE companies SET disconnected=0 WHERE id=?').run(id); return manager.getCompany(id); },
    getCompany(id) { const { file, ...company } = getCompany(id); return company; },
    getStore(id) {
      const row = getCompany(id);
      if (!stores.has(id)) stores.set(id, createStore({ path: resolve(directory, row.file), seed: id === 'demo' && seed }));
      return stores.get(id);
    },
    createCompany({ name }, bundle) {
      if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new StoreError('Company name must be 1–100 characters.');
      const id = randomUUID(), file = `companies/${id}.sqlite`;
      const store = createStore({ path: resolve(directory, file), seed: false });
      catalog.exec('BEGIN IMMEDIATE');
      try {
        if (catalog.prepare('SELECT id FROM companies WHERE name=? COLLATE NOCASE').get(name.trim())) throw new StoreError('A company with this name is already connected.', 409, 'DUPLICATE_COMPANY');
        if (bundle) store.importData(bundle); else for (const [name,color] of [['Customers','#2563EB'],['Prospects','#8B5CF6'],['Partners','#059669'],['Distributors','#D97706']]) store.createList({ name, color });
        catalog.prepare('INSERT INTO companies(id,name,file) VALUES(?,?,?)').run(id, name.trim(), file);
        catalog.exec('COMMIT'); stores.set(id, store);
        return { id, name: name.trim() };
      } catch (error) { catalog.exec('ROLLBACK'); store.close(); throw error; }
    },
    exportCompany(id) { return { ...manager.getStore(id).exportData(), company: manager.getCompany(id), exportedAt: new Date().toISOString() }; },
    importCompany(input) {
      if (!input || typeof input !== 'object' || !input.bundle) throw new StoreError('Select a Leader database file.');
      return manager.createCompany({ name: input.name || input.bundle.company?.name }, input.bundle);
    },
    close() { for (const store of stores.values()) store.close(); catalog.close(); },
  };
  // Existing single-database work is retained as its own connected database.
  catalog.prepare('INSERT OR IGNORE INTO companies(id,name,file) VALUES(?,?,?)').run('demo', 'Demo', 'leader.sqlite');
  for (const [id, name] of [['clab', 'Clab'], ['brothers-in-arms', 'BrothersInArms']]) {
    const result = catalog.prepare('INSERT OR IGNORE INTO companies(id,name,file) VALUES(?,?,?)').run(id, name, `companies/${id}.sqlite`);
    if (result.changes) for (const [name,color] of [['Customers','#2563EB'],['Prospects','#8B5CF6'],['Partners','#059669'],['Distributors','#D97706']]) manager.getStore(id).createList({ name, color });
  }
  return manager;
}
