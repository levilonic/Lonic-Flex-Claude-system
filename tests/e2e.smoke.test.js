const test = require('node:test');
const assert = require('node:assert');
const { readFile } = require('fs/promises');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileP = promisify(execFile);

test('smoke writes data/result.json with ok:true', async () => {
  await execFileP(process.execPath, ['src/smoke.js'], { env: process.env });
  const raw = await readFile('data/result.json', 'utf8');
  const json = JSON.parse(raw);
  assert.equal(json.ok, true);
  assert.ok(json.repo && json.repo.full_name);
});
