#!/usr/bin/env node

'use strict';

const DEFAULT_SERVICES = [
  { name: 'github', url: process.env.LFX_GITHUB_HEALTH_URL || 'http://localhost:3002/health' },
  { name: 'gitlab', url: process.env.LFX_GITLAB_HEALTH_URL || 'http://localhost:3025/health' },
  { name: 'jenkins', url: process.env.LFX_JENKINS_HEALTH_URL || 'http://localhost:3024/health' },
  { name: 'slack', url: process.env.LFX_SLACK_HEALTH_URL || 'http://localhost:3006/health', optional: true }
];

const STRICT_MODE = process.env.LFX_REQUIRE_SERVICES === '1';
const REQUEST_TIMEOUT_MS = Number(process.env.LFX_SERVICE_TIMEOUT_MS || 5000);

function resolveServices() {
  const services = DEFAULT_SERVICES.filter((service) => {
    if (!service.optional) return true;
    const hasSlackAuth = process.env.SLACK_BOT_TOKEN || process.env.SLACK_TOKEN;
    return Boolean(hasSlackAuth);
  });

  if (process.env.LFX_ADDITIONAL_SERVICE) {
    try {
      const extra = JSON.parse(process.env.LFX_ADDITIONAL_SERVICE);
      if (Array.isArray(extra)) {
        services.push(...extra);
      }
    } catch (error) {
      console.warn(color('Failed to parse LFX_ADDITIONAL_SERVICE; ignoring.', '33'));
    }
  }

  return services;
}

function color(text, code) {
  return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

async function fetchJson(url, timeoutMs) {
  if (typeof fetch !== 'function') {
    throw new Error('Fetch API not available in this Node.js runtime');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function checkService(service) {
  try {
    const payload = await fetchJson(service.url, REQUEST_TIMEOUT_MS);
    const status = payload.status || 'unknown';
    const mode = payload.operationalMode || payload.mode || 'unknown';
    const healthy = status === 'healthy' && mode === 'full';

    return {
      name: service.name,
      url: service.url,
      healthy,
      status,
      mode,
      details: payload.capabilities || payload.details || {}
    };
  } catch (error) {
    return {
      name: service.name,
      url: service.url,
      healthy: false,
      status: 'unavailable',
      mode: 'unknown',
      error: error.message || String(error)
    };
  }
}

function formatStatus(healthy) {
  return healthy ? color('[OK]', '32') : color('[FAIL]', '31');
}

function formatDetails(result) {
  if (result.error) {
    return `error=${result.error}`;
  }

  const summary = [];
  if (result.status) summary.push(`status=${result.status}`);
  if (result.mode) summary.push(`mode=${result.mode}`);

  const keys = Object.keys(result.details || {});
  if (keys.length > 0) {
    summary.push(`capabilities=${keys.join(',')}`);
  }

  return summary.join(' ');
}

async function main() {
  const services = resolveServices();

  if (services.length === 0) {
    console.log('Service smoke check skipped (no services configured).');
    return;
  }

  console.log('\nLonicFLex External Service Health');
  console.log('----------------------------------');

  const results = await Promise.all(services.map(checkService));
  let failures = 0;

  for (const result of results) {
    const statusText = formatStatus(result.healthy);
    const details = formatDetails(result);
    console.log(`${statusText} ${result.name} -> ${result.url}`);
    if (details) {
      console.log(`    ${details}`);
    }

    if (!result.healthy) {
      failures += 1;
    }
  }

  console.log('');

  if (failures > 0) {
    const message = `Service smoke check detected ${failures} failing service(s).`;
    if (STRICT_MODE) {
      console.error(color(message, '31'));
      process.exit(1);
    } else {
      console.warn(color(`${message} (non-blocking mode)`, '33'));
    }
  } else {
    console.log(color('All configured services are healthy.', '32'));
  }
}

main().catch((error) => {
  const message = error && error.message ? error.message : String(error);
  if (STRICT_MODE) {
    console.error(color(`Service smoke check crashed: ${message}`, '31'));
    process.exit(1);
  } else {
    console.warn(color(`Service smoke check crashed (non-blocking): ${message}`, '33'));
  }
});
