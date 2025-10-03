#!/usr/bin/env node
/**
 * Fix Logger Imports in All Services
 *
 * Services use `logger` but don't import it from logger.js
 * This script adds the missing import statement
 */

const fs = require('fs');
const path = require('path');

const services = [
    'lonicflex-master-service.js',
    'lonicflex-webhook-service.js',
    'lonicflex-workflows-service.js',
    'lonicflex-health-service.js',
    'lonicflex-integration-hub-service.js',
    'lonicflex-permissions-service.js',
    'lonicflex-github-service.js',
    'lonicflex-slack-service.js',
    'lonicflex-gitlab-service.js',
    'lonicflex-jira-service.js',
    'lonicflex-servicenow-service.js',
    'lonicflex-linear-service.js',
    'lonicflex-jenkins-service.js'
];

let fixed = 0;
let skipped = 0;

for (const serviceName of services) {
    const filePath = path.join(__dirname, 'src/services', serviceName);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  Skipped: ${serviceName} (not found)`);
        skipped++;
        continue;
    }

    let content = fs.readFileSync(filePath, 'utf8');

    // Check if already has logger import
    if (content.includes("require('./logger')") || content.includes('require("./logger")')) {
        console.log(`✅ ${serviceName}: Already has logger import`);
        skipped++;
        continue;
    }

    // Check if uses logger
    if (!content.includes('logger.')) {
        console.log(`✅ ${serviceName}: Doesn't use logger`);
        skipped++;
        continue;
    }

    // Find where to insert the import (after other requires, before class definition)
    const lines = content.split('\n');
    let insertIndex = -1;

    // Find last require() statement before class
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('require(') && lines[i].includes('dotenv')) {
            insertIndex = i + 1;
            break;
        }
    }

    if (insertIndex === -1) {
        // Try to find after any require
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes('require(')) {
                insertIndex = i + 1;
            }
            if (lines[i].includes('class ')) {
                break;
            }
        }
    }

    if (insertIndex === -1) {
        console.log(`❌ ${serviceName}: Could not find insertion point`);
        continue;
    }

    // Insert logger import
    lines.splice(insertIndex, 0, "const { createServiceLogger } = require('./logger');");

    // Also need to initialize logger in constructor
    // Find constructor and add logger initialization
    const constructorIndex = lines.findIndex(l => l.includes('constructor('));
    if (constructorIndex !== -1) {
        // Find where to add logger (after super() or after config assignment)
        let loggerInsertIndex = -1;
        for (let i = constructorIndex; i < Math.min(constructorIndex + 20, lines.length); i++) {
            if (lines[i].includes('this.config = {')) {
                // Find end of config object
                let braceCount = 0;
                for (let j = i; j < lines.length; j++) {
                    if (lines[j].includes('{')) braceCount++;
                    if (lines[j].includes('}')) braceCount--;
                    if (braceCount === 0 && lines[j].includes('};')) {
                        loggerInsertIndex = j + 1;
                        break;
                    }
                }
                break;
            }
        }

        if (loggerInsertIndex !== -1 && !content.includes('this.logger = createServiceLogger')) {
            // Add empty line and logger initialization
            lines.splice(loggerInsertIndex, 0, '');
            lines.splice(loggerInsertIndex + 1, 0, "        this.logger = createServiceLogger(this.config.serviceName);");
        }
    }

    // Write back
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`✅ ${serviceName}: Fixed logger import and initialization`);
    fixed++;
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Fixed: ${fixed}, Skipped: ${skipped}`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
