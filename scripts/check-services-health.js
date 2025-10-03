#!/usr/bin/env node

'use strict';

const SERVICE_PORT_ENVS = {
    github: 'GITHUB_SERVICE_PORT',
    gitlab: 'GITLAB_SERVICE_PORT',
    jenkins: 'JENKINS_SERVICE_PORT',
    slack: 'SLACK_SERVICE_PORT'
};

const DEFAULT_PORT_MAP = {
    github: 3002,
    gitlab: 3025,
    jenkins: 3024,
    slack: 3006
};

const SERVICE_CATALOG = [
    { name: 'github', env: 'LFX_GITHUB_HEALTH_URL' },
    { name: 'gitlab', env: 'LFX_GITLAB_HEALTH_URL' },
    { name: 'jenkins', env: 'LFX_JENKINS_HEALTH_URL' },
    { name: 'slack', env: 'LFX_SLACK_HEALTH_URL', optional: true }
];

const STRICT_MODE = process.env.LFX_REQUIRE_SERVICES === '1';
const REQUEST_TIMEOUT_MS = Number(process.env.LFX_SERVICE_TIMEOUT_MS || 5000);
const PREFER_EXTERNAL = process.env.LFX_SERVICE_USE_EXTERNAL === '1';

function color(text, code) {
    return process.stdout.isTTY ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function normaliseList(value) {
    if (!value) return [];
    return value
        .split(',')
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);
}

function buildLocalUrl(name) {
    const hostOverride = process.env[`LFX_${name.toUpperCase()}_SERVICE_HOST`] || process.env.LFX_SERVICE_HOST;
    const host = hostOverride || '127.0.0.1';
    const portEnv = SERVICE_PORT_ENVS[name];
    const port = (portEnv && process.env[portEnv]) || DEFAULT_PORT_MAP[name];

    if (!port) {
        return undefined;
    }

    return `http://${host}:${port}/health`;
}

function resolveServices() {
    const optionalServices = new Set(normaliseList(process.env.LFX_OPTIONAL_SERVICES));
    const services = [];

    for (const service of SERVICE_CATALOG) {
        const envUrl = process.env[service.env];
        const localUrl = buildLocalUrl(service.name);
        const urls = [];

        if (PREFER_EXTERNAL && envUrl) {
            urls.push(envUrl);
            if (localUrl && localUrl !== envUrl) {
                urls.push(localUrl);
            }
        } else {
            if (localUrl) {
                urls.push(localUrl);
            }
            if (envUrl && envUrl !== localUrl) {
                urls.push(envUrl);
            }
        }

        if (!urls.length) {
            const isOptional = service.optional || optionalServices.has(service.name);
            if (isOptional) {
                console.warn(color(`Skipping optional service ${service.name} (no endpoint available).`, '33'));
                continue;
            }

            const message = `No health endpoint configured for required service ${service.name}`;
            if (STRICT_MODE) {
                throw new Error(message);
            }

            console.warn(color(`${message}. Service will be skipped.`, '33'));
            continue;
        }

        services.push({
            name: service.name,
            urls,
            optional: service.optional || optionalServices.has(service.name)
        });
    }

    if (process.env.LFX_ADDITIONAL_SERVICES) {
        try {
            const extra = JSON.parse(process.env.LFX_ADDITIONAL_SERVICES);
            if (Array.isArray(extra)) {
                for (const entry of extra) {
                    if (!entry || typeof entry !== 'object') continue;
                    const { name, url, optional } = entry;
                    if (!name || !url) {
                        const message = 'Additional service entries must include both name and url';
                        if (STRICT_MODE) {
                            throw new Error(message);
                        }
                        console.warn(color(message, '33'));
                        continue;
                    }
                    services.push({ name, urls: [url], optional: Boolean(optional) });
                }
            }
        } catch (error) {
            const message = `Failed to parse LFX_ADDITIONAL_SERVICES: ${error.message}`;
            if (STRICT_MODE) {
                throw new Error(message);
            }
            console.warn(color(message, '33'));
        }
    }

    if (!services.length && STRICT_MODE) {
        throw new Error('No services configured. Provide at least one health endpoint.');
    }

    return services;
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
    const result = {
        name: service.name,
        checks: []
    };

    for (const url of service.urls) {
        try {
            const payload = await fetchJson(url, REQUEST_TIMEOUT_MS);
            const status = payload.status || 'unknown';
            const mode = payload.operationalMode || payload.mode || 'unknown';
            const healthy = status === 'healthy' && mode === 'full';

            const check = {
                url,
                healthy,
                status,
                mode,
                timestamp: payload.timestamp || new Date().toISOString(),
                details: payload.capabilities || payload.details || {}
            };

            result.checks.push(check);

            if (healthy && !result.primary) {
                result.primary = check;
            }
        } catch (error) {
            result.checks.push({
                url,
                healthy: false,
                status: 'unavailable',
                mode: 'unknown',
                error: error.message || String(error)
            });
        }
    }

    return result;
}

function formatStatus(healthy) {
    return healthy ? color('[OK]', '32') : color('[FAIL]', '31');
}

function formatDetails(check) {
    if (!check) {
        return '';
    }

    if (check.error) {
        return `error=${check.error}`;
    }

    const summary = [];
    if (check.status) summary.push(`status=${check.status}`);
    if (check.mode) summary.push(`mode=${check.mode}`);

    const keys = Object.keys(check.details || {});
    if (keys.length > 0) {
        summary.push(`capabilities=${keys.join(',')}`);
    }

    if (check.timestamp) {
        summary.push(`timestamp=${check.timestamp}`);
    }

    return summary.join(' ');
}

async function main() {
    const services = resolveServices();

    if (services.length === 0) {
        console.log('Service smoke check skipped (no services configured).');
        return;
    }

    console.log('\nLonicFLex Service Health');
    console.log('-------------------------');

    const results = await Promise.all(services.map(checkService));
    let failures = 0;

    for (const result of results) {
        const primary = result.primary || result.checks[0];
        const statusText = formatStatus(primary && primary.healthy);
        const details = formatDetails(primary || result.checks[0]);
        const displayUrl = primary ? primary.url : (result.checks[0] && result.checks[0].url) || 'unknown endpoint';

        console.log(`${statusText} ${result.name} -> ${displayUrl}`);
        if (details) {
            console.log(`    ${details}`);
        }

        if (result.checks.length > 1) {
            for (const check of result.checks.slice(1)) {
                const extra = formatDetails(check);
                console.log(`    fallback ${formatStatus(check.healthy)} ${check.url}`);
                if (extra) {
                    console.log(`      ${extra}`);
                }
            }
        }

        if (!primary || !primary.healthy) {
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