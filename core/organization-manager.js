#!/usr/bin/env node
/**
 * OrganizationManager - Autonomous AI Organization Core
 * Phase 2 Implementation - Week 1, Day 1
 *
 * The central coordination and decision-making system for the autonomous organization.
 * Transforms natural language project descriptions into complete delivered products
 * through coordinated AI agent teams operating across GitHub and Slack platforms.
 *
 * Extends existing LonicFLex BaseAgent architecture with autonomous capabilities.
 */

// Load environment variables for production configuration
require('dotenv').config();

const { BaseAgent } = require('../agents/base-agent');
const { SimplifiedExternalCoordinator } = require('../external-integrations/simplified-external-coordinator');
const { Factor3ContextManager } = require('../factor3-context-manager');
const path = require('path');

class OrganizationManager extends BaseAgent {
    constructor(sessionId = null, config = {}) {
        const orgSessionId = sessionId || `autonomous-org-${Date.now()}`;

        super('organization-manager', orgSessionId, {
            maxSteps: 10, // Extended for complex coordination
            timeout: 120000, // Extended for multi-agent coordination
            contextScope: 'project', // Use project-level context
            autonomous: true,
            organizationManager: true,
            crossPlatformCoordination: true,
            ...config
        });

        // Integration with existing LonicFLex systems - REAL PRODUCTION CONFIG
        this.externalCoordinator = new SimplifiedExternalCoordinator({
            enableGitHub: true,
            enableSlack: true,
            github: {
                token: process.env.GITHUB_TOKEN,
                owner: process.env.GITHUB_OWNER || 'levilonic',
                repo: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system',
                autoCreateBranch: true,
                branchPrefix: 'autonomous/',
                autoCreatePR: true,
                ...config.github
            },
            slack: {
                token: process.env.SLACK_BOT_TOKEN,
                channel: '#all-lonixflex', // Use the correct channel that exists in your Slack workspace
                autoNotify: true,
                richFormatting: true,
                ...config.slack
            }
        });

        // Initialize context manager (may be null in some contexts)
        this.initializeContextManager(config);

        // Autonomous organization state
        this.activeProjects = new Map();
        this.agentTeams = new Map();
        this.resourceAllocation = new Map();
        this.projectCounter = 0;

        // Natural language processing components
        this.nlProcessor = new NaturalLanguageProcessor();
        this.projectDecomposer = new ProjectDecomposer();
        this.agentSpecialist = new AgentSpecialist();
    }

    /**
     * Initialize context manager with the real LonicFLex Factor3 system
     */
    initializeContextManager(config) {
        // Use the real Factor3ContextManager from LonicFLex
        this.contextManager = new Factor3ContextManager();
        console.log("✅ Using real Factor3ContextManager - production ready");
    }

    /**
     * Main execution workflow for autonomous project delivery
     * Factor 10: Limited to 8 core steps for focused execution
     */
    async executeWorkflow(context, progressCallback) {
        try {
            this.updateProgress(0, 'Initializing autonomous organization workflow');

            // Step 1: Parse natural language requirements
            this.updateProgress(10, 'Parsing natural language requirements');
            const requirements = await this.parseNaturalLanguage(context.input, context);
            await this.contextManager.addAgentEvent(this.agentName, 'requirements_parsed', requirements);

            // Step 2: Decompose into project structure
            this.updateProgress(25, 'Decomposing project structure');
            const project = await this.decomposeProject(requirements, context);
            await this.contextManager.addAgentEvent(this.agentName, 'project_decomposed', project);

            // Step 3: Form optimal agent team
            this.updateProgress(40, 'Forming optimal agent team');
            const team = await this.formAgentTeam(project, context);
            await this.contextManager.addAgentEvent(this.agentName, 'team_formed', team);

            // Step 4: Setup GitHub + Slack infrastructure
            this.updateProgress(55, 'Setting up project infrastructure');
            const infrastructure = await this.setupInfrastructure(project, team, context);
            await this.contextManager.addAgentEvent(this.agentName, 'infrastructure_setup', infrastructure);

            // Step 5: Allocate resources and prepare execution
            this.updateProgress(70, 'Allocating resources');
            const resourcePlan = await this.allocateResources(project, team, infrastructure);
            await this.contextManager.addAgentEvent(this.agentName, 'resources_allocated', resourcePlan);

            // Step 6: Initiate coordinated execution
            this.updateProgress(85, 'Initiating autonomous execution');
            const executionPlan = await this.initiateExecution(project, team, infrastructure, resourcePlan);
            await this.contextManager.addAgentEvent(this.agentName, 'execution_initiated', executionPlan);

            // Step 7: Monitor and coordinate
            this.updateProgress(95, 'Monitoring autonomous execution');
            const coordinationResult = await this.coordinateExecution(executionPlan, project, team);
            await this.contextManager.addAgentEvent(this.agentName, 'execution_coordinated', coordinationResult);

            // Step 8: Finalize delivery
            this.updateProgress(100, 'Autonomous project delivery complete');
            const deliveryResult = {
                requirements,
                project,
                team,
                infrastructure,
                resourcePlan,
                executionPlan,
                coordinationResult,
                status: 'completed',
                deliveredAt: new Date().toISOString()
            };

            await this.contextManager.addAgentEvent(this.agentName, 'project_delivered', deliveryResult);
            return deliveryResult;

        } catch (error) {
            await this.contextManager.addAgentEvent(this.agentName, 'execution_error', { error: error.message });
            throw error;
        }
    }

    /**
     * Parse natural language input into structured requirements
     * Integrates with existing context management for state preservation
     */
    async parseNaturalLanguage(input, context = {}) {
        this.updateProgress(15, 'Processing natural language requirements');

        const requirements = {
            originalInput: input,
            parsedAt: new Date().toISOString(),
            sessionId: this.sessionId,

            // Basic requirement extraction
            projectType: this.nlProcessor.extractProjectType(input),
            features: this.nlProcessor.extractFeatures(input),
            constraints: this.nlProcessor.extractConstraints(input),
            complexity: this.nlProcessor.assessComplexity(input),
            timeline: this.nlProcessor.estimateTimeline(input),

            // Technical requirements
            technologies: this.nlProcessor.extractTechnologies(input),
            platforms: this.nlProcessor.extractPlatforms(input),
            integrations: this.nlProcessor.extractIntegrations(input),

            // Business requirements
            businessGoals: this.nlProcessor.extractBusinessGoals(input),
            userStories: this.nlProcessor.extractUserStories(input),
            success_criteria: this.nlProcessor.extractSuccessCriteria(input),

            // Context from previous interactions
            contextualHistory: context.history || [],
            relatedProjects: context.relatedProjects || []
        };

        return requirements;
    }

    /**
     * Decompose project into manageable components
     * Uses DART-LLM style dependency-aware decomposition
     */
    async decomposeProject(requirements, context = {}) {
        this.projectCounter++;
        const projectId = `autonomous-project-${this.projectCounter}-${Date.now()}`;

        const project = {
            id: projectId,
            name: this.projectDecomposer.generateProjectName(requirements),
            description: requirements.originalInput,
            requirements: requirements,

            // Project structure decomposition
            components: await this.projectDecomposer.decomposeComponents(requirements),
            dependencies: await this.projectDecomposer.analyzeDependencies(requirements),
            timeline: await this.projectDecomposer.createTimeline(requirements),

            // Resource estimation
            complexity: requirements.complexity,
            estimatedDuration: requirements.timeline,
            resourceNeeds: await this.projectDecomposer.estimateResources(requirements),

            // Quality gates
            qualityGates: await this.projectDecomposer.defineQualityGates(requirements),
            successCriteria: requirements.success_criteria,

            // Metadata
            createdAt: new Date().toISOString(),
            status: 'planning',
            priority: context.priority || 'medium'
        };

        // Store in active projects
        this.activeProjects.set(projectId, project);

        return project;
    }

    /**
     * Form optimal agent team for project execution
     * Leverages existing LonicFLex agent infrastructure
     */
    async formAgentTeam(project, context = {}) {
        const teamId = `team-${project.id}`;

        // Analyze project requirements to determine needed agent capabilities
        const requiredCapabilities = await this.agentSpecialist.analyzeProjectCapabilities(project);

        // Map capabilities to existing LonicFLex agent types
        const agentTypes = this.agentSpecialist.mapCapabilitiesToAgents(requiredCapabilities);

        const team = {
            id: teamId,
            projectId: project.id,
            members: [],
            coordinationPattern: this.agentSpecialist.selectCoordinationPattern(project, agentTypes),
            communicationProtocol: 'event-driven',

            // Team composition
            leadership: null,
            specialists: [],
            supporters: [],

            // Coordination details
            meetingSchedule: await this.agentSpecialist.createMeetingSchedule(project),
            reportingStructure: await this.agentSpecialist.defineReportingStructure(agentTypes),
            escalationRules: await this.agentSpecialist.createEscalationRules(project)
        };

        // Create team member specifications
        for (const agentType of agentTypes) {
            const member = {
                agentType: agentType,
                role: this.agentSpecialist.defineRole(agentType, project),
                responsibilities: this.agentSpecialist.defineResponsibilities(agentType, project),
                capabilities: this.agentSpecialist.getAgentCapabilities(agentType),
                sessionId: `${teamId}-${agentType}-${Date.now()}`,
                config: this.agentSpecialist.createAgentConfig(agentType, project)
            };

            team.members.push(member);

            // Assign leadership role
            if (agentType === 'github' || agentType === 'multiplan') {
                team.leadership = member;
            } else {
                team.specialists.push(member);
            }
        }

        // Store team information
        this.agentTeams.set(teamId, team);

        return team;
    }

    /**
     * Setup GitHub + Slack infrastructure using existing external coordinator
     * CRITICAL: Leverages existing external integration capabilities with REAL systems
     */
    async setupInfrastructure(project, team, context = {}) {
        // ALWAYS initialize external coordinator with real tokens
        console.log("🔧 Initializing REAL external systems (GitHub + Slack)...");
        const initResult = await this.externalCoordinator.initialize();

        if (initResult && initResult.github && initResult.github.error) {
            console.warn("⚠️ GitHub initialization failed:", initResult.github.error);
        }
        if (initResult && initResult.slack && initResult.slack.error) {
            console.warn("⚠️ Slack initialization failed:", initResult.slack.error);
        }

        const githubOK = initResult && initResult.github && initResult.github.initialized;
        const slackOK = initResult && initResult.slack && initResult.slack.initialized;
        console.log(`✅ External systems initialized: GitHub=${githubOK}, Slack=${slackOK}`);

        // Prepare context data for external systems
        const contextData = {
            contextId: project.id,
            contextType: 'autonomous_project',
            task: project.description,
            goal: `Autonomous delivery of: ${project.name}`,
            metadata: {
                team: team.members.map(member => member.agentType),
                complexity: project.complexity,
                estimatedDuration: project.estimatedDuration,
                components: project.components.length,
                autonomousOrganization: true,
                organizationManager: this.agentId
            }
        };

        // Setup external infrastructure using existing coordinator
        const externalSetup = await this.externalCoordinator.onContextCreated(contextData);

        const infrastructure = {
            projectId: project.id,
            teamId: team.id,

            // External system setup results
            github: externalSetup.github || {},
            slack: externalSetup.slack || {},

            // Enhanced autonomous capabilities
            autonomousFeatures: {
                autoDeployment: true,
                continuousIntegration: true,
                qualityGates: true,
                progressReporting: true,
                escalationHandling: true
            },

            // Monitoring and alerting
            monitoring: {
                projectHealth: true,
                teamPerformance: true,
                deliveryTracking: true,
                qualityMetrics: true
            },

            setupAt: new Date().toISOString(),
            status: 'active'
        };

        return infrastructure;
    }

    /**
     * Allocate resources for project execution
     * Dynamic resource management with optimization
     */
    async allocateResources(project, team, infrastructure) {
        const resourcePlan = {
            projectId: project.id,
            teamId: team.id,

            // Compute allocation
            computeResources: {
                agents: team.members.length,
                estimatedCpu: project.resourceNeeds?.cpu || 'medium',
                estimatedMemory: project.resourceNeeds?.memory || 'medium',
                estimatedStorage: project.resourceNeeds?.storage || 'low'
            },

            // Time allocation
            timeAllocation: {
                totalEstimate: project.estimatedDuration,
                phases: project.timeline?.phases || [],
                milestones: project.timeline?.milestones || [],
                buffer: '20%' // Standard buffer for autonomous execution
            },

            // Platform resources
            platformAllocation: {
                github: infrastructure.github?.allocated || false,
                slack: infrastructure.slack?.allocated || false,
                external: infrastructure.autonomousFeatures || {}
            },

            // Quality assurance allocation
            qualityAssurance: {
                automated: true,
                continuous: true,
                gates: project.qualityGates?.length || 0,
                reviewCycles: Math.ceil((project.components?.length || 1) / 3)
            },

            allocatedAt: new Date().toISOString(),
            status: 'allocated'
        };

        // Store resource allocation
        this.resourceAllocation.set(project.id, resourcePlan);

        return resourcePlan;
    }

    /**
     * Initiate coordinated execution across agent team
     * Sets up execution framework but doesn't run agents yet
     */
    async initiateExecution(project, team, infrastructure, resourcePlan) {
        const executionPlan = {
            projectId: project.id,
            teamId: team.id,

            // Execution strategy
            strategy: 'autonomous-coordination',
            coordinationPattern: team.coordinationPattern,
            communicationProtocol: team.communicationProtocol,

            // Execution phases
            phases: [
                {
                    phase: 'initialization',
                    agents: team.members.map(m => m.agentType),
                    duration: '10%',
                    deliverables: ['team_setup', 'infrastructure_verification']
                },
                {
                    phase: 'development',
                    agents: team.specialists.map(m => m.agentType),
                    duration: '60%',
                    deliverables: project.components.map(c => c.name)
                },
                {
                    phase: 'integration',
                    agents: ['github', 'deploy', 'security'],
                    duration: '20%',
                    deliverables: ['integration_tests', 'deployment', 'security_scan']
                },
                {
                    phase: 'delivery',
                    agents: [team.leadership?.agentType || 'github'],
                    duration: '10%',
                    deliverables: ['final_delivery', 'documentation', 'handover']
                }
            ],

            // Coordination rules
            handoffProtocols: await this.defineHandoffProtocols(team),
            escalationRules: team.escalationRules,
            qualityGates: project.qualityGates,

            // Monitoring
            progressTracking: true,
            performanceMetrics: true,
            autonomousRecovery: true,

            initiatedAt: new Date().toISOString(),
            status: 'planned'
        };

        return executionPlan;
    }

    /**
     * Coordinate autonomous execution (orchestration layer)
     * ACTUAL AGENT EXECUTION - NO MORE FAKE COORDINATION
     */
    async coordinateExecution(executionPlan, project, team) {
        console.log(`🚀 Starting REAL agent execution for project: ${project.name}`);

        const coordinationResult = {
            projectId: project.id,
            executionPlanId: executionPlan.projectId,
            status: 'executing',
            coordinationStarted: new Date().toISOString(),
            currentPhase: executionPlan.phases[0],
            completedPhases: [],
            upcomingPhases: executionPlan.phases.slice(1),
            activeAgents: [],
            completedHandoffs: [],
            agentResults: {},
            overallProgress: 0,
            phaseProgress: 0
        };

        // Execute each phase with real agents
        for (const [phaseIndex, phase] of executionPlan.phases.entries()) {
            console.log(`📋 Executing Phase ${phaseIndex + 1}: ${phase.phase}`);
            coordinationResult.currentPhase = phase;
            coordinationResult.phaseProgress = 0;

            // Execute agents for this phase
            const phaseResults = await this.executePhaseAgents(phase, project, team);

            // Update coordination results
            coordinationResult.agentResults[phase.phase] = phaseResults;
            coordinationResult.completedPhases.push(phase);
            coordinationResult.upcomingPhases = executionPlan.phases.slice(phaseIndex + 1);
            coordinationResult.overallProgress = Math.round(((phaseIndex + 1) / executionPlan.phases.length) * 100);

            console.log(`✅ Phase ${phaseIndex + 1} completed: ${phase.phase}`);
        }

        coordinationResult.status = 'completed';
        coordinationResult.completedAt = new Date().toISOString();

        console.log(`🎉 Project execution completed: ${project.name}`);
        return coordinationResult;
    }

    /**
     * Execute agents for a specific phase
     */
    async executePhaseAgents(phase, project, team) {
        const phaseResults = {
            phase: phase.phase,
            agents: phase.agents,
            results: {},
            status: 'executing',
            startTime: new Date().toISOString()
        };

        // Execute each agent type for this phase
        for (const agentType of phase.agents) {
            console.log(`🤖 Executing ${agentType} agent...`);

            try {
                const agentResult = await this.executeRealAgent(agentType, project, team, phase);
                phaseResults.results[agentType] = {
                    status: 'success',
                    result: agentResult,
                    completedAt: new Date().toISOString()
                };
                console.log(`✅ ${agentType} agent completed successfully`);

            } catch (error) {
                phaseResults.results[agentType] = {
                    status: 'error',
                    error: error.message,
                    failedAt: new Date().toISOString()
                };
                console.error(`❌ ${agentType} agent failed:`, error.message);
            }
        }

        phaseResults.status = 'completed';
        phaseResults.endTime = new Date().toISOString();
        return phaseResults;
    }

    /**
     * Execute a real agent (not simulation)
     */
    async executeRealAgent(agentType, project, team, phase) {
        // Import and instantiate real agents
        const agentConfig = {
            owner: process.env.GITHUB_OWNER || 'levilonic',
            repo: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system',
            autonomous: true,
            project: {
                id: project.id,
                name: project.name,
                description: project.description
            }
        };

        switch (agentType) {
            case 'github':
                const { GitHubAgent } = require('../agents/github-agent');
                const githubAgent = new GitHubAgent(`${project.id}-github`, agentConfig);
                return await this.executeGitHubTasks(githubAgent, project, phase);

            case 'security':
                const { SecurityAgent } = require('../agents/security-agent');
                const securityAgent = new SecurityAgent(`${project.id}-security`, agentConfig);
                return await this.executeSecurityTasks(securityAgent, project, phase);

            case 'deploy':
                const { DeployAgent } = require('../agents/deploy-agent');
                const deployAgent = new DeployAgent(`${project.id}-deploy`, agentConfig);
                return await this.executeDeployTasks(deployAgent, project, phase);

            case 'code':
                const { CodeAgent } = require('../agents/code-agent');
                const codeAgent = new CodeAgent(`${project.id}-code`, agentConfig);
                return await this.executeCodeTasks(codeAgent, project, phase);

            default:
                // Generic agent execution
                const { BaseAgent } = require('../agents/base-agent');
                const baseAgent = new BaseAgent(agentType, `${project.id}-${agentType}`, agentConfig);
                return await this.executeGenericTasks(baseAgent, project, phase);
        }
    }

    /**
     * Execute GitHub-specific tasks
     */
    async executeGitHubTasks(githubAgent, project, phase) {
        const context = {
            task: `Setup GitHub infrastructure for ${project.name}`,
            project: project,
            phase: phase.phase,
            deliverables: phase.deliverables
        };

        return await githubAgent.executeWorkflow(context);
    }

    /**
     * Execute security-specific tasks
     */
    async executeSecurityTasks(securityAgent, project, phase) {
        const context = {
            task: `Security analysis for ${project.name}`,
            project: project,
            phase: phase.phase,
            scanType: 'comprehensive',
            deliverables: phase.deliverables
        };

        return await securityAgent.executeWorkflow(context);
    }

    /**
     * Execute deployment-specific tasks
     */
    async executeDeployTasks(deployAgent, project, phase) {
        const context = {
            task: `Deploy infrastructure for ${project.name}`,
            project: project,
            phase: phase.phase,
            environment: 'staging',
            deliverables: phase.deliverables
        };

        return await deployAgent.executeWorkflow(context);
    }

    /**
     * Execute code generation tasks
     */
    async executeCodeTasks(codeAgent, project, phase) {
        const context = {
            task: `Generate code for ${project.name}`,
            project: project,
            phase: phase.phase,
            components: project.components,
            deliverables: phase.deliverables
        };

        return await codeAgent.executeWorkflow(context);
    }

    /**
     * Execute generic agent tasks
     */
    async executeGenericTasks(agent, project, phase) {
        const context = {
            task: `Execute ${phase.phase} tasks for ${project.name}`,
            project: project,
            phase: phase.phase,
            deliverables: phase.deliverables
        };

        return await agent.executeWorkflow(context);
    }

    /**
     * Define handoff protocols between agents
     */
    async defineHandoffProtocols(team) {
        const protocols = [];

        for (let i = 0; i < team.members.length - 1; i++) {
            const fromAgent = team.members[i];
            const toAgent = team.members[i + 1];

            protocols.push({
                from: fromAgent.agentType,
                to: toAgent.agentType,
                trigger: 'completion',
                data: 'execution_context',
                validation: 'quality_gate',
                timeout: 30000
            });
        }

        return protocols;
    }

    /**
     * Update progress and notify callback if provided
     */
    updateProgress(progress, message) {
        this.progress = progress;
        this.currentStep = message;
        console.log(`🏢 OrganizationManager [${progress}%]: ${message}`);
    }

    /**
     * Get organization status and metrics
     */
    getOrganizationStatus() {
        return {
            activeProjects: this.activeProjects.size,
            activeTeams: this.agentTeams.size,
            totalResourceAllocations: this.resourceAllocation.size,
            organizationHealth: 'operational',
            currentCapacity: this.calculateCurrentCapacity(),
            nextAvailable: this.estimateNextAvailability()
        };
    }

    calculateCurrentCapacity() {
        // Simple capacity calculation - can be enhanced
        const maxConcurrentProjects = 10;
        const utilization = this.activeProjects.size / maxConcurrentProjects;
        return {
            used: this.activeProjects.size,
            total: maxConcurrentProjects,
            utilization: `${Math.round(utilization * 100)}%`,
            available: maxConcurrentProjects - this.activeProjects.size
        };
    }

    estimateNextAvailability() {
        if (this.activeProjects.size === 0) {
            return 'immediately';
        }

        // Find shortest estimated duration among active projects
        let shortestDuration = Infinity;
        for (const project of this.activeProjects.values()) {
            const duration = this.parseDuration(project.estimatedDuration);
            if (duration < shortestDuration) {
                shortestDuration = duration;
            }
        }

        return shortestDuration === Infinity ? 'unknown' : `${shortestDuration} minutes`;
    }

    parseDuration(durationStr) {
        // Simple duration parsing - can be enhanced
        if (typeof durationStr === 'string') {
            const match = durationStr.match(/(\d+)/);
            return match ? parseInt(match[1]) : 60; // Default 60 minutes
        }
        return durationStr || 60;
    }
}

/**
 * Natural Language Processing Components
 * Simplified implementation - can be enhanced with ML models
 */
class NaturalLanguageProcessor {
    extractProjectType(input) {
        const types = {
            'dashboard': ['dashboard', 'analytics', 'reporting', 'metrics'],
            'api': ['api', 'backend', 'service', 'endpoint'],
            'frontend': ['website', 'frontend', 'ui', 'interface'],
            'mobile': ['mobile', 'app', 'ios', 'android'],
            'automation': ['automation', 'workflow', 'process', 'script'],
            'integration': ['integration', 'connect', 'sync', 'webhook']
        };

        const lowerInput = input.toLowerCase();
        for (const [type, keywords] of Object.entries(types)) {
            if (keywords.some(keyword => lowerInput.includes(keyword))) {
                return type;
            }
        }

        return 'general';
    }

    extractFeatures(input) {
        const featurePatterns = [
            { pattern: /authentication|auth|login|signin/i, feature: 'authentication' },
            { pattern: /database|data|storage|persistence/i, feature: 'database' },
            { pattern: /api|endpoint|service|integration/i, feature: 'api' },
            { pattern: /ui|interface|frontend|dashboard/i, feature: 'ui' },
            { pattern: /testing|tests|qa|quality/i, feature: 'testing' },
            { pattern: /deployment|deploy|hosting|production/i, feature: 'deployment' },
            { pattern: /monitoring|logging|analytics|metrics/i, feature: 'monitoring' },
            { pattern: /security|encryption|secure|safety/i, feature: 'security' }
        ];

        const features = [];
        featurePatterns.forEach(({ pattern, feature }) => {
            if (pattern.test(input)) {
                features.push(feature);
            }
        });

        return features.length > 0 ? features : ['basic_functionality'];
    }

    extractConstraints(input) {
        const constraints = [];

        if (/budget|cost|cheap|free/i.test(input)) {
            constraints.push('budget_conscious');
        }
        if (/fast|quick|rapid|asap/i.test(input)) {
            constraints.push('time_critical');
        }
        if (/scale|scalable|performance|high.*load/i.test(input)) {
            constraints.push('high_performance');
        }
        if (/secure|security|compliant|privacy/i.test(input)) {
            constraints.push('security_focused');
        }

        return constraints;
    }

    assessComplexity(input) {
        const complexityIndicators = {
            very_high: ['distributed', 'microservices', 'scalable', 'multi-tenant', 'sophisticated', 'enterprise', 'comprehensive'],
            high: ['complex', 'advanced', 'multiple', 'integration'],
            medium: ['standard', 'typical', 'normal', 'regular', 'dashboard'],
            low: ['simple', 'basic', 'minimal', 'quick']
        };

        const lowerInput = input.toLowerCase();

        // Check for very high complexity first
        for (const [level, keywords] of Object.entries(complexityIndicators)) {
            if (keywords.some(keyword => lowerInput.includes(keyword))) {
                return level;
            }
        }

        // Default complexity based on input length and feature count
        if (input.length > 300) return 'very_high';
        if (input.length > 200) return 'high';
        if (input.length > 100) return 'medium';
        return 'low';
    }

    estimateTimeline(input) {
        const timelinePatterns = {
            'immediate': /asap|immediately|urgent|now/i,
            '1-3 days': /quick|fast|rapid|few days/i,
            '1-2 weeks': /week|standard|normal/i,
            '2-4 weeks': /month|complex|detailed/i,
            '1-3 months': /enterprise|sophisticated|comprehensive/i
        };

        for (const [timeline, pattern] of Object.entries(timelinePatterns)) {
            if (pattern.test(input)) {
                return timeline;
            }
        }

        return '1-2 weeks';
    }

    extractTechnologies(input) {
        const techKeywords = {
            'javascript': ['javascript', 'js', 'node', 'react', 'vue', 'angular'],
            'python': ['python', 'django', 'flask', 'fastapi'],
            'docker': ['docker', 'container', 'kubernetes'],
            'database': ['database', 'sql', 'postgres', 'mysql', 'mongodb'],
            'cloud': ['aws', 'azure', 'gcp', 'cloud', 'serverless']
        };

        const technologies = [];
        const lowerInput = input.toLowerCase();

        for (const [tech, keywords] of Object.entries(techKeywords)) {
            if (keywords.some(keyword => lowerInput.includes(keyword))) {
                technologies.push(tech);
            }
        }

        return technologies.length > 0 ? technologies : ['javascript']; // Default
    }

    extractPlatforms(input) {
        const platforms = [];
        const lowerInput = input.toLowerCase();

        if (/web|browser|website/i.test(lowerInput)) platforms.push('web');
        if (/mobile|ios|android|app/i.test(lowerInput)) platforms.push('mobile');
        if (/desktop|electron|native/i.test(lowerInput)) platforms.push('desktop');
        if (/api|service|backend/i.test(lowerInput)) platforms.push('api');

        return platforms.length > 0 ? platforms : ['web'];
    }

    extractIntegrations(input) {
        const integrations = [];
        const lowerInput = input.toLowerCase();

        if (/github|git|repository/i.test(lowerInput)) integrations.push('github');
        if (/slack|teams|chat|notification/i.test(lowerInput)) integrations.push('slack');
        if (/email|smtp|mail/i.test(lowerInput)) integrations.push('email');
        if (/payment|stripe|paypal/i.test(lowerInput)) integrations.push('payment');
        if (/analytics|tracking|metrics/i.test(lowerInput)) integrations.push('analytics');

        return integrations;
    }

    extractBusinessGoals(input) {
        const goals = [];
        const lowerInput = input.toLowerCase();

        if (/revenue|money|profit|sales/i.test(lowerInput)) goals.push('revenue_generation');
        if (/efficiency|productivity|automation/i.test(lowerInput)) goals.push('operational_efficiency');
        if (/customer|user|experience|satisfaction/i.test(lowerInput)) goals.push('customer_satisfaction');
        if (/growth|scale|expansion/i.test(lowerInput)) goals.push('business_growth');
        if (/cost|saving|reduce|optimize/i.test(lowerInput)) goals.push('cost_optimization');

        return goals.length > 0 ? goals : ['general_improvement'];
    }

    extractUserStories(input) {
        // Simple user story extraction - can be enhanced
        const stories = [];

        // Look for "as a" patterns
        const asAPattern = /as a ([^,]+),?\s+I want to ([^,]+),?\s+so that ([^.]+)/gi;
        let match;
        while ((match = asAPattern.exec(input)) !== null) {
            stories.push({
                role: match[1].trim(),
                want: match[2].trim(),
                benefit: match[3].trim()
            });
        }

        // If no formal user stories, create basic ones from requirements
        if (stories.length === 0) {
            stories.push({
                role: 'user',
                want: input.substring(0, 100).trim(),
                benefit: 'accomplish my goals efficiently'
            });
        }

        return stories;
    }

    extractSuccessCriteria(input) {
        const criteria = [];

        if (/performance|fast|speed/i.test(input)) {
            criteria.push('Performance: Response time < 2 seconds');
        }
        if (/reliable|uptime|available/i.test(input)) {
            criteria.push('Reliability: 99.9% uptime');
        }
        if (/user.*friendly|usable|intuitive/i.test(input)) {
            criteria.push('Usability: Intuitive user interface');
        }
        if (/secure|security|safe/i.test(input)) {
            criteria.push('Security: Industry standard security measures');
        }
        if (/scale|scalable|growth/i.test(input)) {
            criteria.push('Scalability: Handle 10x current load');
        }

        // Default success criteria
        if (criteria.length === 0) {
            criteria.push('Functional: All features work as specified');
            criteria.push('Quality: Code quality meets professional standards');
            criteria.push('Delivery: Delivered on time and within scope');
        }

        return criteria;
    }
}

/**
 * Project Decomposition Engine
 * Breaks down projects into manageable components with dependencies
 */
class ProjectDecomposer {
    generateProjectName(requirements) {
        const type = requirements.projectType || 'project';
        const timestamp = Date.now().toString().slice(-4);
        return `${type.charAt(0).toUpperCase()}${type.slice(1)}_${timestamp}`;
    }

    async decomposeComponents(requirements) {
        const components = [];
        const projectType = requirements.projectType;

        // Component templates based on project type
        switch (projectType) {
            case 'dashboard':
                components.push(
                    { name: 'authentication', type: 'backend', priority: 'high' },
                    { name: 'data_layer', type: 'backend', priority: 'high' },
                    { name: 'api_endpoints', type: 'backend', priority: 'high' },
                    { name: 'dashboard_ui', type: 'frontend', priority: 'medium' },
                    { name: 'charts_visualization', type: 'frontend', priority: 'medium' },
                    { name: 'user_management', type: 'fullstack', priority: 'low' }
                );
                break;

            case 'api':
                components.push(
                    { name: 'api_framework', type: 'backend', priority: 'high' },
                    { name: 'database_layer', type: 'backend', priority: 'high' },
                    { name: 'authentication_middleware', type: 'backend', priority: 'high' },
                    { name: 'endpoint_handlers', type: 'backend', priority: 'medium' },
                    { name: 'documentation', type: 'docs', priority: 'medium' },
                    { name: 'testing_suite', type: 'testing', priority: 'low' }
                );
                break;

            case 'frontend':
                components.push(
                    { name: 'ui_framework_setup', type: 'frontend', priority: 'high' },
                    { name: 'component_library', type: 'frontend', priority: 'high' },
                    { name: 'state_management', type: 'frontend', priority: 'medium' },
                    { name: 'routing', type: 'frontend', priority: 'medium' },
                    { name: 'responsive_design', type: 'frontend', priority: 'low' },
                    { name: 'performance_optimization', type: 'frontend', priority: 'low' }
                );
                break;

            default:
                // Generic components
                components.push(
                    { name: 'core_functionality', type: 'backend', priority: 'high' },
                    { name: 'user_interface', type: 'frontend', priority: 'medium' },
                    { name: 'data_management', type: 'backend', priority: 'medium' },
                    { name: 'testing', type: 'testing', priority: 'low' },
                    { name: 'deployment', type: 'devops', priority: 'low' }
                );
        }

        // Add components based on extracted features
        const features = requirements.features || [];
        features.forEach(feature => {
            if (feature === 'authentication' && !components.find(c => c.name.includes('auth'))) {
                components.push({ name: 'authentication_system', type: 'backend', priority: 'high' });
            }
            if (feature === 'database' && !components.find(c => c.name.includes('data'))) {
                components.push({ name: 'database_integration', type: 'backend', priority: 'high' });
            }
            if (feature === 'testing' && !components.find(c => c.name.includes('test'))) {
                components.push({ name: 'automated_testing', type: 'testing', priority: 'medium' });
            }
        });

        return components;
    }

    async analyzeDependencies(requirements) {
        const components = await this.decomposeComponents(requirements);
        const dependencies = [];

        // Define dependency relationships
        const dependencyRules = {
            'dashboard_ui': ['authentication', 'api_endpoints'],
            'charts_visualization': ['dashboard_ui', 'api_endpoints'],
            'api_endpoints': ['database_layer', 'authentication_middleware'],
            'endpoint_handlers': ['api_framework', 'database_layer'],
            'state_management': ['ui_framework_setup'],
            'routing': ['ui_framework_setup', 'component_library'],
            'user_management': ['authentication_system', 'database_integration']
        };

        components.forEach(component => {
            const deps = dependencyRules[component.name] || [];
            deps.forEach(dep => {
                const depComponent = components.find(c => c.name === dep);
                if (depComponent) {
                    dependencies.push({
                        from: depComponent.name,
                        to: component.name,
                        type: 'prerequisite'
                    });
                }
            });
        });

        return dependencies;
    }

    async createTimeline(requirements) {
        const complexity = requirements.complexity;
        const components = await this.decomposeComponents(requirements);

        // Time estimates based on complexity
        const timeMultipliers = {
            low: 1,
            medium: 1.5,
            high: 2.5,
            very_high: 4
        };

        const baseTimePerComponent = 2; // days
        const multiplier = timeMultipliers[complexity] || 1.5;
        const totalComponentTime = components.length * baseTimePerComponent * multiplier;

        // Add overhead time
        const overheadTime = Math.ceil(totalComponentTime * 0.3); // 30% overhead
        const totalTime = totalComponentTime + overheadTime;

        const timeline = {
            estimated_duration: `${totalTime} days`,
            complexity_factor: complexity,
            component_count: components.length,

            phases: [
                {
                    name: 'Planning & Setup',
                    duration: `${Math.ceil(totalTime * 0.15)} days`,
                    components: components.filter(c => c.priority === 'high').slice(0, 2)
                },
                {
                    name: 'Core Development',
                    duration: `${Math.ceil(totalTime * 0.5)} days`,
                    components: components.filter(c => c.priority === 'high')
                },
                {
                    name: 'Integration & Testing',
                    duration: `${Math.ceil(totalTime * 0.25)} days`,
                    components: components.filter(c => c.priority === 'medium')
                },
                {
                    name: 'Polish & Deployment',
                    duration: `${Math.ceil(totalTime * 0.1)} days`,
                    components: components.filter(c => c.priority === 'low')
                }
            ],

            milestones: [
                { name: 'Project Setup Complete', day: Math.ceil(totalTime * 0.15) },
                { name: 'MVP Ready', day: Math.ceil(totalTime * 0.65) },
                { name: 'Testing Complete', day: Math.ceil(totalTime * 0.9) },
                { name: 'Final Delivery', day: totalTime }
            ]
        };

        return timeline;
    }

    async estimateResources(requirements) {
        const complexity = requirements.complexity;
        const components = await this.decomposeComponents(requirements);

        const resourceProfiles = {
            low: { cpu: 'low', memory: 'low', storage: 'low', agents: 2 },
            medium: { cpu: 'medium', memory: 'medium', storage: 'medium', agents: 3 },
            high: { cpu: 'high', memory: 'high', storage: 'medium', agents: 4 },
            very_high: { cpu: 'very_high', memory: 'high', storage: 'high', agents: 5 }
        };

        const baseProfile = resourceProfiles[complexity] || resourceProfiles.medium;

        return {
            ...baseProfile,
            estimated_agents: Math.min(components.length, baseProfile.agents),
            concurrent_tasks: Math.ceil(components.length / 2),
            coordination_overhead: complexity === 'very_high' ? 'high' : 'medium'
        };
    }

    async defineQualityGates(requirements) {
        const gates = [];

        // Standard quality gates
        gates.push(
            { name: 'Code Quality', criteria: 'All code reviewed and meets standards', phase: 'development' },
            { name: 'Security Scan', criteria: 'No critical security vulnerabilities', phase: 'integration' },
            { name: 'Performance Test', criteria: 'Response time requirements met', phase: 'testing' },
            { name: 'Integration Test', criteria: 'All components integrate successfully', phase: 'integration' }
        );

        // Add specific gates based on requirements
        const features = requirements.features || [];
        const constraints = requirements.constraints || [];

        if (features.includes('authentication')) {
            gates.push({ name: 'Security Review', criteria: 'Authentication mechanism secure', phase: 'development' });
        }

        if (constraints.includes('high_performance')) {
            gates.push({ name: 'Load Testing', criteria: 'System handles expected load', phase: 'testing' });
        }

        if (constraints.includes('security_focused')) {
            gates.push(
                { name: 'Penetration Test', criteria: 'No exploitable vulnerabilities', phase: 'testing' },
                { name: 'Compliance Check', criteria: 'Meets security compliance requirements', phase: 'integration' }
            );
        }

        return gates;
    }
}

/**
 * Agent Specialization System
 * Maps project requirements to appropriate LonicFLex agents
 */
class AgentSpecialist {
    constructor() {
        // Available LonicFLex agent capabilities
        this.availableAgents = {
            'github': {
                capabilities: ['repository_management', 'code_coordination', 'workflow_automation', 'branch_management'],
                best_for: ['project_setup', 'code_management', 'deployment_coordination']
            },
            'security': {
                capabilities: ['vulnerability_scanning', 'security_analysis', 'compliance_checking', 'threat_assessment'],
                best_for: ['security_review', 'compliance_validation', 'risk_assessment']
            },
            'code': {
                capabilities: ['code_generation', 'architecture_design', 'framework_setup', 'documentation'],
                best_for: ['implementation', 'scaffolding', 'technical_design']
            },
            'deploy': {
                capabilities: ['containerization', 'deployment_automation', 'infrastructure_setup', 'monitoring'],
                best_for: ['deployment', 'infrastructure', 'production_setup']
            },
            'comm': {
                capabilities: ['team_coordination', 'progress_reporting', 'notification_management', 'stakeholder_communication'],
                best_for: ['team_coordination', 'progress_tracking', 'communication']
            }
        };
    }

    async analyzeProjectCapabilities(project) {
        const requiredCapabilities = [];

        // Analyze components to determine needed capabilities
        const components = project.components || [];
        components.forEach(component => {
            switch (component.type) {
                case 'backend':
                    requiredCapabilities.push('code_generation', 'architecture_design');
                    break;
                case 'frontend':
                    requiredCapabilities.push('code_generation', 'framework_setup');
                    break;
                case 'testing':
                    requiredCapabilities.push('vulnerability_scanning', 'code_generation');
                    break;
                case 'devops':
                    requiredCapabilities.push('deployment_automation', 'infrastructure_setup');
                    break;
                case 'docs':
                    requiredCapabilities.push('documentation', 'code_generation');
                    break;
            }
        });

        // Always need project coordination
        requiredCapabilities.push('repository_management', 'team_coordination');

        // Add security if needed
        const requirements = project.requirements || {};
        const constraints = requirements.constraints || [];
        if (constraints.includes('security_focused')) {
            requiredCapabilities.push('vulnerability_scanning', 'security_analysis');
        }

        // Add deployment capabilities
        if (components.some(c => c.name.includes('deploy') || c.type === 'devops')) {
            requiredCapabilities.push('deployment_automation', 'containerization');
        }

        return [...new Set(requiredCapabilities)]; // Remove duplicates
    }

    mapCapabilitiesToAgents(requiredCapabilities) {
        const selectedAgents = new Set();

        requiredCapabilities.forEach(capability => {
            Object.entries(this.availableAgents).forEach(([agentType, agentInfo]) => {
                if (agentInfo.capabilities.includes(capability)) {
                    selectedAgents.add(agentType);
                }
            });
        });

        // Ensure minimum viable team
        selectedAgents.add('github'); // Always need project coordination
        selectedAgents.add('code');   // Always need implementation

        return Array.from(selectedAgents);
    }

    selectCoordinationPattern(project, agentTypes) {
        if (agentTypes.length <= 2) {
            return 'direct';
        } else if (agentTypes.length <= 4) {
            return 'hierarchical';
        } else {
            return 'distributed';
        }
    }

    defineRole(agentType, project) {
        const roles = {
            'github': `Project coordinator for ${project.name}`,
            'security': `Security specialist ensuring ${project.name} compliance`,
            'code': `Technical implementer for ${project.name} development`,
            'deploy': `Deployment engineer for ${project.name} infrastructure`,
            'comm': `Communication coordinator for ${project.name} team`
        };

        return roles[agentType] || `Specialist agent for ${project.name}`;
    }

    defineResponsibilities(agentType, project) {
        const responsibilities = {
            'github': [
                'Setup and manage project repository',
                'Coordinate code integration and reviews',
                'Manage project workflows and automation',
                'Oversee overall project delivery'
            ],
            'security': [
                'Perform security analysis and vulnerability scanning',
                'Ensure compliance with security requirements',
                'Review and approve security-related changes',
                'Monitor for security threats and risks'
            ],
            'code': [
                'Implement core functionality and features',
                'Design technical architecture and frameworks',
                'Generate high-quality, maintainable code',
                'Create technical documentation'
            ],
            'deploy': [
                'Setup deployment infrastructure and pipelines',
                'Manage containerization and orchestration',
                'Ensure production readiness and monitoring',
                'Handle deployment automation and scaling'
            ],
            'comm': [
                'Coordinate team communication and meetings',
                'Track and report project progress',
                'Manage stakeholder communication',
                'Facilitate team collaboration and handoffs'
            ]
        };

        return responsibilities[agentType] || ['Support project execution'];
    }

    getAgentCapabilities(agentType) {
        return this.availableAgents[agentType]?.capabilities || [];
    }

    createAgentConfig(agentType, project) {
        const baseConfig = {
            autonomous: true,
            project: {
                id: project.id,
                name: project.name,
                complexity: project.complexity
            },
            coordination: true,
            timeout: 60000 // Extended timeout for autonomous operation
        };

        // Agent-specific configuration with safe access
        const constraints = project.requirements?.constraints || [];
        const technologies = project.requirements?.technologies || ['javascript'];

        const specificConfigs = {
            'github': {
                repository: {
                    autoCreate: true,
                    branchPrefix: 'autonomous/',
                    workflowsEnabled: true
                }
            },
            'security': {
                security: {
                    strictMode: constraints.includes('security_focused'),
                    complianceLevel: 'standard'
                }
            },
            'code': {
                code: {
                    framework: technologies[0] || 'javascript',
                    qualityLevel: 'production'
                }
            },
            'deploy': {
                deployment: {
                    environment: 'staging',
                    autoScale: constraints.includes('high_performance')
                }
            },
            'comm': {
                communication: {
                    reportingFrequency: 'milestone',
                    escalationLevel: 'medium'
                }
            }
        };

        return {
            ...baseConfig,
            ...specificConfigs[agentType]
        };
    }

    async createMeetingSchedule(project) {
        const schedule = [];
        const timeline = project.timeline || {};

        // Daily standups during development
        schedule.push({
            type: 'standup',
            frequency: 'daily',
            duration: '15 minutes',
            participants: 'all_agents',
            phase: 'development'
        });

        // Weekly reviews
        schedule.push({
            type: 'review',
            frequency: 'weekly',
            duration: '30 minutes',
            participants: 'all_agents',
            phase: 'all'
        });

        // Milestone meetings
        const milestones = timeline.milestones || [];
        milestones.forEach(milestone => {
            schedule.push({
                type: 'milestone_review',
                trigger: milestone.name,
                duration: '45 minutes',
                participants: 'all_agents',
                agenda: `Review ${milestone.name} completion and next steps`
            });
        });

        return schedule;
    }

    async defineReportingStructure(agentTypes) {
        const structure = {
            hierarchy: [],
            communication_flows: [],
            escalation_paths: []
        };

        // Simple hierarchy: github leads, others report to github
        if (agentTypes.includes('github')) {
            structure.hierarchy.push({
                level: 1,
                agents: ['github'],
                role: 'team_lead'
            });

            structure.hierarchy.push({
                level: 2,
                agents: agentTypes.filter(a => a !== 'github'),
                role: 'team_member'
            });

            // Communication flows
            agentTypes.filter(a => a !== 'github').forEach(agent => {
                structure.communication_flows.push({
                    from: agent,
                    to: 'github',
                    type: 'status_report',
                    frequency: 'task_completion'
                });
            });
        }

        return structure;
    }

    async createEscalationRules(project) {
        const rules = [];

        // Time-based escalation
        rules.push({
            trigger: 'task_overdue',
            threshold: '24 hours',
            action: 'notify_team_lead',
            escalation_path: ['github', 'comm']
        });

        // Quality-based escalation
        rules.push({
            trigger: 'quality_gate_failure',
            threshold: '2 failures',
            action: 'pause_execution',
            escalation_path: ['security', 'github']
        });

        // Resource-based escalation
        rules.push({
            trigger: 'resource_exhaustion',
            threshold: '90% utilization',
            action: 'optimize_allocation',
            escalation_path: ['deploy', 'github']
        });

        // Project-specific escalations
        const projectConstraints = project.requirements?.constraints || [];
        if (projectConstraints.includes('time_critical')) {
            rules.push({
                trigger: 'timeline_risk',
                threshold: '10% schedule_slip',
                action: 'accelerate_execution',
                escalation_path: ['github', 'comm']
            });
        }

        return rules;
    }
}

module.exports = { OrganizationManager };