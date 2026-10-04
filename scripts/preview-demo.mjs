// Start an isolated woodland demonstration; never opens a user's data directory.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompanyManager } from '../server/companies.mjs';
import { createHttpApp } from '../server/http.mjs';
const directory = mkdtempSync(join(tmpdir(), 'leader-forest-demo-'));
const companies = createCompanyManager({ directory, seed: true });
companies.getStore('demo');
const port = Number(process.env.PORT || 4180);
const server = createHttpApp({ companies }).listen(port, '127.0.0.1', () => console.log(`Woodland demo: http://127.0.0.1:${port}/`));
const close = () => server.close(() => { companies.close(); process.exit(0); });
process.on('SIGINT', close);
process.on('SIGTERM', close);
