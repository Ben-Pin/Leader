import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Each file is a complete Leader export and can be restored through Import database.
export function createBackupService({ manager, directory, intervalMs = 6 * 60 * 60 * 1000, keep = 28, now = () => new Date() }) {
  const root = resolve(directory, 'backups');
  mkdirSync(root, { recursive: true });
  let timer;
  const run = () => {
    const saved = [];
    for (const company of manager.listCompanies()) {
      const folder = join(root, company.id);
      mkdirSync(folder, { recursive: true });
      const stamp = now().toISOString().replace(/[:.]/g, '-');
      const destination = join(folder, `${stamp}.json`);
      const temporary = join(folder, `.${randomUUID()}.tmp`);
      try {
        const bundle = manager.exportCompany(company.id);
        writeFileSync(temporary, JSON.stringify(bundle), { flag: 'wx', mode: 0o600 });
        const check = JSON.parse(readFileSync(temporary, 'utf8'));
        if (check.format !== 'leader-company' || check.company.id !== company.id || !Array.isArray(check.cards)) throw new Error('Backup verification failed.');
        renameSync(temporary, destination);
        const files = readdirSync(folder).filter(name => /^\d{4}-.*\.json$/.test(name)).sort().reverse();
        for (const old of files.slice(keep)) rmSync(join(folder, old));
        saved.push({ company: company.id, path: destination, cards: check.cards.length });
      } catch (error) { rmSync(temporary, { force: true }); throw error; }
    }
    return saved;
  };
  return {
    run,
    start() {
      run();
      timer = setInterval(() => { try { run(); } catch (error) { console.error('Leader backup failed:', error); } }, intervalMs);
      timer.unref?.();
    },
    stop() { if (timer) clearInterval(timer); },
  };
}
