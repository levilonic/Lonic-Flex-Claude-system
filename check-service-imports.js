#!/usr/bin/env node
/**
 * Check all lonicflex services for broken imports
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Checking all lonicflex services for broken imports\n');

const servicesDir = path.join(__dirname, 'src', 'services');
const services = fs.readdirSync(servicesDir)
    .filter(f => f.startsWith('lonicflex-') && f.endsWith('-service.js'))
    .sort();

const broken = [];
const working = [];

for (const service of services) {
    const servicePath = path.join(servicesDir, service);
    const relativePath = path.relative(__dirname, servicePath);

    process.stdout.write(`Testing ${service}... `);

    try {
        // Try to require the service
        execSync(`node -e "require('./${relativePath.replace(/\\/g, '/')}')"`, {
            stdio: 'pipe',
            encoding: 'utf8'
        });
        console.log('✅ OK');
        working.push(service);
    } catch (error) {
        const stderr = error.stderr || error.stdout || '';
        if (stderr.includes('Cannot find module')) {
            // Extract the missing module name
            const match = stderr.match(/Cannot find module '([^']+)'/);
            const missingModule = match ? match[1] : 'unknown';
            console.log(`❌ BROKEN - Missing: ${missingModule}`);
            broken.push({ service, missing: missingModule });
        } else {
            console.log('✅ OK (loads with warnings)');
            working.push(service);
        }
    }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('📊 RESULTS');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
console.log(`✅ Working: ${working.length}/${services.length}`);
console.log(`❌ Broken: ${broken.length}/${services.length}\n`);

if (broken.length > 0) {
    console.log('❌ BROKEN SERVICES:\n');
    broken.forEach(({ service, missing }) => {
        console.log(`   ${service}`);
        console.log(`      Missing module: ${missing}\n`);
    });
}

if (working.length > 0) {
    console.log('✅ WORKING SERVICES:\n');
    working.forEach(service => {
        console.log(`   ${service}`);
    });
}

process.exit(broken.length > 0 ? 1 : 0);
