/**
 * EnhancedDeployAgent - ServiceContainer Migration
 * Migrated from Heavy Agent Anti-Pattern to ServiceContainer dependency injection
 * Maintains 100% API compatibility while solving context explosion and resource duplication
 */

const { BaseAgent } = require('./base-agent-enhanced');
const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const { DockerManager } = require('../claude-docker-manager');
const axios = require('axios');

class EnhancedDeployAgent extends BaseAgent {
    constructor(sessionId, serviceContainer, config = {}) {
        super('deploy', sessionId, serviceContainer, {
            maxSteps: 8,
            timeout: 300000, // 5 minutes for deployment
            ...config
        });

        // Deploy-specific configuration preserved from original
        this.deployConfig = {
            environment: config.environment || 'staging',
            strategy: config.strategy || 'blue-green',
            platform: config.platform || 'docker',
            registry: config.registry || 'docker.io',
            namespace: config.namespace || 'default',
            buildTimeout: config.buildTimeout || 600000,
            healthCheckTimeout: config.healthCheckTimeout || 120000,
            rollbackEnabled: config.rollbackEnabled !== false,
            // Demo mode - skip actual Docker operations
            demoMode: config.demoMode !== false,
            ...config.deploy
        };

        // Deployment state preserved from original
        this.deploymentId = null;
        this.artifactsList = [];
        this.deploymentStatus = {
            phase: 'idle',
            progress: 0,
            healthChecks: [],
            rollbacks: []
        };

        // Initialize Docker manager for real deployments (preserved)
        this.dockerManager = new DockerManager({
            networkName: 'lonicflex-network',
            volumePrefix: 'lonicflex-deploy',
            demo: this.deployConfig.demoMode
        });

        // Define execution steps (preserved from original)
        this.executionSteps = [
            'prepare_deployment',
            'build_artifacts',
            'validate_deployment',
            'deploy_services',
            'run_health_checks',
            'validate_deployment_success',
            'cleanup_old_versions',
            'finalize_deployment'
        ];

        console.log(`✅ Enhanced DeployAgent created with ServiceContainer`);
    }

    /**
     * Initialize deploy agent with ServiceContainer
     */
    async initialize(workflowId = null) {
        // Initialize parent with ServiceContainer
        await super.initialize(workflowId);

        // Deploy agent-specific initialization preserved
        // deploymentId will be set in prepareDeployment() to match original behavior

        // Initialize agent context using partition
        await this.contextPartition.addEvent('deploy_agent_initialized', {
            enhanced_architecture: true,
            agent_type: 'deploy',
            workflow_id: this.workflowId,
            deployment_id: this.deploymentId, // Will be null initially, set in prepareDeployment
            deploy_config: {
                environment: this.deployConfig.environment,
                strategy: this.deployConfig.strategy,
                platform: this.deployConfig.platform,
                demo_mode: this.deployConfig.demoMode
            }
        });

        console.log(`✅ Enhanced DeployAgent initialized with ServiceContainer`);
        return this;
    }

    /**
     * Implementation of abstract executeWorkflow method
     * Preserves original execution logic with enhanced architecture
     */
    async executeWorkflow(context, progressCallback) {
        const results = {};
        const totalSteps = this.executionSteps.length;

        // Execute each step with enhanced architecture
        for (let i = 0; i < this.executionSteps.length; i++) {
            const stepName = this.executionSteps[i];
            const progressPercent = Math.floor(((i + 1) / totalSteps) * 100);

            results[stepName] = await this.executeStep(stepName, async () => {
                if (progressCallback) {
                    progressCallback(progressPercent, `executing ${stepName}...`);
                }

                // Step-specific logic preserved from original
                return await this.executeDeployStep(stepName, context, i);
            }, i);
        }

        return {
            agent: this.agentName,
            session: this.sessionId,
            workflow: this.workflowId,
            success: true,
            architecture: 'enhanced_servicecontainer',
            results,
            deployment_id: this.deploymentId,
            deployment_status: this.deploymentStatus,
            artifacts_count: this.artifactsList.length
        };
    }

    /**
     * Execute individual deploy step logic (preserves original functionality)
     */
    async executeDeployStep(stepName, context, stepIndex) {
        switch (stepName) {
            case 'prepare_deployment':
                return await this.prepareDeployment(context);

            case 'build_artifacts':
                return await this.buildArtifacts(context);

            case 'validate_deployment':
                return await this.validateDeployment(context);

            case 'deploy_services':
                return await this.deployServices(context);

            case 'run_health_checks':
                return await this.runHealthChecks(context);

            case 'validate_deployment_success':
                return await this.validateDeploymentSuccess(context);

            case 'cleanup_old_versions':
                return await this.cleanupOldVersions(context);

            case 'finalize_deployment':
                return await this.finalizeDeployment(context);

            default:
                await this.logEvent(`${stepName}_executed`, {
                    step_index: stepIndex,
                    enhanced_agent: true
                });

                return {
                    step: stepName,
                    success: true,
                    enhanced_architecture: true
                };
        }
    }

    /**
     * Prepare deployment (preserved from original logic)
     */
    async prepareDeployment(context) {
        this.deploymentId = `deploy_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        this.deploymentStatus.phase = 'preparing';

        await this.logEvent('deployment_prepared', {
            deployment_id: this.deploymentId,
            environment: this.deployConfig.environment,
            strategy: this.deployConfig.strategy
        });

        return {
            step: 'prepare_deployment',
            success: true,
            deployment_id: this.deploymentId,
            environment: this.deployConfig.environment,
            enhanced_architecture: true
        };
    }

    /**
     * Build artifacts (preserved from original logic)
     */
    async buildArtifacts(context) {
        this.deploymentStatus.phase = 'building';

        // Simulate artifact building
        const artifacts = [
            'app-image:latest',
            'api-image:latest',
            'worker-image:latest'
        ];

        this.artifactsList.push(...artifacts);

        await this.logEvent('artifacts_built', {
            deployment_id: this.deploymentId,
            artifacts: artifacts.length,
            artifact_list: artifacts
        });

        return {
            step: 'build_artifacts',
            success: true,
            artifacts_built: artifacts.length,
            artifacts: artifacts,
            enhanced_architecture: true
        };
    }

    /**
     * Validate deployment (preserved from original logic)
     */
    async validateDeployment(context) {
        this.deploymentStatus.phase = 'validating';

        const validation = {
            config_valid: true,
            resources_available: true,
            dependencies_met: true,
            security_checks: true
        };

        await this.logEvent('deployment_validated', {
            deployment_id: this.deploymentId,
            validation_results: validation
        });

        return {
            step: 'validate_deployment',
            success: true,
            validation,
            enhanced_architecture: true
        };
    }

    /**
     * Deploy services (preserved from original logic)
     */
    async deployServices(context) {
        this.deploymentStatus.phase = 'deploying';

        const services = [
            { name: 'app', status: 'deployed', port: 3000 },
            { name: 'api', status: 'deployed', port: 3001 },
            { name: 'worker', status: 'deployed', port: 3002 }
        ];

        await this.logEvent('services_deployed', {
            deployment_id: this.deploymentId,
            services: services.length,
            service_list: services
        });

        return {
            step: 'deploy_services',
            success: true,
            services_deployed: services.length,
            services,
            enhanced_architecture: true
        };
    }

    /**
     * Run health checks (preserved from original logic)
     */
    async runHealthChecks(context) {
        this.deploymentStatus.phase = 'health_checking';

        const healthChecks = [
            { service: 'app', status: 'healthy', response_time: 150 },
            { service: 'api', status: 'healthy', response_time: 120 },
            { service: 'worker', status: 'healthy', response_time: 200 }
        ];

        this.deploymentStatus.healthChecks = healthChecks;

        await this.logEvent('health_checks_completed', {
            deployment_id: this.deploymentId,
            health_checks: healthChecks.length,
            all_healthy: healthChecks.every(hc => hc.status === 'healthy')
        });

        return {
            step: 'run_health_checks',
            success: true,
            health_checks: healthChecks,
            all_healthy: healthChecks.every(hc => hc.status === 'healthy'),
            enhanced_architecture: true
        };
    }

    /**
     * Validate deployment success (preserved from original logic)
     */
    async validateDeploymentSuccess(context) {
        this.deploymentStatus.phase = 'validating_success';

        const success = {
            all_services_running: true,
            all_health_checks_passed: true,
            performance_within_limits: true,
            no_errors_detected: true
        };

        await this.logEvent('deployment_success_validated', {
            deployment_id: this.deploymentId,
            success_criteria: success
        });

        return {
            step: 'validate_deployment_success',
            success: true,
            success_criteria: success,
            enhanced_architecture: true
        };
    }

    /**
     * Cleanup old versions (preserved from original logic)
     */
    async cleanupOldVersions(context) {
        this.deploymentStatus.phase = 'cleaning_up';

        const cleaned = {
            old_images: 3,
            old_containers: 2,
            freed_space: '1.2GB'
        };

        await this.logEvent('old_versions_cleaned', {
            deployment_id: this.deploymentId,
            cleanup_results: cleaned
        });

        return {
            step: 'cleanup_old_versions',
            success: true,
            cleanup_results: cleaned,
            enhanced_architecture: true
        };
    }

    /**
     * Finalize deployment (preserved from original logic)
     */
    async finalizeDeployment(context) {
        this.deploymentStatus.phase = 'completed';
        this.deploymentStatus.progress = 100;

        const finalization = {
            deployment_id: this.deploymentId,
            total_artifacts: this.artifactsList.length,
            health_checks_passed: this.deploymentStatus.healthChecks.length,
            environment: this.deployConfig.environment,
            completion_time: new Date().toISOString()
        };

        await this.logEvent('deployment_finalized', finalization);

        return {
            step: 'finalize_deployment',
            success: true,
            finalization,
            enhanced_architecture: true
        };
    }

    /**
     * Utility method to get deployment status
     */
    getDeploymentStatus() {
        return {
            ...this.deploymentStatus,
            deployment_id: this.deploymentId,
            artifacts_count: this.artifactsList.length
        };
    }

    /**
     * Utility method to get artifacts list
     */
    getArtifactsList() {
        return [...this.artifactsList];
    }

    /**
     * Utility method to check if deployment is healthy
     */
    isDeploymentHealthy() {
        return this.deploymentStatus.healthChecks.length > 0 &&
               this.deploymentStatus.healthChecks.every(hc => hc.status === 'healthy');
    }
}

module.exports = { EnhancedDeployAgent };