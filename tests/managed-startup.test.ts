import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { spawnSync } from 'node:child_process';

const directories: string[] = [];
afterEach(() => { for (const dir of directories.splice(0)) {
  if (dirname(resolve(dir)) !== resolve(tmpdir()) || !basename(dir).startsWith('managed-startup-')) throw new Error('Unexpected fixture cleanup target');
  rmSync(dir, { recursive: true, force: true });
} });
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'managed-startup-')); directories.push(dir);
  copyFileSync(resolve('server.js'), join(dir, 'server.js'));
  mkdirSync(join(dir, '.next', 'standalone'), { recursive: true });
  writeFileSync(join(dir, '.next', 'standalone', 'server.js'), "console.log(process.env.RUNTIME_TEST_SECRET ? 'configured' : 'ready');");
  const env = { ...process.env }; delete env.RUNTIME_ENV_FILE; delete env.RUNTIME_TEST_SECRET;
  return { dir, env, run: (extra: NodeJS.ProcessEnv = {}) => spawnSync(process.execPath, ['server.js'], { cwd: dir, env: { ...env, ...extra }, encoding: 'utf8', windowsHide: true }) };
}
test('managed entry starts without a private configuration file', () => {
  const f = fixture(), result = f.run(); expect(result.status).toBe(0); expect(result.stdout.trim()).toBe('ready');
});
test('owner-selected private file is loaded before the standalone server', () => {
  const f = fixture(), file = join(f.dir, 'private.env'); writeFileSync(file, 'RUNTIME_TEST_SECRET=private-sentinel\n');
  const result = f.run({ RUNTIME_ENV_FILE: file }); expect(result.status).toBe(0); expect(result.stdout.trim()).toBe('configured'); expect(result.stderr).not.toContain('private-sentinel');
});
test('relative private paths fail closed', () => {
  const f = fixture(), result = f.run({ RUNTIME_ENV_FILE: 'private.env' }); expect(result.status).not.toBe(0); expect(result.stderr).toContain('requires an absolute path');
});
test('unreadable private configuration fails without leaking its path or contents', () => {
  const f = fixture(), result = f.run({ RUNTIME_ENV_FILE: join(f.dir, 'missing-private-sentinel.env') }); expect(result.status).not.toBe(0); expect(result.stderr).toContain('could not be loaded'); expect(result.stderr).not.toContain('missing-private-sentinel');
});
