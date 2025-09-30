const { ensureDirs, writeJson, appendJsonLog, ts } = require('./fs');
const { SMOKE_REPO, GITHUB_TOKEN } = require('./env');

async function main() {
  await ensureDirs();

  const headers = { 'User-Agent': 'lfx-smoke' };
  if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${SMOKE_REPO}`, { headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GitHub API failed: ${res.status} ${res.statusText} ${text}`);
  }
  const repo = await res.json();

  const out = {
    ok: true,
    ts: ts(),
    repo: {
      full_name: repo.full_name,
      private: repo.private,
      default_branch: repo.default_branch,
      pushed_at: repo.pushed_at
    }
  };

  const outPath = 'data/result.json';
  await writeJson(outPath, out);
  await appendJsonLog({ ts: ts(), cmd: 'smoke', status: 'ok', out: outPath, repo: repo.full_name });
  process.exit(0);
}

main().catch(async (err) => {
  await appendJsonLog({ ts: ts(), cmd: 'smoke', status: 'error', error: String(err?.message || err) });
  console.error(err);
  process.exit(1);
});
