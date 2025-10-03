#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const services = ['jenkins', 'jira', 'master', 'permissions', 'servicenow', 'webhook', 'workflows'];

console.log('🔍 Checking HYBRID Services\n');
console.log('Service           | ServiceBase | validateSuccess | axios | Assessment');
console.log('----------------- | ----------- | --------------- | ----- | -----------');

for (const service of services) {
    const filePath = path.join(__dirname, 'src', 'services', `lonicflex-${service}-service.js`);
    const content = fs.readFileSync(filePath, 'utf8');

    const hasServiceBase = content.includes('ServiceBase');
    const hasValidateSuccess = content.includes('validateSuccess');
    const axiosCount = (content.match(/await axios/g) || []).length;

    let assessment = 'UNKNOWN';
    if (hasValidateSuccess && !hasServiceBase) {
        assessment = 'BROKEN (needs ServiceBase)';
    } else if (axiosCount > 0) {
        assessment = 'REAL (has API calls)';
    } else if (!hasValidateSuccess) {
        assessment = 'COORDINATOR (no validateSuccess)';
    } else {
        assessment = 'REAL (extends ServiceBase)';
    }

    console.log(`${service.padEnd(17)} | ${hasServiceBase ? 'YES' : 'NO '}        | ${hasValidateSuccess ? 'YES' : 'NO '}            | ${axiosCount}     | ${assessment}`);
}
