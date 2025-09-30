const { mkdir, writeFile, appendFile } = require('fs/promises');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.resolve(ROOT, 'data');
const LOGS_DIR = path.resolve(ROOT, 'logs');

async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(LOGS_DIR, { recursive: true });
}

async function writeJson(relPath, obj) {
  const abs = path.resolve(ROOT, relPath);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(obj, null, 2), 'utf8');
  return abs;
}

async function appendJsonLog(line) {
  const abs = path.resolve(LOGS_DIR, 'app.jsonl');
  await appendFile(abs, JSON.stringify(line) + '\n', 'utf8');
  return abs;
}

const ts = () => new Date().toISOString();

module.exports = {
  ROOT,
  DATA_DIR,
  LOGS_DIR,
  ensureDirs,
  writeJson,
  appendJsonLog,
  ts
};
