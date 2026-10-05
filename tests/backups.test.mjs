import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyManager } from '../server/companies.mjs';
import { createBackupService } from '../server/backups.mjs';

test('automatic backups are complete imports and retain recent snapshots', () => {
  const directory = mkdtempSync(join(tmpdir(), 'leader-backup-'));
  const manager = createCompanyManager({ directory, seed: false });
  try {
    const companyId = manager.createCompany({ name: 'Backup fixture' }).id;
    const db = manager.getStore(companyId);
    const list = db.bootstrap().lists.find(item => item.name === 'Customers');
    db.createCard({ title: 'Backup customer', listId: list.id, country: 'Japan' });
    let instant = Date.parse('2026-10-02T00:00:00Z');
    const backups = createBackupService({ manager, directory, keep: 2, now: () => new Date(instant) });
    for (let index = 0; index < 3; index++) { backups.run(); instant += 60_000; }
    const files = readdirSync(join(directory, 'backups', companyId)).sort();
    assert.equal(files.length, 2);
    const bundle = JSON.parse(readFileSync(join(directory, 'backups', companyId, files[0]), 'utf8'));
    assert.equal(bundle.company.name, 'Backup fixture');
    assert.equal(bundle.cards[0].title, 'Backup customer');
    const restored = manager.importCompany({ name: 'Backup fixture recovered', bundle });
    assert.equal(manager.getStore(restored.id).listCards({}).total, 1);
  } finally { manager.close(); rmSync(directory, { recursive: true, force: true }); }
});
