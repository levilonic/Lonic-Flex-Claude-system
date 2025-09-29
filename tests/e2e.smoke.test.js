import test from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileP = promisify(execFile);

test('smoke writes data/result.json with ok:true', async () => {
  await execFileP(process.execPath, ['src/smoke.js'], { env: process.env });
  const raw = await readFile('data/result.json', 'utf8');
  const json = JSON.parse(raw);
  assert.equal(json.ok, true);
  assert.ok(json.repo && json.repo.full_name);
});
