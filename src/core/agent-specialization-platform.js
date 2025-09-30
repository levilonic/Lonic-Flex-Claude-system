#!/usr/bin/env node
const { info, warn, error } = require('../services/logger');
/**
 * Agent Specialization Platform
 * Phase 2 Implementation: Week 1, Days 2-3
 *
 * Dynamic agent lifecycle management with role-based specialization.
 * Provides intelligent agent instantiation, capability mapping, and resource allocation
 * for autonomous project execution.
 *
 * Integrates with existing LonicFLex agent infrastructure while adding autonomous capabilities.
 */

const { BaseAgent } = require('../agents/base-agent');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { EventEmitter } = require('events');

class AgentSpecializationPlatform extends EventEmitter {
    constructor(config = {}) {
        super();

        // Core platform configuration
        this.platformId = config.platformId || `agent-platform-${Date.now()}`;
        this.maxAgents = config.maxAgents || 100;
        this.resourceLimit = config.resourceLimit || 80; // % utilization

        // Agent management
        this.agentRegistry = new Map(); // agentId -> AgentInstance
        this.agentCapabilities = new Map(); // agentType -> capabilities
        this.specializedAgents = new Map(); // specialty -> [agentIds]
        this.agentLoadBalancer = new AgentLoadBalancer();

        // Resource management
        this.resourceAllocator = new ResourceAllocator(config.resources);
        this.performanceMonitor = new AgentPerformanceMonitor();

        // Context management
        this.contextManager = new Factor3ContextManager();

        // Agent factory
        this.agentFactory = new SpecializedAgentFactory(this);

        // Specialization profiles
        this.initializeSpecializationProfiles();

        // Platform metrics
        this.metrics = {
            agentsCreated: 0,
            agentsDestroyed: 0,
            tasksAssigned: 0,
            successfulHandoffs: 0,
            resourceUtilization: 0
        };

        info(`AGENT Agent Specialization Platform initialized: ${this.platformId}`);
    }

    /**
     * Initialize built-in agent specialization profiles
     */
    initializeSpecializationProfiles() {
        this.agentCapabilities.set('github', {
            primary: ['repository_management', 'code_coordination', 'workflow_automation', 'branch_management'],
            secondary: ['issue_tracking', 'pr_management', 'release_coordination', 'documentation'],
            tools: ['github_api', 'git_commands', 'workflow_creation', 'security_scanning'],
            coordination: ['project_leadership', 'team_coordination', 'progress_reporting'],
            specialties: ['devops', 'project_management', 'version_control']
        });

        this.agentCapabilities.set('security', {
            primary: ['vulnerability_scanning', 'security_analysis', 'compliance_checking', 'threat_assessment'],
            secondary: ['penetration_testing', 'audit_reporting', 'security_documentation', 'risk_analysis'],
            tools: ['security_scanners', 'compliance_tools', 'audit_systems', 'monitoring_tools'],
            coordination: ['security_review', 'risk_escalation', 'compliance_reporting'],
            specialties: ['cybersecurity', 'compliance', 'risk_management', 'audit']
        });

        this.agentCapabilities.set('code', {
            primary: ['code_generation', 'architecture_design', 'framework_setup', 'documentation'],
            secondary: ['refactoring', 'optimization', 'testing', 'debugging'],
            tools: ['development_frameworks', 'code_generators', 'testing_tools', 'debugging_tools'],
            coordination: ['technical_leadership', 'code_review', 'architecture_decisions'],
            specialties: ['full_stack', 'backend', 'frontend', 'mobile', 'data_science']
        });

        this.agentCapabilities.set('deploy', {
            primary: ['containerization', 'deployment_automation', 'infrastructure_setup', 'monitoring'],
            secondary: ['scaling', 'performance_tuning', 'disaster_recovery', 'maintenance'],
            tools: ['docker', 'kubernetes', 'cloud_platforms', 'monitoring_systems'],
            coordination: ['infrastructure_planning', 'deployment_coordination', 'incident_response'],
            specialties: ['devops', 'cloud_infrastructure', 'site_reliability', 'performance']
        });

        this.agentCapabilities.set('comm', {
            primary: ['team_coordination', 'progress_reporting', 'notification_management', 'stakeholder_communication'],
            secondary: ['meeting_coordination', 'documentation', 'feedback_collection', 'escalation_handling'],
            tools: ['slack_api', 'notification_systems', 'reporting_tools', 'communication_platforms'],
            coordination: ['team_leadership', 'cross_team_coordination', 'stakeholder_management'],
            specialties: ['project_management', 'team_leadership', 'communication', 'coordination']
        });

        info(`Initialized ${this.agentCapabilities.size} agent specialization profiles`);
    }

    /**
     * Create specialized agent instance based on requirements
     */
    async createSpecializedAgent(agentType, requirements, projectContext) {
        try {
            info(` Creating specialized ${agentType} agent for project: ${projectContext.projectId}`);

            // Check resource availability
            const resourceCheck = await this.resourceAllocator.checkAvailability(agentType, requirements);
            if (!resourceCheck.available) {
                throw new Error(`Insufficient resources for ${agentType} agent: ${resourceCheck.reason}`);
            }

            // Generate unique agent configuration
            const agentConfig = await this.generateAgentConfiguration(agentType, requirements, projectContext);

            // Create specialized agent instance
            const agent = await this.agentFactory.createAgent(agentType, agentConfig);

            // Register agent in platform
            this.registerAgent(agent, agentType, requirements, projectContext);

            // Allocate resources
            await this.resourceAllocator.allocateResources(agent.agentId, agentType, requirements);

            // Start performance monitoring
            this.performanceMonitor.startMonitoring(agent);

            // Update metrics
            this.metrics.agentsCreated++;
            this.updateResourceUtilization();

            this.emit('agentCreated', {
                agent: agent,
                agentType: agentType,
                projectId: projectContext.projectId,
                requirements: requirements
            });

            info(`Created specialized ${agentType} agent: ${agent.agentId}`);
            return agent;

        } catch (error) {
            error(`FAIL Failed to create ${agentType} agent:`, error);
            throw error;
        }
    }

    /**
     * Generate optimized configuration for agent based on specialization
     */
    async generateAgentConfiguration(agentType, requirements, projectContext) {
        const baseCapabilities = this.agentCapabilities.get(agentType);

        const config = {
            // Core agent settings
            agentType: agentType,
            sessionId: `${projectContext.projectId}-${agentType}-${Date.now()}`,
            autonomous: true,
            specialized: true,

            // Project context
            project: {
                id: projectContext.projectId,
                name: projectContext.projectName,
                complexity: projectContext.complexity,
                priority: projectContext.priority
            },

            // Specialization configuration
            specialization: {
                primary_capabilities: baseCapabilities.primary,
                secondary_capabilities: baseCapabilities.secondary,
                tools: baseCapabilities.tools,
                coordination_role: baseCapabilities.coordination,
                specialties: baseCapabilities.specialties
            },

            // Performance optimization
            performance: {
                maxConcurrentTasks: this.calculateOptimalConcurrency(agentType, requirements),
                timeout: this.calculateOptimalTimeout(agentType, projectContext.complexity),
                retryPolicy: this.createRetryPolicy(agentType),
                healthCheckInterval: 30000 // 30 seconds
            },

            // Resource allocation
            resources: {
                cpu: requirements.cpu || 'medium',
                memory: requirements.memory || 'medium',
                priority: requirements.priority || projectContext.priority || 'medium',
                exclusiveAccess: requirements.exclusiveAccess || false
            },

            // Coordination settings
            coordination: {
                communicationProtocol: 'event-driven',
                handoffTimeout: 60000, // 1 minute
                escalationThreshold: 3, // failures before escalation
                teamRole: this.determineTeamRole(agentType, projectContext)
            },

            // External integrations
            external: {
                github: agentType === 'github' ? this.createGitHubConfig(projectContext) : null,
                slack: agentType === 'comm' ? this.createSlackConfig(projectContext) : null,
                docker: agentType === 'deploy' ? this.createDockerConfig(projectContext) : null
            }
        };

        return config;
    }

    /**
     * Register agent in platform registry
     */
    registerAgent(agent, agentType, requirements, projectContext) {
        const registration = {
            agent: agent,
            agentType: agentType,
            projectId: projectContext.projectId,
            requirements: requirements,
            status: 'active',
            created: new Date(),
            lastActivity: new Date(),
            taskCount: 0,
            successRate: 1.0,
            metrics: {
                tasksCompleted: 0,
                tasksFailed: 0,
                averageTaskDuration: 0,
                resourceUsage: 0
            }
        };

        this.agentRegistry.set(agent.agentId, registration);

        // Add to specialized agent tracking
        const specialty = this.determineSpecialty(agentType, requirements);
        if (!this.specializedAgents.has(specialty)) {
            this.specializedAgents.set(specialty, []);
        }
        this.specializedAgents.get(specialty).push(agent.agentId);

        info(` Registered ${agentType} agent: ${agent.agentId} (specialty: ${specialty})`);
    }

    /**
     * Find optimal agent for task assignment
     */
    async findOptimalAgent(taskRequirements, projectContext) {
        const candidateAgents = [];

        // Find agents with matching capabilities
        for (const [agentId, registration] of this.agentRegistry.entries()) {
            if (registration.status !== 'active') continue;
            if (registration.projectId !== projectContext.projectId) continue;

            const capabilities = this.agentCapabilities.get(registration.agentType);
            const matchScore = this.calculateCapabilityMatch(taskRequirements, capabilities);

            if (matchScore > 0.5) { // 50% minimum match threshold
                const agent = registration.agent;
                const currentLoad = await this.performanceMonitor.getCurrentLoad(agent);

                candidateAgents.push({
                    agent: agent,
                    registration: registration,
                    matchScore: matchScore,
                    currentLoad: currentLoad,
                    successRate: registration.successRate,
                    availabilityScore: 1.0 - currentLoad
                });
            }
        }

        if (candidateAgents.length === 0) {
            throw new Error(`No agents available for task requirements: ${JSON.stringify(taskRequirements)}`);
        }

        // Calculate composite score and select optimal agent
        const scoredAgents = candidateAgents.map(candidate => ({
            ...candidate,
            compositeScore: this.calculateCompositeScore(candidate)
        }));

        scoredAgents.sort((a, b) => b.compositeScore - a.compositeScore);

        const optimalAgent = scoredAgents[0];
        info(`Selected optimal agent: ${optimalAgent.agent.agentId} (score: ${optimalAgent.compositeScore.toFixed(2)})`);

        return optimalAgent.agent;
    }

    /**
     * Assign task to agent through load balancer
     */
    async assignTask(task, projectContext) {
        try {
            const agent = await this.findOptimalAgent(task.requirements, projectContext);

            // Use load balancer for assignment
            const assignment = await this.agentLoadBalancer.assignTask(agent, task, projectContext);

            // Update metrics
            this.metrics.tasksAssigned++;
            this.updateAgentMetrics(agent.agentId, 'taskAssigned');

            this.emit('taskAssigned', {
                agent: agent,
                task: task,
                assignment: assignment
            });

            info(`Task assigned: ${task.id} -> ${agent.agentId}`);
            return assignment;

        } catch (error) {
            error('FAIL Task assignment failed:', error);
            throw error;
        }
    }

    /**
     * Handle agent handoff between tasks
     */
    async performAgentHandoff(fromAgent, toAgent, task, handoffData) {
        try {
            info(`CYCLE Performing agent handoff: ${fromAgent.agentId} -> ${toAgent.agentId}`);

            // Prepare handoff context
            const handoffContext = {
                task: task,
                data: handoffData,
                fromAgent: fromAgent.agentId,
                toAgent: toAgent.agentId,
                timestamp: new Date(),
                projectId: task.projectId
            };

            // Execute handoff through load balancer
            const handoffResult = await this.agentLoadBalancer.performHandoff(
                fromAgent, toAgent, handoffContext
            );

            // Update performance metrics
            if (handoffResult.success) {
                this.metrics.successfulHandoffs++;
                this.updateAgentMetrics(fromAgent.agentId, 'handoffSuccess');
                this.updateAgentMetrics(toAgent.agentId, 'handoffReceived');
            }

            this.emit('agentHandoff', {
                fromAgent: fromAgent,
                toAgent: toAgent,
                task: task,
                result: handoffResult
            });

            info(`PASS Agent handoff completed: ${handoffResult.success ? 'SUCCESS' : 'FAILED'}`);
            return handoffResult;

        } catch (error) {
            error('FAIL Agent handoff failed:', error);
            throw error;
        }
    }

    /**
     * Scale agent pool based on demand
     */
    async scaleAgentPool(projectContext, demandMetrics) {
        try {
            info(` Scaling agent pool for project: ${projectContext.projectId}`);

            const currentAgents = this.getProjectAgents(projectContext.projectId);
            const scalingDecision = this.calculateScalingNeed(currentAgents, demandMetrics);

            if (scalingDecision.action === 'scale_up') {
                const newAgents = [];
                for (const agentSpec of scalingDecision.agentsToCreate) {
                    const agent = await this.createSpecializedAgent(
                        agentSpec.type, agentSpec.requirements, projectContext
                    );
                    newAgents.push(agent);
                }

                info(`Scaled up: Created ${newAgents.length} new agents`);
                return { action: 'scaled_up', agents: newAgents };

            } else if (scalingDecision.action === 'scale_down') {
                const removedAgents = [];
                for (const agentId of scalingDecision.agentsToRemove) {
                    await this.destroyAgent(agentId);
                    removedAgents.push(agentId);
                }

                info(`Scaled down: Removed ${removedAgents.length} agents`);
                return { action: 'scaled_down', agents: removedAgents };

            } else {
                info(`No scaling needed: Current pool optimal`);
                return { action: 'no_change', agents: currentAgents };
            }

        } catch (error) {
            error('FAIL Agent pool scaling failed:', error);
            throw error;
        }
    }

    /**
     * Destroy agent and cleanup resources
     */
    async destroyAgent(agentId) {
        try {
            const registration = this.agentRegistry.get(agentId);
            if (!registration) {
                console.warn(`WARN Agent not found for destruction: ${agentId}`);
                return;
            }

            info(`DELETE Destroying agent: ${agentId}`);

            // Stop performance monitoring
            this.performanceMonitor.stopMonitoring(registration.agent);

            // Release resources
            await this.resourceAllocator.releaseResources(agentId);

            // Remove from specialized tracking
            for (const [specialty, agentIds] of this.specializedAgents.entries()) {
                const index = agentIds.indexOf(agentId);
                if (index !== -1) {
                    agentIds.splice(index, 1);
                }
            }

            // Cleanup agent
            if (registration.agent.cleanup && typeof registration.agent.cleanup === 'function') {
                await registration.agent.cleanup();
            }

            // Remove from registry
            this.agentRegistry.delete(agentId);

            // Update metrics
            this.metrics.agentsDestroyed++;
            this.updateResourceUtilization();

            this.emit('agentDestroyed', {
                agentId: agentId,
                agentType: registration.agentType,
                projectId: registration.projectId
            });

            info(`Agent destroyed: ${agentId}`);

        } catch (error) {
            error(`FAIL Failed to destroy agent ${agentId}:`, error);
            throw error;
        }
    }

    /**
     * Get platform performance metrics
     */
    getPlatformMetrics() {
        const activeAgents = Array.from(this.agentRegistry.values())
            .filter(reg => reg.status === 'active').length;

        const agentTypeDistribution = {};
        for (const registration of this.agentRegistry.values()) {
            agentTypeDistribution[registration.agentType] =
                (agentTypeDistribution[registration.agentType] || 0) + 1;
        }

        const resourceUsage = this.resourceAllocator.getResourceUsage();

        return {
            platform: {
                id: this.platformId,
                uptime: Date.now() - (this.startTime || Date.now()),
                status: 'operational'
            },
            agents: {
                total: this.agentRegistry.size,
                active: activeAgents,
                byType: agentTypeDistribution,
                maxCapacity: this.maxAgents,
                utilizationPercentage: (activeAgents / this.maxAgents * 100).toFixed(1)
            },
            performance: {
                ...this.metrics,
                resourceUtilization: this.metrics.resourceUtilization
            },
            resources: resourceUsage
        };
    }

    // Helper methods

    calculateOptimalConcurrency(agentType, requirements) {
        const baseConcurrency = { github: 3, security: 2, code: 4, deploy: 2, comm: 5 };
        const complexity = requirements.complexity || 'medium';
        const multiplier = { low: 0.7, medium: 1.0, high: 1.3, very_high: 1.5 };

        return Math.ceil((baseConcurrency[agentType] || 2) * (multiplier[complexity] || 1.0));
    }

    calculateOptimalTimeout(agentType, complexity) {
        const baseTimeout = { github: 180000, security: 300000, code: 240000, deploy: 600000, comm: 120000 };
        const complexityMultiplier = { low: 0.7, medium: 1.0, high: 1.5, very_high: 2.0 };

        return Math.ceil((baseTimeout[agentType] || 180000) * (complexityMultiplier[complexity] || 1.0));
    }

    createRetryPolicy(agentType) {
        return {
            maxRetries: agentType === 'deploy' ? 5 : 3,
            backoffStrategy: 'exponential',
            baseDelay: 5000,
            maxDelay: 60000
        };
    }

    determineTeamRole(agentType, projectContext) {
        const roles = {
            github: 'coordinator',
            security: 'reviewer',
            code: 'implementer',
            deploy: 'operator',
            comm: 'facilitator'
        };

        return roles[agentType] || 'contributor';
    }

    createGitHubConfig(projectContext) {
        return {
            owner: process.env.GITHUB_OWNER || 'levilonic',
            repo: process.env.GITHUB_REPO || 'Lonic-Flex-Claude-system',
            branch: `autonomous/${projectContext.projectId}`,
            autoCreateBranch: true,
            workflowsEnabled: true
        };
    }

    createSlackConfig(projectContext) {
        return {
            channel: `#project-${projectContext.projectId}`,
            autoNotify: true,
            richFormatting: true,
            escalationChannel: '#autonomous-ai-alerts'
        };
    }

    createDockerConfig(projectContext) {
        return {
            registryUrl: process.env.DOCKER_REGISTRY || 'docker.io',
            namespace: process.env.DOCKER_NAMESPACE || 'lonicflex',
            imagePrefix: `autonomous-${projectContext.projectId}`,
            autoCleanup: true
        };
    }

    calculateCapabilityMatch(requirements, capabilities) {
        const requiredCapabilities = requirements.capabilities || [];
        const primaryMatches = requiredCapabilities.filter(req =>
            capabilities.primary.includes(req)
        ).length;
        const secondaryMatches = requiredCapabilities.filter(req =>
            capabilities.secondary.includes(req)
        ).length;

        if (requiredCapabilities.length === 0) return 0.8; // Default match

        return (primaryMatches * 1.0 + secondaryMatches * 0.5) / requiredCapabilities.length;
    }

    calculateCompositeScore(candidate) {
        return (
            candidate.matchScore * 0.4 +
            candidate.availabilityScore * 0.3 +
            candidate.successRate * 0.3
        );
    }

    determineSpecialty(agentType, requirements) {
        const specialties = this.agentCapabilities.get(agentType)?.specialties || ['general'];
        return requirements.specialty || specialties[0];
    }

    getProjectAgents(projectId) {
        return Array.from(this.agentRegistry.values())
            .filter(reg => reg.projectId === projectId && reg.status === 'active')
            .map(reg => reg.agent);
    }

    calculateScalingNeed(currentAgents, demandMetrics) {
        // Simplified scaling logic - can be enhanced
        const currentLoad = demandMetrics.averageLoad || 0;
        const queueLength = demandMetrics.queueLength || 0;

        if (currentLoad > 0.8 || queueLength > 10) {
            return {
                action: 'scale_up',
                agentsToCreate: [{ type: 'code', requirements: { cpu: 'medium' } }]
            };
        } else if (currentLoad < 0.3 && currentAgents.length > 1) {
            return {
                action: 'scale_down',
                agentsToRemove: [currentAgents[currentAgents.length - 1].agentId]
            };
        } else {
            return { action: 'no_change' };
        }
    }

    updateAgentMetrics(agentId, event) {
        const registration = this.agentRegistry.get(agentId);
        if (registration) {
            registration.lastActivity = new Date();

            switch (event) {
                case 'taskAssigned':
                    registration.taskCount++;
                    break;
                case 'taskCompleted':
                    registration.metrics.tasksCompleted++;
                    break;
                case 'taskFailed':
                    registration.metrics.tasksFailed++;
                    break;
            }

            // Update success rate
            const total = registration.metrics.tasksCompleted + registration.metrics.tasksFailed;
            registration.successRate = total > 0 ? registration.metrics.tasksCompleted / total : 1.0;
        }
    }

    updateResourceUtilization() {
        const activeAgents = Array.from(this.agentRegistry.values())
            .filter(reg => reg.status === 'active').length;
        this.metrics.resourceUtilization = (activeAgents / this.maxAgents * 100);
    }
}

/**
 * Specialized Agent Factory
 * Creates agents with enhanced specialization capabilities
 */
class SpecializedAgentFactory {
    constructor(platform) {
        this.platform = platform;
        this.agentConstructors = new Map();
        this.initializeAgentConstructors();
    }

    initializeAgentConstructors() {
        // Import existing agent classes
        try {
            const { GitHubAgent } = require('../agents/github-agent');
            const { SecurityAgent } = require('../agents/security-agent');
            const { CodeAgent } = require('../agents/code-agent');
            const { DeployAgent } = require('../agents/deploy-agent');

            this.agentConstructors.set('github', GitHubAgent);
            this.agentConstructors.set('security', SecurityAgent);
            this.agentConstructors.set('code', CodeAgent);
            this.agentConstructors.set('deploy', DeployAgent);

            // Base agent for communication type
            this.agentConstructors.set('comm', BaseAgent);

            info(`Initialized ${this.agentConstructors.size} specialized agent constructors`);
        } catch (error) {
            console.warn('WARN Some agent constructors not available:', error.message);
            // Fallback to base agent
            this.agentConstructors.set('github', BaseAgent);
            this.agentConstructors.set('security', BaseAgent);
            this.agentConstructors.set('code', BaseAgent);
            this.agentConstructors.set('deploy', BaseAgent);
            this.agentConstructors.set('comm', BaseAgent);
        }
    }

    async createAgent(agentType, config) {
        const AgentConstructor = this.agentConstructors.get(agentType) || BaseAgent;

        const agent = new AgentConstructor(config.sessionId, config);

        // Add specialization enhancements
        this.enhanceAgentWithSpecialization(agent, config);

        return agent;
    }

    enhanceAgentWithSpecialization(agent, config) {
        // Add specialization metadata
        agent.specialization = config.specialization;
        agent.platformId = this.platform.platformId;
        agent.specialized = true;

        // Add platform communication methods
        agent.reportStatus = (status) => {
            this.platform.emit('agentStatus', {
                agentId: agent.agentId || agent.sessionId,
                status: status,
                timestamp: new Date()
            });
        };

        agent.requestHandoff = (targetAgentType, data) => {
            return this.platform.emit('handoffRequest', {
                fromAgent: agent.agentId || agent.sessionId,
                targetAgentType: targetAgentType,
                data: data
            });
        };

        // Enhanced error handling
        const originalExecuteWorkflow = agent.executeWorkflow;
        agent.executeWorkflow = async function(context, progressCallback) {
            try {
                agent.reportStatus('executing');
                const result = await originalExecuteWorkflow.call(this, context, progressCallback);
                agent.reportStatus('completed');
                return result;
            } catch (error) {
                agent.reportStatus('failed');
                throw error;
            }
        };
    }
}

/**
 * Agent Load Balancer
 * Distributes tasks optimally across specialized agents
 */
class AgentLoadBalancer {
    constructor() {
        this.taskQueues = new Map(); // agentId -> task queue
        this.loadMetrics = new Map(); // agentId -> load metrics
        this.assignmentHistory = []; // Recent assignments for optimization
    }

    async assignTask(agent, task, projectContext) {
        const agentId = agent.agentId || agent.sessionId;

        // Initialize queue if needed
        if (!this.taskQueues.has(agentId)) {
            this.taskQueues.set(agentId, []);
        }

        // Create assignment
        const assignment = {
            id: `assignment-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            agentId: agentId,
            taskId: task.id,
            projectId: projectContext.projectId,
            assigned: new Date(),
            priority: task.priority || 'medium',
            estimatedDuration: task.estimatedDuration || 3600000 // 1 hour default
        };

        // Add to queue
        this.taskQueues.get(agentId).push(assignment);

        // Update load metrics
        this.updateLoadMetrics(agentId);

        // Record assignment history
        this.assignmentHistory.push(assignment);
        if (this.assignmentHistory.length > 1000) {
            this.assignmentHistory.shift(); // Keep recent 1000
        }

        return assignment;
    }

    async performHandoff(fromAgent, toAgent, handoffContext) {
        const fromAgentId = fromAgent.agentId || fromAgent.sessionId;
        const toAgentId = toAgent.agentId || toAgent.sessionId;

        try {
            // Remove task from source agent queue
            const fromQueue = this.taskQueues.get(fromAgentId) || [];
            const taskIndex = fromQueue.findIndex(assignment =>
                assignment.taskId === handoffContext.task.id
            );

            if (taskIndex !== -1) {
                fromQueue.splice(taskIndex, 1);
            }

            // Add to target agent queue
            const handoffAssignment = {
                id: `handoff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                agentId: toAgentId,
                taskId: handoffContext.task.id,
                projectId: handoffContext.projectId,
                assigned: new Date(),
                priority: handoffContext.task.priority || 'medium',
                handoffFrom: fromAgentId,
                handoffData: handoffContext.data
            };

            if (!this.taskQueues.has(toAgentId)) {
                this.taskQueues.set(toAgentId, []);
            }
            this.taskQueues.get(toAgentId).push(handoffAssignment);

            // Update load metrics
            this.updateLoadMetrics(fromAgentId);
            this.updateLoadMetrics(toAgentId);

            const validation = { success: this.validateSuccess() };return {

                success: validation.success,
                fromAgent: fromAgentId,
                toAgent: toAgentId,
                assignment: handoffAssignment
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                fromAgent: fromAgentId,
                toAgent: toAgentId
            };
        }
    }

    updateLoadMetrics(agentId) {
        const queue = this.taskQueues.get(agentId) || [];
        const currentTime = new Date();

        // Calculate current load based on queue length and task priorities
        let loadScore = queue.length;
        for (const assignment of queue) {
            const priorityMultiplier = { low: 0.5, medium: 1.0, high: 1.5, critical: 2.0 };
            loadScore += priorityMultiplier[assignment.priority] || 1.0;
        }

        this.loadMetrics.set(agentId, {
            queueLength: queue.length,
            loadScore: loadScore,
            lastUpdated: currentTime
        });
    }

    getCurrentLoad(agent) {
        const agentId = agent.agentId || agent.sessionId;
        const metrics = this.loadMetrics.get(agentId);

        if (!metrics) return 0;

        // Normalize load score to 0-1 range
        return Math.min(metrics.loadScore / 10, 1.0);
    }
}

/**
 * Resource Allocator
 * Manages computational resources for specialized agents
 */
class ResourceAllocator {
    constructor(config = {}) {
        this.maxCpuUnits = config.maxCpuUnits || 100;
        this.maxMemoryUnits = config.maxMemoryUnits || 100;
        this.allocatedResources = new Map(); // agentId -> resource allocation

        this.resourceLimits = {
            cpu: { low: 10, medium: 25, high: 50, very_high: 80 },
            memory: { low: 15, medium: 30, high: 60, very_high: 90 }
        };
    }

    async checkAvailability(agentType, requirements) {
        const cpuNeed = this.resourceLimits.cpu[requirements.cpu] || 25;
        const memoryNeed = this.resourceLimits.memory[requirements.memory] || 30;

        const allocatedCpu = Array.from(this.allocatedResources.values())
            .reduce((sum, alloc) => sum + alloc.cpu, 0);
        const allocatedMemory = Array.from(this.allocatedResources.values())
            .reduce((sum, alloc) => sum + alloc.memory, 0);

        const availableCpu = this.maxCpuUnits - allocatedCpu;
        const availableMemory = this.maxMemoryUnits - allocatedMemory;

        if (cpuNeed > availableCpu) {
            return { available: false, reason: `Insufficient CPU: need ${cpuNeed}, available ${availableCpu}` };
        }

        if (memoryNeed > availableMemory) {
            return { available: false, reason: `Insufficient memory: need ${memoryNeed}, available ${availableMemory}` };
        }

        return { available: true, cpu: cpuNeed, memory: memoryNeed };
    }

    async allocateResources(agentId, agentType, requirements) {
        const allocation = {
            cpu: this.resourceLimits.cpu[requirements.cpu] || 25,
            memory: this.resourceLimits.memory[requirements.memory] || 30,
            allocated: new Date(),
            agentType: agentType
        };

        this.allocatedResources.set(agentId, allocation);

        info(`METRICS Allocated resources to ${agentId}: CPU=${allocation.cpu}, Memory=${allocation.memory}`);
        return allocation;
    }

    async releaseResources(agentId) {
        const allocation = this.allocatedResources.get(agentId);
        if (allocation) {
            this.allocatedResources.delete(agentId);
            info(`METRICS Released resources from ${agentId}: CPU=${allocation.cpu}, Memory=${allocation.memory}`);
        }
    }

    getResourceUsage() {
        const allocatedCpu = Array.from(this.allocatedResources.values())
            .reduce((sum, alloc) => sum + alloc.cpu, 0);
        const allocatedMemory = Array.from(this.allocatedResources.values())
            .reduce((sum, alloc) => sum + alloc.memory, 0);

        return {
            cpu: {
                allocated: allocatedCpu,
                available: this.maxCpuUnits - allocatedCpu,
                utilization: (allocatedCpu / this.maxCpuUnits * 100).toFixed(1) + '%'
            },
            memory: {
                allocated: allocatedMemory,
                available: this.maxMemoryUnits - allocatedMemory,
                utilization: (allocatedMemory / this.maxMemoryUnits * 100).toFixed(1) + '%'
            },
            agents: this.allocatedResources.size
        };
    }
}

/**
 * Agent Performance Monitor
 * Tracks and analyzes agent performance metrics
 */
class AgentPerformanceMonitor {
    constructor() {
        this.monitoredAgents = new Map(); // agentId -> monitoring data
        this.performanceHistory = new Map(); // agentId -> historical data
        this.alertThresholds = {
            taskFailureRate: 0.2, // 20%
            averageResponseTime: 300000, // 5 minutes
            memoryUsage: 0.8, // 80%
            errorRate: 0.1 // 10%
        };
    }

    startMonitoring(agent) {
        const agentId = agent.agentId || agent.sessionId;

        const monitoringData = {
            startTime: new Date(),
            taskCount: 0,
            successCount: 0,
            failureCount: 0,
            totalResponseTime: 0,
            lastActivity: new Date(),
            alerts: []
        };

        this.monitoredAgents.set(agentId, monitoringData);
        info(` Started monitoring agent: ${agentId}`);
    }

    stopMonitoring(agent) {
        const agentId = agent.agentId || agent.sessionId;

        const monitoringData = this.monitoredAgents.get(agentId);
        if (monitoringData) {
            // Archive performance history
            this.archivePerformanceHistory(agentId, monitoringData);
            this.monitoredAgents.delete(agentId);
            info(` Stopped monitoring agent: ${agentId}`);
        }
    }

    getCurrentLoad(agent) {
        const agentId = agent.agentId || agent.sessionId;
        const data = this.monitoredAgents.get(agentId);

        if (!data) return 0;

        // Simple load calculation based on task count and timing
        const timeSinceLastActivity = Date.now() - data.lastActivity.getTime();
        const activityFactor = timeSinceLastActivity < 60000 ? 0.8 : 0.2; // Recent activity
        const taskFactor = Math.min(data.taskCount / 10, 1.0); // Normalize to 10 tasks

        return activityFactor * taskFactor;
    }

    recordTaskResult(agentId, taskResult) {
        const data = this.monitoredAgents.get(agentId);
        if (!data) return;

        data.taskCount++;
        data.lastActivity = new Date();

        if (taskResult.success) {
            data.successCount++;
        } else {
            data.failureCount++;
        }

        if (taskResult.responseTime) {
            data.totalResponseTime += taskResult.responseTime;
        }

        // Check for performance alerts
        this.checkPerformanceAlerts(agentId, data);
    }

    checkPerformanceAlerts(agentId, data) {
        const failureRate = data.taskCount > 0 ? data.failureCount / data.taskCount : 0;
        const averageResponseTime = data.taskCount > 0 ? data.totalResponseTime / data.taskCount : 0;

        // Check failure rate
        if (failureRate > this.alertThresholds.taskFailureRate) {
            const alert = {
                type: 'high_failure_rate',
                value: failureRate,
                threshold: this.alertThresholds.taskFailureRate,
                timestamp: new Date()
            };
            data.alerts.push(alert);
            console.warn(`WARN High failure rate alert for ${agentId}: ${(failureRate * 100).toFixed(1)}%`);
        }

        // Check response time
        if (averageResponseTime > this.alertThresholds.averageResponseTime) {
            const alert = {
                type: 'slow_response',
                value: averageResponseTime,
                threshold: this.alertThresholds.averageResponseTime,
                timestamp: new Date()
            };
            data.alerts.push(alert);
            console.warn(`WARN Slow response alert for ${agentId}: ${(averageResponseTime / 1000).toFixed(1)}s`);
        }
    }

    archivePerformanceHistory(agentId, monitoringData) {
        const history = {
            ...monitoringData,
            endTime: new Date(),
            successRate: monitoringData.taskCount > 0 ?
                monitoringData.successCount / monitoringData.taskCount : 0,
            averageResponseTime: monitoringData.taskCount > 0 ?
                monitoringData.totalResponseTime / monitoringData.taskCount : 0
        };

        if (!this.performanceHistory.has(agentId)) {
            this.performanceHistory.set(agentId, []);
        }
        this.performanceHistory.get(agentId).push(history);

        // Keep only recent 100 entries
        const agentHistory = this.performanceHistory.get(agentId);
        if (agentHistory.length > 100) {
            agentHistory.shift();
        }
    }

    getPerformanceMetrics(agentId) {
        const currentData = this.monitoredAgents.get(agentId);
        const history = this.performanceHistory.get(agentId) || [];

        if (!currentData) {
            return { error: 'Agent not being monitored' };
        }

        return {
            current: {
                taskCount: currentData.taskCount,
                successRate: currentData.taskCount > 0 ?
                    currentData.successCount / currentData.taskCount : 0,
                failureRate: currentData.taskCount > 0 ?
                    currentData.failureCount / currentData.taskCount : 0,
                averageResponseTime: currentData.taskCount > 0 ?
                    currentData.totalResponseTime / currentData.taskCount : 0,
                uptime: Date.now() - currentData.startTime.getTime(),
                alerts: currentData.alerts.length
            },
            history: history.slice(-10) // Recent 10 entries
        };
    }
}

module.exports = {
    AgentSpecializationPlatform,
    SpecializedAgentFactory,
    AgentLoadBalancer,
    ResourceAllocator,
    AgentPerformanceMonitor
};