#!/usr/bin/env node
/**
 * AUTONOMOUS AI ORGANIZATION - LIVE DEMO
 * Real-world demonstration of the world's first Autonomous AI Organization
 *
 * This demo shows the complete flow from natural language input to delivered product
 * using coordinated AI agent teams across GitHub and Slack platforms.
 */

const { OrganizationManager } = require('./core/organization-manager');
const readline = require('readline');

class AutonomousOrganizationDemo {
    constructor() {
        this.orgManager = new OrganizationManager('demo-org-session', {
            demo: true,
            verbose: true
        });

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async runDemo() {
        console.log(`
🚀 AUTONOMOUS AI ORGANIZATION - LIVE DEMO
========================================

Welcome to the world's first Autonomous AI Organization!

This system transforms your natural language project descriptions into
complete delivered products through coordinated AI agent teams.

✨ What happens next:
1. You describe your project in natural language
2. The OrganizationManager parses and decomposes your requirements
3. An optimal AI agent team is formed automatically
4. GitHub repositories and Slack channels are created
5. The team coordinates autonomous execution
6. You receive a complete, delivered product

Let's begin!
`);

        // Get user input
        const projectDescription = await this.getUserInput(
            "💡 Describe your project (e.g., 'Build a customer dashboard with analytics'):\n> "
        );

        console.log("\n🎯 AUTONOMOUS AI ORGANIZATION STARTING...\n");

        try {
            // Execute autonomous organization workflow
            const result = await this.executeAutonomousWorkflow(projectDescription);

            // Display results
            this.displayResults(result);

            // Show organization status
            this.showOrganizationStatus();

            console.log("\n✨ Would you like to start another project? (y/n)");
            const another = await this.getUserInput("> ");

            if (another.toLowerCase().startsWith('y')) {
                await this.runDemo();
            } else {
                this.shutdown();
            }

        } catch (error) {
            console.error("\n❌ Autonomous organization error:", error.message);
            this.shutdown();
        }
    }

    async executeAutonomousWorkflow(projectDescription) {
        console.log("🏢 Initializing Autonomous AI Organization...");
        console.log("📝 Input received:", `"${projectDescription}"`);

        // Create execution context
        const context = {
            input: projectDescription,
            priority: 'high',
            demo: true,
            timestamp: new Date().toISOString()
        };

        // Execute autonomous workflow
        const result = await this.orgManager.executeWorkflow(context, (progress, message) => {
            // Progress callback - real-time updates
            this.displayProgress(progress, message);
        });

        return result;
    }

    displayProgress(progress, message) {
        const progressBar = this.createProgressBar(progress);
        console.log(`${progressBar} ${message}`);
    }

    createProgressBar(progress) {
        const width = 30;
        const filled = Math.floor(width * progress / 100);
        const empty = width - filled;

        return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${progress}%`;
    }

    displayResults(result) {
        console.log("\n🎉 AUTONOMOUS AI ORGANIZATION - EXECUTION COMPLETE!\n");

        console.log("📋 PROJECT SUMMARY");
        console.log("==================");
        console.log(`Project Name: ${result.project.name}`);
        console.log(`Project ID: ${result.project.id}`);
        console.log(`Complexity: ${result.project.complexity}`);
        console.log(`Components: ${result.project.components.length}`);
        console.log(`Timeline: ${result.project.timeline?.estimated_duration || 'TBD'}`);

        console.log("\n👥 AGENT TEAM");
        console.log("==============");
        result.team.members.forEach(member => {
            console.log(`• ${member.agentType.toUpperCase()}: ${member.role}`);
            console.log(`  Capabilities: ${member.capabilities.join(', ')}`);
        });
        console.log(`Coordination: ${result.team.coordinationPattern}`);

        console.log("\n🔧 INFRASTRUCTURE");
        console.log("==================");
        console.log(`GitHub Setup: ${result.infrastructure.github ? '✅ Ready' : '⚠️ Simulated'}`);
        console.log(`Slack Setup: ${result.infrastructure.slack ? '✅ Ready' : '⚠️ Simulated'}`);
        console.log(`Autonomous Features: ${result.infrastructure.autonomousFeatures ? '✅ Enabled' : '❌ Disabled'}`);

        console.log("\n📊 RESOURCE ALLOCATION");
        console.log("=======================");
        console.log(`Agents: ${result.resourcePlan.computeResources.agents}`);
        console.log(`CPU: ${result.resourcePlan.computeResources.estimatedCpu}`);
        console.log(`Memory: ${result.resourcePlan.computeResources.estimatedMemory}`);
        console.log(`Timeline: ${result.resourcePlan.timeAllocation.totalEstimate}`);

        console.log("\n🚀 EXECUTION PLAN");
        console.log("==================");
        result.executionPlan.phases.forEach(phase => {
            console.log(`Phase: ${phase.phase}`);
            console.log(`  Agents: ${phase.agents.join(', ')}`);
            console.log(`  Duration: ${phase.duration}`);
            console.log(`  Deliverables: ${phase.deliverables.join(', ')}`);
        });

        console.log("\n🎯 PROJECT DELIVERABLES");
        console.log("========================");
        result.project.components.forEach(component => {
            console.log(`• ${component.name} (${component.type}) - Priority: ${component.priority}`);
        });

        console.log("\n✅ QUALITY GATES");
        console.log("=================");
        result.project.qualityGates.forEach(gate => {
            console.log(`• ${gate.name}: ${gate.criteria} (${gate.phase})`);
        });

        console.log(`\n⭐ STATUS: ${result.status.toUpperCase()}`);
        console.log(`📅 Delivered: ${result.deliveredAt}`);
        console.log(`\n🎊 Your autonomous AI organization has successfully delivered the project!`);
    }

    showOrganizationStatus() {
        const status = this.orgManager.getOrganizationStatus();

        console.log("\n🏢 ORGANIZATION STATUS");
        console.log("======================");
        console.log(`Health: ${status.organizationHealth.toUpperCase()}`);
        console.log(`Active Projects: ${status.activeProjects}`);
        console.log(`Active Teams: ${status.activeTeams}`);
        console.log(`Capacity: ${status.currentCapacity.utilization} (${status.currentCapacity.used}/${status.currentCapacity.total})`);
        console.log(`Available: ${status.currentCapacity.available} project slots`);
        console.log(`Next Available: ${status.nextAvailable}`);
    }

    async getUserInput(question) {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    shutdown() {
        console.log("\n🏢 Autonomous AI Organization Demo Complete");
        console.log("Thank you for experiencing the future of AI-driven project delivery!\n");
        this.rl.close();
    }
}

// Demo execution scenarios
class DemoScenarios {
    static getExampleProjects() {
        return [
            {
                name: "Customer Dashboard",
                description: "Build a customer dashboard with user authentication, real-time analytics, and reporting capabilities",
                expectedComplexity: "medium"
            },
            {
                name: "E-commerce API",
                description: "Create a secure REST API for an e-commerce platform with product management, order processing, and payment integration",
                expectedComplexity: "high"
            },
            {
                name: "Task Management App",
                description: "Develop a simple task management application with user accounts, task creation, and basic notifications",
                expectedComplexity: "low"
            },
            {
                name: "Microservices Platform",
                description: "Build a comprehensive microservices platform with container orchestration, API gateway, monitoring, and auto-scaling capabilities",
                expectedComplexity: "very_high"
            }
        ];
    }

    static async runScenarioDemo() {
        console.log("\n🎭 SCENARIO DEMONSTRATION MODE\n");

        const scenarios = this.getExampleProjects();
        console.log("Available example projects:");
        scenarios.forEach((project, index) => {
            console.log(`${index + 1}. ${project.name}: ${project.description}`);
        });

        console.log("\n🚀 Running all scenarios...\n");

        const orgManager = new OrganizationManager('scenario-demo', { demo: true });

        for (const [index, scenario] of scenarios.entries()) {
            console.log(`\n${'='.repeat(60)}`);
            console.log(`SCENARIO ${index + 1}: ${scenario.name.toUpperCase()}`);
            console.log(`${'='.repeat(60)}`);
            console.log(`Input: "${scenario.description}"`);
            console.log(`Expected Complexity: ${scenario.expectedComplexity}`);
            console.log();

            const context = {
                input: scenario.description,
                priority: 'medium',
                scenario: scenario.name
            };

            try {
                const result = await orgManager.executeWorkflow(context);

                console.log(`✅ ${scenario.name} - SUCCESS`);
                console.log(`   Actual Complexity: ${result.project.complexity}`);
                console.log(`   Team Size: ${result.team.members.length} agents`);
                console.log(`   Components: ${result.project.components.length}`);
                console.log(`   Coordination: ${result.team.coordinationPattern}`);

            } catch (error) {
                console.log(`❌ ${scenario.name} - FAILED: ${error.message}`);
            }
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log("SCENARIO DEMONSTRATION COMPLETE");
        console.log(`${'='.repeat(60)}`);

        const status = orgManager.getOrganizationStatus();
        console.log(`Total Projects Processed: ${status.activeProjects}`);
        console.log(`Organization Health: ${status.organizationHealth}`);
        console.log();
    }
}

// Command line interface
async function main() {
    const args = process.argv.slice(2);

    if (args.includes('--scenario') || args.includes('-s')) {
        await DemoScenarios.runScenarioDemo();
    } else if (args.includes('--help') || args.includes('-h')) {
        console.log(`
🚀 AUTONOMOUS AI ORGANIZATION DEMO

Usage:
  node demo-autonomous-organization.js          # Interactive demo
  node demo-autonomous-organization.js -s       # Run all scenarios
  node demo-autonomous-organization.js --help   # Show this help

Description:
  Experience the world's first Autonomous AI Organization!
  Transform natural language project descriptions into complete
  delivered products through coordinated AI agent teams.

Features:
  • Natural language project intake
  • Automatic project decomposition
  • Optimal AI agent team formation
  • GitHub repository and Slack channel setup
  • Autonomous project execution coordination
  • Quality gates and delivery management

Examples:
  "Build a customer dashboard"
  "Create an API for mobile app"
  "Develop a secure e-commerce platform"
        `);
    } else {
        const demo = new AutonomousOrganizationDemo();
        await demo.runDemo();
    }
}

// Error handling for production-like behavior
process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    process.exit(1);
});

if (require.main === module) {
    main().catch(error => {
        console.error('❌ Demo failed:', error.message);
        process.exit(1);
    });
}

module.exports = {
    AutonomousOrganizationDemo,
    DemoScenarios
};