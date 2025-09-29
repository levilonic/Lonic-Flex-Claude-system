import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..');
export const DATA_DIR = resolve(ROOT, 'data');
export const LOGS_DIR = resolve(ROOT, 'logs');

export async function ensureDirs() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(LOGS_DIR, { recursive: true });
}

export async function writeJson(relPath, obj) {
  const abs = resolve(ROOT, relPath);
  await mkdir(dirname(abs), { recursive: true });
  await writeFile(abs, JSON.stringify(obj, null, 2), 'utf8');
  return abs;
}

export async function appendJsonLog(line) {
  const abs = resolve(LOGS_DIR, 'app.jsonl');
  await appendFile(abs, JSON.stringify(line) + '\n', 'utf8');
  return abs;
}

export const ts = () => new Date().toISOString();
