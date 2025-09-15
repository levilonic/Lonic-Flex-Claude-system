#!/usr/bin/env node
/**
 * Agent Role Assignment System
 * Manages clear responsibilities and coordination protocols for collaborative agents
 * Part of LonicFLex Collaborative Workspace System
 */

const { Factor3ContextManager } = require('./factor3-context-manager');
const { AGENT_SKILLS } = require('./multi-agent-planning-engine');

/**
 * Role responsibility templates
 */
const ROLE_TEMPLATES = {
    github: {
        primary_responsibilities: [
            'Repository state management and coordination',
            'Branch creation and management for team work',
            'Pull request coordination between agents',
            'Issue tracking and milestone management'
        ],
        coordination_duties: [
            'Provide repository access to other agents',
            'Coordinate branch merging and conflict resolution',
            'Track overall project progress in GitHub',
            'Manage external contributor communication'
        ],
        communication_protocols: [
            'Broadcast branch creation/deletion to team',
            'Notify team of PR status changes',
            'Share repository insights with other agents'
        ]
    },
    
    security: {
        primary_responsibilities: [
            'Continuous security monitoring during development',
            'Vulnerability scanning of code changes',
            'Compliance validation for security requirements',
            'Risk assessment and mitigation strategies'
        ],
        coordination_duties: [
            'Block unsafe code from deployment pipeline',
            'Provide security clearance to DeployAgent',
            'Share threat intelligence with CodeAgent',
            'Validate authentication/authorization changes'
        ],
        communication_protocols: [
            'Alert team immediately of critical vulnerabilities',
            'Provide security recommendations to CodeAgent',
            'Report compliance status to management via CommAgent'
        ]
    },
    
    code: {
        primary_responsibilities: [
            'Code implementation and architecture decisions',
            'Code quality assurance and testing',
            'Integration with existing codebase',
            'Documentation of code changes'
        ],
        coordination_duties: [
            'Incorporate security recommendations from SecurityAgent',
            'Coordinate with GitHubAgent for code reviews',
            'Provide deployment artifacts to DeployAgent',
            'Share implementation updates with team'
        ],
        communication_protocols: [
            'Request code review from GitHubAgent when ready',
            'Query SecurityAgent before implementing sensitive features',
            'Notify DeployAgent when artifacts are ready'
        ]
    },
    
    deploy: {
        primary_responsibilities: [
            'Deployment pipeline management and execution',
            'Infrastructure provisioning and management',
            'CI/CD coordination and monitoring',
            'Environment management (staging/production)'
        ],
        coordination_duties: [
            'Wait for security clearance before deployment',
            'Coordinate with GitHubAgent for release management',
            'Provide deployment status to CommAgent',
            'Manage rollback procedures if needed'
        ],
        communication_protocols: [
            'Confirm deployment readiness with all agents',
            'Broadcast deployment status to team',
            'Escalate deployment issues immediately'
        ]
    },
    
    comm: {
        primary_responsibilities: [
            'Team communication and status aggregation',
            'Slack channel management and notifications',
            'Progress reporting to stakeholders',
            'Meeting and milestone coordination'
        ],
        coordination_duties: [
            'Aggregate status from all agents for reporting',
            'Coordinate cross-agent communication needs',
            'Manage external stakeholder communications',
            'Facilitate conflict resolution between agents'
        ],
        communication_protocols: [
            'Send regular status updates to team channels',
            'Escalate blocked issues to appropriate agents',
            'Coordinate milestone celebrations and announcements'
        ]
    }
};

/**
 * Agent communication patterns
 */
const COMMUNICATION_PATTERNS = {
    // Direct agent-to-agent communication needs
    direct_communication: {
        'github-security': 'Repository access, branch protection rules',
        'github-code': 'Code review coordination, merge conflicts',
        'github-deploy': 'Release coordination, tagging',
        'security-code': 'Vulnerability remediation, security requirements',
        'security-deploy': 'Security clearance, deployment approval',
        'code-deploy': 'Artifact handoff, deployment requirements',
        'comm-all': 'Status updates, progress reporting'
    },
    
    // Broadcast communication (one-to-many)
    broadcast_patterns: {
        'critical_security_alert': ['security -> all'],
        'deployment_status': ['deploy -> all'],
        'milestone_achieved': ['comm -> all'],
        'blocking_issue': ['any -> all']
    },
    
    // Resource sharing patterns
    resource_sharing: {
        'repository_access': 'github provides to all',
        'security_clearance': 'security provides to deploy',
        'deployment_artifacts': 'code provides to deploy',
        'status_aggregation': 'all provide to comm'
    }
};

class AgentRoleAssignmentSystem {
    constructor(options = {}) {
        this.contextManager = new Factor3ContextManager({
            contextScope: 'project',
            contextId: options.contextId || `roles_${Date.now()}`
        });
        
        this.assignments = new Map(); // agentName -> roleAssignment
        this.communicationMatrix = new Map(); // agent pairs -> protocols
        this.resourceRegistry = new Map(); // resource -> owner/consumers
        this.conflictResolutionRules = new Map();
        
        this.workspaceId = options.workspaceId;
        this.teamPlan = options.teamPlan;
    }

    /**
     * Create role assignments from team plan
     */
    async createRoleAssignments(teamPlan) {
        console.log('👥 Creating detailed role assignments...');
        
        this.teamPlan = teamPlan;
        
        for (const agentPlan of teamPlan.agents) {
            const assignment = await this.createAgentRoleAssignment(agentPlan);
            this.assignments.set(agentPlan.agent, assignment);
        }
        
        // Set up communication matrix
        await this.setupCommunicationMatrix();
        
        // Set up resource sharing
        await this.setupResourceSharing();
        
        // Set up conflict resolution
        await this.setupConflictResolution();
        
        console.log(`   ✅ Role assignments created for ${this.assignments.size} agents`);
        return this.getRoleAssignmentSummary();
    }

    /**
     * Create detailed role assignment for individual agent
     */
    async createAgentRoleAssignment(agentPlan) {
        const template = ROLE_TEMPLATES[agentPlan.agent];
        if (!template) {
            throw new Error(`No role template found for agent: ${agentPlan.agent}`);
        }

        const assignment = {
            agent: agentPlan.agent,
            name: agentPlan.name,
            
            // Core responsibilities
            primary_responsibilities: [...template.primary_responsibilities],
            coordination_duties: [...template.coordination_duties],
            
            // Project-specific tasks from planning
            project_tasks: agentPlan.responsibilities || [],
            estimated_effort: agentPlan.estimatedEffort,
            dependencies: agentPlan.dependencies || [],
            
            // Communication setup
            communication_protocols: [...template.communication_protocols],
            required_communications: this.getRequiredCommunications(agentPlan.agent),
            
            // Resource management
            resources_provided: this.getResourcesProvided(agentPlan.agent),
            resources_needed: this.getResourcesNeeded(agentPlan.agent, agentPlan.dependencies),
            
            // Status and coordination
            status_reporting: {
                frequency: this.getStatusFrequency(agentPlan.agent),
                format: 'universal_context_events',
                recipients: ['comm', 'all_agents']
            },
            
            // Conflict resolution authority
            conflict_resolution: {
                can_block: this.getBlockingAuthority(agentPlan.agent),
                escalation_path: this.getEscalationPath(agentPlan.agent),
                decision_authority: this.getDecisionAuthority(agentPlan.agent)
            },
            
            // Success criteria
            success_criteria: this.getAgentSuccessCriteria(agentPlan.agent, agentPlan),
            
            // Context coordination
            context_coordination: {
                context_id: this.contextManager.contextId,
                save_frequency: 'after_each_task',
                share_with_agents: this.getContextSharingList(agentPlan.agent),
                critical_events: this.getCriticalEvents(agentPlan.agent)
            }
        };
        
        return assignment;
    }

    /**
     * Setup communication matrix between agents
     */
    async setupCommunicationMatrix() {
        console.log('📡 Setting up agent communication matrix...');
        
        const agents = Array.from(this.assignments.keys());
        
        // Create communication protocols for each agent pair
        for (let i = 0; i < agents.length; i++) {
            for (let j = i + 1; j < agents.length; j++) {
                const agent1 = agents[i];
                const agent2 = agents[j];
                const pairKey = `${agent1}-${agent2}`;
                
                const protocol = {
                    agents: [agent1, agent2],
                    communication_method: 'universal_context_events',
                    message_types: this.getMessageTypes(agent1, agent2),
                    frequency: this.getCommunicationFrequency(agent1, agent2),
                    priority_levels: ['critical', 'high', 'normal', 'low'],
                    conflict_resolution: 'escalate_to_comm_agent'
                };
                
                this.communicationMatrix.set(pairKey, protocol);
            }
        }
        
        console.log(`   ✅ Communication protocols established for ${this.communicationMatrix.size} agent pairs`);
    }

    /**
     * Setup resource sharing between agents
     */
    async setupResourceSharing() {
        console.log('🔄 Setting up resource sharing protocols...');
        
        const resourceMap = {
            'repository_access': { provider: 'github', consumers: ['security', 'code', 'deploy'] },
            'security_clearance': { provider: 'security', consumers: ['deploy'] },
            'code_artifacts': { provider: 'code', consumers: ['deploy', 'github'] },
            'deployment_status': { provider: 'deploy', consumers: ['github', 'comm'] },
            'communication_channels': { provider: 'comm', consumers: ['github', 'security', 'code', 'deploy'] }
        };
        
        for (const [resource, config] of Object.entries(resourceMap)) {
            // Only include agents that are actually assigned
            const availableConsumers = config.consumers.filter(agent => this.assignments.has(agent));
            
            if (this.assignments.has(config.provider) && availableConsumers.length > 0) {
                this.resourceRegistry.set(resource, {
                    provider: config.provider,
                    consumers: availableConsumers,
                    access_method: 'universal_context_sharing',
                    update_frequency: 'real_time',
                    conflict_resolution: 'provider_authority'
                });
            }
        }
        
        console.log(`   ✅ Resource sharing configured for ${this.resourceRegistry.size} resources`);
    }

    /**
     * Setup conflict resolution rules
     */
    async setupConflictResolution() {
        console.log('⚖️ Setting up conflict resolution protocols...');
        
        const resolutionRules = new Map([
            ['resource_contention', {
                description: 'Multiple agents need same resource',
                resolution: 'resource_provider_decides',
                escalation: 'comm_agent_mediates',
                timeout: '30_minutes'
            }],
            ['conflicting_decisions', {
                description: 'Agents make conflicting decisions',
                resolution: 'domain_expert_authority',
                escalation: 'human_intervention',
                timeout: '60_minutes'
            }],
            ['blocking_dependencies', {
                description: 'Agent blocks other agents progress',
                resolution: 'dependency_owner_resolves',
                escalation: 'comm_agent_escalates',
                timeout: '15_minutes'
            }],
            ['communication_failures', {
                description: 'Agent not responding to communications',
                resolution: 'comm_agent_intervention',
                escalation: 'system_restart',
                timeout: '10_minutes'
            }]
        ]);
        
        this.conflictResolutionRules = resolutionRules;
        console.log(`   ✅ Conflict resolution rules established for ${resolutionRules.size} scenarios`);
    }

    /**
     * Helper methods for role assignment details
     */
    getRequiredCommunications(agentName) {
        const communications = [];
        const dependencies = this.assignments.get(agentName)?.dependencies || [];
        
        dependencies.forEach(dep => {
            communications.push(`Status updates from ${dep}`);
            communications.push(`Resource coordination with ${dep}`);
        });
        
        return communications;
    }

    getResourcesProvided(agentName) {
        const resources = [];
        for (const [resource, config] of this.resourceRegistry) {
            if (config.provider === agentName) {
                resources.push(resource);
            }
        }
        return resources;
    }

    getResourcesNeeded(agentName, dependencies) {
        const resources = [];
        for (const [resource, config] of this.resourceRegistry) {
            if (config.consumers.includes(agentName)) {
                resources.push(resource);
            }
        }
        return resources;
    }

    getStatusFrequency(agentName) {
        const frequencies = {
            github: 'every_major_action',
            security: 'every_scan_completion', 
            code: 'every_feature_completion',
            deploy: 'every_deployment_step',
            comm: 'every_hour'
        };
        return frequencies[agentName] || 'every_30_minutes';
    }

    getBlockingAuthority(agentName) {
        const authority = {
            github: ['merge_conflicts', 'branch_protection'],
            security: ['critical_vulnerabilities', 'compliance_failures'],
            code: ['breaking_changes', 'test_failures'],
            deploy: ['deployment_failures', 'infrastructure_issues'],
            comm: ['communication_breakdown']
        };
        return authority[agentName] || [];
    }

    getEscalationPath(agentName) {
        return ['comm_agent', 'human_operator', 'system_administrator'];
    }

    getDecisionAuthority(agentName) {
        const authority = {
            github: ['repository_structure', 'branch_strategy', 'merge_policies'],
            security: ['security_policies', 'vulnerability_response', 'compliance_requirements'],
            code: ['architecture_decisions', 'code_quality_standards', 'testing_requirements'],
            deploy: ['deployment_strategy', 'infrastructure_changes', 'rollback_decisions'],
            comm: ['communication_policies', 'escalation_procedures', 'status_reporting']
        };
        return authority[agentName] || [];
    }

    getAgentSuccessCriteria(agentName, agentPlan) {
        const baseCriteria = {
            github: ['Repository properly managed', 'All PRs reviewed and merged', 'Issues tracked to completion'],
            security: ['No critical vulnerabilities in deployment', 'All security scans passed', 'Compliance requirements met'],
            code: ['All features implemented per requirements', 'Code quality standards met', 'Tests passing'],
            deploy: ['Successful deployment to target environment', 'No deployment rollbacks required', 'Infrastructure stable'],
            comm: ['All stakeholders informed', 'Team coordination successful', 'No communication breakdowns']
        };
        
        return baseCriteria[agentName] || ['Agent tasks completed successfully'];
    }

    getContextSharingList(agentName) {
        // Most agents need to share with everyone for coordination
        return ['all_agents'];
    }

    getCriticalEvents(agentName) {
        const events = {
            github: ['merge_conflict', 'branch_protection_violation', 'pr_approval_needed'],
            security: ['critical_vulnerability_found', 'compliance_failure', 'security_scan_failed'],
            code: ['build_failure', 'test_failures', 'breaking_change_detected'],
            deploy: ['deployment_failure', 'infrastructure_down', 'rollback_required'],
            comm: ['communication_breakdown', 'escalation_required', 'milestone_missed']
        };
        return events[agentName] || [];
    }

    getMessageTypes(agent1, agent2) {
        return ['status_update', 'resource_request', 'coordination_needed', 'conflict_alert', 'task_complete'];
    }

    getCommunicationFrequency(agent1, agent2) {
        // High frequency pairs
        const highFrequency = [
            ['github', 'code'], ['security', 'deploy'], ['code', 'deploy']
        ];
        
        if (highFrequency.some(pair => 
            (pair[0] === agent1 && pair[1] === agent2) || 
            (pair[0] === agent2 && pair[1] === agent1)
        )) {
            return 'real_time';
        }
        
        return 'as_needed';
    }

    /**
     * Get role assignment summary
     */
    getRoleAssignmentSummary() {
        const summary = {
            workspace_id: this.workspaceId,
            total_agents: this.assignments.size,
            assignments: Array.from(this.assignments.values()),
            communication_matrix: Array.from(this.communicationMatrix.entries()),
            resource_sharing: Array.from(this.resourceRegistry.entries()),
            conflict_resolution: Array.from(this.conflictResolutionRules.entries()),
            coordination_hub: 'universal_context_system'
        };
        
        return summary;
    }

    /**
     * Save role assignments to Universal Context
     */
    async saveToUniversalContext() {
        console.log('💾 Saving role assignments to Universal Context...');
        
        await this.contextManager.addEvent('role_assignments_created', {
            assignments: this.getRoleAssignmentSummary(),
            timestamp: new Date().toISOString(),
            ready_for_execution: true
        });
        
        console.log('   ✅ Role assignments saved to Universal Context');
    }
}

module.exports = { AgentRoleAssignmentSystem, ROLE_TEMPLATES, COMMUNICATION_PATTERNS };

// Demo/test functionality
if (require.main === module) {
    async function demoRoleAssignment() {
        console.log('👥 Agent Role Assignment System Demo\n');
        
        // Mock team plan from planning engine
        const mockTeamPlan = {
            agents: [
                { agent: 'github', name: 'GitHubAgent', dependencies: [] },
                { agent: 'security', name: 'SecurityAgent', dependencies: ['github'] },
                { agent: 'code', name: 'CodeAgent', dependencies: ['github', 'security'] },
                { agent: 'deploy', name: 'DeployAgent', dependencies: ['code', 'security'] },
                { agent: 'comm', name: 'CommAgent', dependencies: [] }
            ]
        };
        
        const roleSystem = new AgentRoleAssignmentSystem({
            workspaceId: 'demo_workspace'
        });
        
        const assignments = await roleSystem.createRoleAssignments(mockTeamPlan);
        
        console.log('\n📋 ROLE ASSIGNMENT SUMMARY:');
        console.log(`   Total agents: ${assignments.total_agents}`);
        console.log(`   Communication pairs: ${assignments.communication_matrix.length}`);
        console.log(`   Shared resources: ${assignments.resource_sharing.length}`);
        
        console.log('\n👥 AGENT RESPONSIBILITIES:');
        assignments.assignments.forEach(assignment => {
            console.log(`   ${assignment.name}:`);
            console.log(`     Primary: ${assignment.primary_responsibilities.length} responsibilities`);
            console.log(`     Coordination: ${assignment.coordination_duties.length} duties`);
            console.log(`     Resources provided: ${assignment.resources_provided.length}`);
            console.log(`     Resources needed: ${assignment.resources_needed.length}`);
        });
        
        await roleSystem.saveToUniversalContext();
        
        console.log('\n✅ Role assignment demo complete');
    }
    
    demoRoleAssignment().catch(console.error);
}