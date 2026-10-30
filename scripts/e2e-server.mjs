import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
const path = mkdtempSync(join(tmpdir(), 'idlewild-e2e-'));
const child = spawn(
  process.execPath,
  [
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--ip',
    '127.0.0.1',
    '--port',
    '8787',
    '--persist-to',
    path,
  ],
  { stdio: 'inherit', env: process.env },
);
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => {
  rmSync(path, { recursive: true, force: true });
  process.exit(code ?? 0);
});
