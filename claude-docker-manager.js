const Docker = require('dockerode');
const fs = require('fs').promises;
const path = require('path');
const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');

/**
 * Docker Container Manager - Factor 6: Execute In Containers
 * 
 * Manages Docker containers for multi-agent deployments and isolated execution
 * Following 12-Factor Agent principles
 */
class DockerManager {
    constructor(options = {}) {
        this.config = {
            dockerHost: options.dockerHost || process.env.DOCKER_HOST,
            registryUrl: options.registryUrl || process.env.DOCKER_REGISTRY,
            imagePullTimeout: options.imagePullTimeout || 300000, // 5 minutes
            containerTimeout: options.containerTimeout || 600000, // 10 minutes
            networkName: options.networkName || 'claude-agents',
            volumePrefix: options.volumePrefix || 'claude-agent',
            ...options
        };

        // Initialize Docker client
        this.docker = new Docker(this.config.dockerHost ? {
            host: this.config.dockerHost
        } : undefined);

        // Initialize database and logger
        this.db = new SQLiteManager();
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'docker-manager.log' })
            ]
        });

        // Container tracking
        this.activeContainers = new Map();
        this.deploymentStrategies = new Map();
        this.setupDeploymentStrategies();
    }

    /**
     * Setup deployment strategies
     */
    setupDeploymentStrategies() {
        this.deploymentStrategies.set('blue-green', this.blueGreenDeploy.bind(this));
        this.deploymentStrategies.set('rolling', this.rollingDeploy.bind(this));
        this.deploymentStrategies.set('canary', this.canaryDeploy.bind(this));
        this.deploymentStrategies.set('recreate', this.recreateDeploy.bind(this));
    }

    /**
     * Initialize Docker manager
     */
    async initialize() {
        try {
            await this.db.initialize();
            
            // Create additional tables for Docker management
            await this.db.db.run(`
                CREATE TABLE IF NOT EXISTS containers (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    image TEXT NOT NULL,
                    status TEXT NOT NULL,
                    agent_type TEXT,
                    created_at INTEGER,
                    started_at INTEGER,
                    stopped_at INTEGER,
                    config TEXT
                )
            `);

            await this.db.db.run(`
                CREATE TABLE IF NOT EXISTS deployments (
                    id TEXT PRIMARY KEY,
                    strategy TEXT NOT NULL,
                    status TEXT NOT NULL,
                    target_image TEXT NOT NULL,
                    containers TEXT,
                    created_at INTEGER,
                    completed_at INTEGER,
                    rollback_id TEXT
                )
            `);

            // Ensure network exists
            await this.ensureNetwork();
            
            // Check Docker connectivity
            await this.docker.ping();
            
            this.logger.info('Docker manager initialized successfully');
            console.log('🐳 Docker Manager initialized');

        } catch (error) {
            this.logger.error('Failed to initialize Docker manager', { error: error.message });
            throw error;
        }
    }

    /**
     * Ensure agent network exists
     */
    async ensureNetwork() {
        try {
            const networks = await this.docker.listNetworks();
            const networkExists = networks.some(net => net.Name === this.config.networkName);

            if (!networkExists) {
                await this.docker.createNetwork({
                    Name: this.config.networkName,
                    Driver: 'bridge',
                    Labels: {
                        'claude-agent': 'true',
                        'purpose': 'multi-agent-coordination'
                    }
                });
                this.logger.info('Created agent network', { networkName: this.config.networkName });
            }
        } catch (error) {
            this.logger.error('Failed to ensure network', { error: error.message });
        }
    }

    /**
     * Build agent container image
     */
    async buildAgentImage(agentType, buildContext, options = {}) {
        const imageName = `claude-agent-${agentType}:${options.tag || 'latest'}`;
        
        try {
            this.logger.info('Building agent image', { imageName, agentType });

            // Create Dockerfile if not exists
            const dockerfilePath = path.join(buildContext, 'Dockerfile');
            try {
                await fs.access(dockerfilePath);
            } catch {
                await this.generateDockerfile(agentType, dockerfilePath);
            }

            // Build image
            const stream = await this.docker.buildImage({
                context: buildContext,
                src: ['.']
            }, {
                t: imageName,
                labels: {
                    'claude-agent-type': agentType,
                    'built-at': new Date().toISOString()
                }
            });

            // Wait for build to complete
            await this.followBuildStream(stream);
            
            this.logger.info('Agent image built successfully', { imageName });
            return imageName;

        } catch (error) {
            this.logger.error('Failed to build agent image', { 
                error: error.message, 
                imageName, 
                agentType 
            });
            throw error;
        }
    }

    /**
     * Generate Dockerfile for agent
     */
    async generateDockerfile(agentType, dockerfilePath) {
        const dockerfile = `FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git curl

# Copy package files
COPY package*.json ./

# Install Node dependencies
RUN npm ci --only=production

# Copy agent files
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S claude && \\
    adduser -S claude -u 1001

# Set permissions
RUN chown -R claude:claude /app
USER claude

# Expose default port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \\
    CMD curl -f http://localhost:3000/health || exit 1

# Set agent type
ENV CLAUDE_AGENT_TYPE=${agentType}

# Start agent
CMD ["node", "agents/${agentType}-agent.js"]
`;

        await fs.writeFile(dockerfilePath, dockerfile);
        this.logger.info('Generated Dockerfile', { dockerfilePath, agentType });
    }

    /**
     * Follow build stream and log progress
     */
    async followBuildStream(stream) {
        return new Promise((resolve, reject) => {
            this.docker.modem.followProgress(stream, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            }, (event) => {
                if (event.stream) {
                    console.log(event.stream.trim());
                }
            });
        });
    }

    /**
     * Deploy agent using specified strategy
     */
    async deployAgent(agentType, imageName, strategy = 'rolling', options = {}) {
        const deploymentId = `deploy_${agentType}_${Date.now()}`;
        
        try {
            this.logger.info('Starting agent deployment', { 
                deploymentId, 
                agentType, 
                imageName, 
                strategy 
            });

            // Record deployment start
            await this.db.db.run(`
                INSERT INTO deployments (id, strategy, status, target_image, created_at)
                VALUES (?, ?, ?, ?, ?)
            `, [deploymentId, strategy, 'started', imageName, Date.now()]);

            // Execute deployment strategy
            const deployStrategy = this.deploymentStrategies.get(strategy);
            if (!deployStrategy) {
                throw new Error(`Unknown deployment strategy: ${strategy}`);
            }

            const result = await deployStrategy(agentType, imageName, deploymentId, options);

            // Record deployment completion
            await this.db.db.run(`
                UPDATE deployments 
                SET status = ?, completed_at = ?, containers = ?
                WHERE id = ?
            `, ['completed', Date.now(), JSON.stringify(result.containers), deploymentId]);

            this.logger.info('Deployment completed', { deploymentId, result });
            return { deploymentId, ...result };

        } catch (error) {
            // Record deployment failure
            await this.db.db.run(`
                UPDATE deployments 
                SET status = ?
                WHERE id = ?
            `, ['failed', deploymentId]);

            this.logger.error('Deployment failed', { 
                deploymentId, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Blue-Green deployment strategy
     */
    async blueGreenDeploy(agentType, imageName, deploymentId, options) {
        const instances = options.instances || 2;
        const newContainers = [];

        try {
            // Create new (green) containers
            for (let i = 0; i < instances; i++) {
                const containerName = `${agentType}-green-${i}-${Date.now()}`;
                
                const container = await this.createAgentContainer(
                    containerName,
                    imageName,
                    agentType,
                    { ...options, env: { ...options.env, INSTANCE_ID: i.toString() } }
                );
                
                await container.start();
                newContainers.push({
                    id: container.id,
                    name: containerName,
                    color: 'green'
                });
            }

            // Wait for containers to be healthy
            await this.waitForHealthy(newContainers.map(c => c.id));

            // Switch traffic to green containers (simulate load balancer switch)
            await this.switchTraffic(agentType, newContainers);

            // Stop old (blue) containers
            const oldContainers = await this.getActiveContainersByType(agentType);
            for (const oldContainer of oldContainers) {
                if (!newContainers.some(nc => nc.id === oldContainer.id)) {
                    await this.stopContainer(oldContainer.id);
                }
            }

            return {
                strategy: 'blue-green',
                containers: newContainers,
                switchedContainers: oldContainers.length
            };

        } catch (error) {
            // Rollback on failure
            await this.cleanupContainers(newContainers.map(c => c.id));
            throw error;
        }
    }

    /**
     * Rolling deployment strategy
     */
    async rollingDeploy(agentType, imageName, deploymentId, options) {
        const instances = options.instances || 3;
        const maxUnavailable = Math.floor(instances / 3) || 1;
        
        const oldContainers = await this.getActiveContainersByType(agentType);
        const newContainers = [];

        try {
            // Rolling update - replace containers gradually
            for (let i = 0; i < instances; i++) {
                const containerName = `${agentType}-${Date.now()}-${i}`;
                
                // Create new container
                const container = await this.createAgentContainer(
                    containerName,
                    imageName,
                    agentType,
                    { ...options, env: { ...options.env, INSTANCE_ID: i.toString() } }
                );
                
                await container.start();
                await this.waitForHealthy([container.id]);
                
                newContainers.push({
                    id: container.id,
                    name: containerName
                });

                // Stop old container if we have too many running
                if (oldContainers.length > 0 && (newContainers.length >= maxUnavailable)) {
                    const oldContainer = oldContainers.shift();
                    if (oldContainer) {
                        await this.stopContainer(oldContainer.id);
                    }
                }

                // Brief pause between deployments
                await this.delay(2000);
            }

            // Clean up any remaining old containers
            for (const oldContainer of oldContainers) {
                await this.stopContainer(oldContainer.id);
            }

            return {
                strategy: 'rolling',
                containers: newContainers,
                replacedContainers: oldContainers.length + oldContainers.length
            };

        } catch (error) {
            // Attempt rollback
            await this.cleanupContainers(newContainers.map(c => c.id));
            throw error;
        }
    }

    /**
     * Canary deployment strategy
     */
    async canaryDeploy(agentType, imageName, deploymentId, options) {
        const canaryPercentage = options.canaryPercentage || 10;
        const instances = options.instances || 5;
        const canaryCount = Math.max(1, Math.floor(instances * (canaryPercentage / 100)));
        
        const canaryContainers = [];
        
        try {
            // Deploy canary instances
            for (let i = 0; i < canaryCount; i++) {
                const containerName = `${agentType}-canary-${Date.now()}-${i}`;
                
                const container = await this.createAgentContainer(
                    containerName,
                    imageName,
                    agentType,
                    { 
                        ...options, 
                        env: { 
                            ...options.env, 
                            INSTANCE_ID: i.toString(),
                            DEPLOYMENT_TYPE: 'canary'
                        } 
                    }
                );
                
                await container.start();
                canaryContainers.push({
                    id: container.id,
                    name: containerName,
                    type: 'canary'
                });
            }

            // Wait for canary health
            await this.waitForHealthy(canaryContainers.map(c => c.id));

            // Simulate canary monitoring period
            console.log(`🕒 Monitoring canary deployment for ${canaryPercentage}% traffic...`);
            await this.delay(options.monitoringPeriod || 30000);

            // Auto-promote if healthy (in real deployment, this would check metrics)
            const healthyCanaries = await this.checkContainerHealth(canaryContainers.map(c => c.id));
            
            if (healthyCanaries.every(h => h.healthy)) {
                console.log('✅ Canary deployment healthy, promoting to full deployment');
                return await this.promoteCanary(agentType, imageName, deploymentId, options);
            } else {
                throw new Error('Canary deployment failed health checks');
            }

        } catch (error) {
            // Rollback canary
            await this.cleanupContainers(canaryContainers.map(c => c.id));
            throw error;
        }
    }

    /**
     * Promote canary to full deployment
     */
    async promoteCanary(agentType, imageName, deploymentId, options) {
        // After canary success, do rolling deployment for remaining instances
        return await this.rollingDeploy(agentType, imageName, deploymentId, {
            ...options,
            skipCanary: true
        });
    }

    /**
     * Recreate deployment strategy
     */
    async recreateDeploy(agentType, imageName, deploymentId, options) {
        const instances = options.instances || 2;
        
        try {
            // Stop all existing containers
            const oldContainers = await this.getActiveContainersByType(agentType);
            for (const container of oldContainers) {
                await this.stopContainer(container.id);
            }

            // Create new containers
            const newContainers = [];
            for (let i = 0; i < instances; i++) {
                const containerName = `${agentType}-${Date.now()}-${i}`;
                
                const container = await this.createAgentContainer(
                    containerName,
                    imageName,
                    agentType,
                    { ...options, env: { ...options.env, INSTANCE_ID: i.toString() } }
                );
                
                await container.start();
                newContainers.push({
                    id: container.id,
                    name: containerName
                });
            }

            // Wait for all to be healthy
            await this.waitForHealthy(newContainers.map(c => c.id));

            return {
                strategy: 'recreate',
                containers: newContainers,
                stoppedContainers: oldContainers.length
            };

        } catch (error) {
            this.logger.error('Recreate deployment failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Create agent container
     */
    async createAgentContainer(name, imageName, agentType, options = {}) {
        const containerConfig = {
            Image: imageName,
            name: name,
            Env: this.buildEnvironmentVars(agentType, options.env || {}),
            NetworkMode: this.config.networkName,
            RestartPolicy: { Name: 'unless-stopped' },
            Labels: {
                'claude-agent': 'true',
                'claude-agent-type': agentType,
                'deployment-id': options.deploymentId || 'unknown'
            },
            HostConfig: {
                Memory: options.memory || 512 * 1024 * 1024, // 512MB
                CpuShares: options.cpuShares || 1024,
                RestartPolicy: { Name: 'unless-stopped' }
            }
        };

        // Add port bindings if specified
        if (options.ports) {
            containerConfig.ExposedPorts = {};
            containerConfig.HostConfig.PortBindings = {};
            
            options.ports.forEach(port => {
                containerConfig.ExposedPorts[`${port}/tcp`] = {};
                containerConfig.HostConfig.PortBindings[`${port}/tcp`] = [{ HostPort: '' }];
            });
        }

        const container = await this.docker.createContainer(containerConfig);
        
        // Track container
        this.activeContainers.set(container.id, {
            name,
            agentType,
            imageName,
            createdAt: Date.now()
        });

        // Record in database
        await this.db.db.run(`
            INSERT INTO containers (id, name, image, status, agent_type, created_at, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [container.id, name, imageName, 'created', agentType, Date.now(), JSON.stringify(containerConfig)]);

        this.logger.info('Created agent container', { 
            containerId: container.id, 
            name, 
            agentType 
        });

        return container;
    }

    /**
     * Build environment variables for container
     */
    buildEnvironmentVars(agentType, customEnv = {}) {
        const baseEnv = {
            NODE_ENV: 'production',
            CLAUDE_AGENT_TYPE: agentType,
            CLAUDE_AGENT_NETWORK: this.config.networkName,
            ...customEnv
        };

        return Object.entries(baseEnv).map(([key, value]) => `${key}=${value}`);
    }

    /**
     * Wait for containers to be healthy
     */
    async waitForHealthy(containerIds, timeout = 60000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const healthChecks = await this.checkContainerHealth(containerIds);
            
            if (healthChecks.every(check => check.healthy)) {
                this.logger.info('All containers healthy', { containerIds });
                return;
            }

            await this.delay(5000);
        }

        throw new Error('Timeout waiting for containers to be healthy');
    }

    /**
     * Check container health
     */
    async checkContainerHealth(containerIds) {
        const healthChecks = [];
        
        for (const containerId of containerIds) {
            try {
                const container = this.docker.getContainer(containerId);
                const inspect = await container.inspect();
                
                const isRunning = inspect.State.Running;
                const hasHealthCheck = inspect.State.Health;
                const isHealthy = hasHealthCheck ? inspect.State.Health.Status === 'healthy' : isRunning;
                
                healthChecks.push({
                    containerId,
                    healthy: isHealthy,
                    status: inspect.State.Status
                });
                
            } catch (error) {
                healthChecks.push({
                    containerId,
                    healthy: false,
                    error: error.message
                });
            }
        }

        return healthChecks;
    }

    /**
     * Switch traffic to new containers (placeholder for load balancer integration)
     */
    async switchTraffic(agentType, containers) {
        this.logger.info('Switching traffic', { agentType, containerCount: containers.length });
        // In real implementation, this would update load balancer configuration
        await this.delay(1000);
    }

    /**
     * Get active containers by agent type
     */
    async getActiveContainersByType(agentType) {
        try {
            const containers = await this.docker.listContainers({
                filters: {
                    label: [`claude-agent-type=${agentType}`],
                    status: ['running']
                }
            });

            return containers.map(container => ({
                id: container.Id,
                name: container.Names[0],
                status: container.Status,
                image: container.Image
            }));

        } catch (error) {
            this.logger.error('Failed to get active containers', { error: error.message });
            return [];
        }
    }

    /**
     * Stop container
     */
    async stopContainer(containerId) {
        try {
            const container = this.docker.getContainer(containerId);
            await container.stop({ t: 10 }); // 10 second graceful shutdown
            await container.remove();
            
            this.activeContainers.delete(containerId);
            
            // Update database
            await this.db.db.run(`
                UPDATE containers 
                SET status = ?, stopped_at = ?
                WHERE id = ?
            `, ['stopped', Date.now(), containerId]);

            this.logger.info('Stopped container', { containerId });

        } catch (error) {
            this.logger.error('Failed to stop container', { 
                containerId, 
                error: error.message 
            });
        }
    }

    /**
     * Cleanup containers
     */
    async cleanupContainers(containerIds) {
        for (const containerId of containerIds) {
            await this.stopContainer(containerId);
        }
    }

    /**
     * Get deployment status
     */
    async getDeploymentStatus(deploymentId) {
        const deployment = await this.db.db.get(`
            SELECT * FROM deployments WHERE id = ?
        `, [deploymentId]);

        if (!deployment) {
            throw new Error('Deployment not found');
        }

        const containers = deployment.containers ? JSON.parse(deployment.containers) : [];
        const healthChecks = containers.length > 0 ? 
            await this.checkContainerHealth(containers.map(c => c.id)) : [];

        return {
            ...deployment,
            containers: containers.map((container, index) => ({
                ...container,
                health: healthChecks[index] || { healthy: false }
            }))
        };
    }

    /**
     * Utility delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get system status
     */
    async getSystemStatus() {
        try {
            const dockerInfo = await this.docker.info();
            const containers = await this.docker.listContainers();
            const images = await this.docker.listImages();

            return {
                docker: {
                    version: dockerInfo.ServerVersion,
                    containers: dockerInfo.Containers,
                    images: dockerInfo.Images,
                    running: dockerInfo.ContainersRunning
                },
                claude: {
                    activeContainers: this.activeContainers.size,
                    networkName: this.config.networkName
                },
                containers: containers.filter(c => 
                    c.Labels && c.Labels['claude-agent'] === 'true'
                ).length,
                images: images.filter(i => 
                    i.RepoTags && i.RepoTags.some(tag => tag.includes('claude-agent'))
                ).length
            };

        } catch (error) {
            this.logger.error('Failed to get system status', { error: error.message });
            throw error;
        }
    }
}

/**
 * Demo function
 */
async function demonstrateDockerManager() {
    console.log('🐳 Docker Container Manager Demo\n');
    
    try {
        const manager = new DockerManager();
        
        console.log('✅ Docker Manager Features:');
        console.log('   • Multi-strategy deployments (blue-green, rolling, canary, recreate)');
        console.log('   • Agent container orchestration');
        console.log('   • Health monitoring and checks');
        console.log('   • Network isolation and management');
        console.log('   • Resource limits and controls');
        console.log('   • Automatic Dockerfile generation');
        console.log('   • Deployment tracking and rollback');
        console.log('   • Production-ready container lifecycle management');

        console.log('\n🚀 Deployment Strategies:');
        console.log('   • blue-green: Zero-downtime deployment with traffic switching');
        console.log('   • rolling: Gradual instance replacement');  
        console.log('   • canary: Gradual rollout with monitoring');
        console.log('   • recreate: Full stop and restart');

        console.log('\n📋 Agent Container Support:');
        console.log('   • github-agent: Git repository management');
        console.log('   • security-agent: Security scanning and monitoring');
        console.log('   • code-agent: Code generation and analysis');
        console.log('   • deploy-agent: Deployment automation');
        console.log('   • comm-agent: Communication and notifications');

        console.log('\n🔧 Configuration:');
        console.log(`   Network: ${manager.config.networkName}`);
        console.log(`   Volume prefix: ${manager.config.volumePrefix}`);
        console.log(`   Container timeout: ${manager.config.containerTimeout}ms`);
        console.log(`   Image pull timeout: ${manager.config.imagePullTimeout}ms`);

        // Check Docker connectivity
        try {
            await manager.initialize();
            const status = await manager.getSystemStatus();
            console.log('\n📊 Docker System Status:');
            console.log(`   Docker version: ${status.docker.version}`);
            console.log(`   Total containers: ${status.docker.containers}`);
            console.log(`   Running containers: ${status.docker.running}`);
            console.log(`   Total images: ${status.docker.images}`);
            console.log(`   Claude agent containers: ${status.containers}`);
        } catch (error) {
            console.log('\n⚠️  Docker not available or not running');
            console.log('   Install Docker and start the Docker daemon to use container features');
        }

        console.log('\n✅ Demo completed - Docker Manager ready for agent deployments!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
        console.log('\n💡 Make sure Docker is installed and running');
    }
}

module.exports = {
    DockerManager
};

// Run demo if called directly
if (require.main === module) {
    demonstrateDockerManager().catch(console.error);
}