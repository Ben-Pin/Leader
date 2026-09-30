import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const url = 'http://127.0.0.1:4177';
if (!existsSync(path.join(root, 'dist/index.html'))) {
  console.error('Run pnpm install and pnpm build before starting Leader.');
  process.exit(1);
}
const healthy = async () => {
  try { const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(1000) }); return response.ok && (await response.json()).ok === true; }
  catch { return false; }
};
if (!await healthy()) {
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const log = openSync(path.join(root, 'data/server.log'), 'a');
  const child = spawn(process.execPath, ['server/http.mjs'], { cwd: root, detached: true, windowsHide: true, stdio: ['ignore', log, log] });
  child.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 30 && !await healthy(); attempt++) await new Promise(resolve => setTimeout(resolve, 200));
  if (!await healthy()) { console.error('Leader did not start. Check data/server.log.'); process.exit(1); }
}
const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
console.log(`Leader is running at ${url}`);
