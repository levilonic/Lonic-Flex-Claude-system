#!/usr/bin/env node
/**
 * Automated Agent Migration Script
 * Migrates OLD pattern agents to NEW ServiceContainer pattern
 *
 * OLD: constructor(sessionId, config = {})
 * NEW: constructor(sessionId, serviceContainer, config = {})
 */

const fs = require('fs');
const path = require('path');

// List of agents to migrate (excluding IntegrationAgent - already done)
const AGENTS_TO_MIGRATE = [
    'architecture-design-agent.js',
    'documentation-agent.js',
    'execution-manager-agent.js',
    'github-agent.js',
    'multiplan-manager-agent.js',
    'planning-manager-agent.js',
    'pragmatic-code-reviewer.js',
    'project-agent.js',
    'protocol-research-agent.js',
    'research-analysis-agent.js',
    'testing-agent.js'
];

const AGENTS_DIR = path.join(__dirname, 'src', 'agents');

console.log('🔧 AUTOMATED AGENT MIGRATION SCRIPT\n');
console.log(`Migrating ${AGENTS_TO_MIGRATE.length} agents to ServiceContainer pattern...\n`);

let successCount = 0;
let failCount = 0;

for (const agentFile of AGENTS_TO_MIGRATE) {
    const agentPath = path.join(AGENTS_DIR, agentFile);
    const agentName = agentFile.replace('.js', '');

    console.log(`📝 Migrating: ${agentFile}`);

    try {
        // Read original file
        let content = fs.readFileSync(agentPath, 'utf8');

        // Backup original
        const backupPath = agentPath.replace('.js', '.OLD.js');
        fs.writeFileSync(backupPath, content, 'utf8');

        // TRANSFORMATION 1: Update file header comment
        if (!content.includes('MIGRATED TO: ServiceContainer')) {
            content = content.replace(
                /(\*\/\n)/,
                ` *\n * MIGRATED TO: ServiceContainer pattern with dependency injection\n */\n`
            );
        }

        // TRANSFORMATION 2: Update constructor signature
        // Match: constructor(sessionId, config = {})
        // Replace: constructor(sessionId, serviceContainer, config = {})
        content = content.replace(
            /constructor\(sessionId,\s*config\s*=\s*{}\)/g,
            'constructor(sessionId, serviceContainer, config = {})'
        );

        // TRANSFORMATION 3: Add ServiceContainer validation after super()
        const superCallPattern = /(super\([^)]+\);\n)/;
        if (superCallPattern.test(content)) {
            content = content.replace(
                superCallPattern,
                `$1\n        // ServiceContainer validation and injection\n        if (!serviceContainer) {\n            throw new Error('ServiceContainer is required for ${agentName.replace(/-/g, '')} initialization');\n        }\n\n        this.services = serviceContainer;\n\n        // Get shared services from container\n        this.dbManager = null; // Will be injected during initialize()\n        this.memoryManager = this.services.getMemoryService();\n        this.compliance = this.services.getComplianceService();\n\n        // Context manager will be assigned during initialize()\n        this.contextPartition = null;\n        this.contextManager = null;\n`
            );
        }

        // TRANSFORMATION 4: Remove old contextManager usage from constructor
        // Replace direct contextManager.addAgentEvent() calls in constructor with commented notes
        const constructorEndPattern = /(\s+this\.contextManager\.addAgentEvent[^;]+;[\s]*\n)(\s+})/;
        if (constructorEndPattern.test(content)) {
            content = content.replace(
                constructorEndPattern,
                '\n        // Workflow configuration\n        this.workflowId = config.workflowId || `workflow_${this.agentId}`;\n    }'
            );
        }

        // TRANSFORMATION 5: Add initialize() method if not exists
        if (!content.includes('async initialize(')) {
            // Find the end of constructor and add initialize() method
            const constructorClosePattern = /(\n    }\n\n    \/\*\*)/;
            if (constructorClosePattern.test(content)) {
                content = content.replace(
                    constructorClosePattern,
                    `\n    }\n\n    /**\n     * Initialize agent with database connection and context partition\n     */\n    async initialize(workflowId = null) {\n        // Use provided workflow ID or generate one\n        if (workflowId) {\n            this.workflowId = workflowId;\n        }\n\n        // Get database service from container\n        this.dbManager = this.services.getDatabaseService();\n\n        // Get isolated context partition for this workflow\n        this.contextPartition = await this.services.createWorkflowPartition(\n            this.workflowId,\n            { contextScope: this.config.contextScope || 'session' }\n        );\n\n        // Use the context partition directly as context manager (Factor3ContextManager)\n        this.contextManager = this.contextPartition;\n\n        // NOW safe to use contextManager\n        this.contextManager.addAgentEvent(this.agentName, '${agentName.replace(/-/g, '_')}_initialized', {\n            session_id: this.sessionId,\n            workflow_id: this.workflowId\n        });\n\n        return this;\n    }\n\n    /**`
                );
            }
        }

        // Write migrated file
        fs.writeFileSync(agentPath, content, 'utf8');

        console.log(`   ✅ SUCCESS: ${agentFile} migrated`);
        console.log(`   📦 Backup: ${agentFile.replace('.js', '.OLD.js')}\n`);
        successCount++;

    } catch (error) {
        console.log(`   ❌ FAILED: ${agentFile}`);
        console.log(`   Error: ${error.message}\n`);
        failCount++;
    }
}

console.log('═══════════════════════════════════════════════════════');
console.log(`📊 MIGRATION SUMMARY:`);
console.log(`   ✅ Successful: ${successCount}/${AGENTS_TO_MIGRATE.length}`);
console.log(`   ❌ Failed: ${failCount}/${AGENTS_TO_MIGRATE.length}`);
console.log('═══════════════════════════════════════════════════════\n');

if (failCount === 0) {
    console.log('🎉 ALL AGENTS MIGRATED SUCCESSFULLY!\n');
    console.log('Next steps:');
    console.log('1. Run: npm test');
    console.log('2. Verify all tests pass');
    console.log('3. Commit migration');
    process.exit(0);
} else {
    console.log('⚠️  SOME MIGRATIONS FAILED');
    console.log('Review errors above and fix manually');
    process.exit(1);
}
