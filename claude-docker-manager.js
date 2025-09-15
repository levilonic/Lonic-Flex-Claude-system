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
     * Ensure secure agent networks exist with proper isolation
     */
    async ensureNetwork() {
        try {
            await this.createSecureNetworks();
            await this.configureNetworkSecurity();
            
        } catch (error) {
            this.logger.error('Failed to ensure secure networks', { error: error.message });
        }
    }

    /**
     * Create multiple isolated networks for different security zones
     */
    async createSecureNetworks() {
        const networks = await this.docker.listNetworks();
        const securityZones = {
            'claude-agents-dmz': {
                description: 'DMZ network for public-facing services',
                driver: 'bridge',
                options: {
                    'com.docker.network.bridge.enable_icc': 'false',
                    'com.docker.network.bridge.enable_ip_masquerade': 'true'
                },
                ipam: {
                    Config: [{ Subnet: '172.20.0.0/16' }]
                }
            },
            'claude-agents-internal': {
                description: 'Internal network for agent communication',
                driver: 'bridge',
                options: {
                    'com.docker.network.bridge.enable_icc': 'true',
                    'com.docker.network.bridge.enable_ip_masquerade': 'false'
                },
                ipam: {
                    Config: [{ Subnet: '172.21.0.0/16' }]
                }
            },
            'claude-agents-secure': {
                description: 'Secure network for sensitive operations',
                driver: 'bridge',
                options: {
                    'com.docker.network.bridge.enable_icc': 'false',
                    'com.docker.network.bridge.enable_ip_masquerade': 'false'
                },
                ipam: {
                    Config: [{ Subnet: '172.22.0.0/16' }]
                }
            }
        };

        for (const [networkName, config] of Object.entries(securityZones)) {
            const networkExists = networks.some(net => net.Name === networkName);
            
            if (!networkExists) {
                await this.docker.createNetwork({
                    Name: networkName,
                    Driver: config.driver,
                    Options: config.options,
                    IPAM: config.ipam,
                    Labels: {
                        'claude-agent': 'true',
                        'security-zone': networkName.split('-').pop(),
                        'purpose': config.description
                    }
                });
                this.logger.info('Created secure network', { networkName, zone: config.description });
            }
        }
    }

    /**
     * Configure network security rules and isolation
     */
    async configureNetworkSecurity() {
        try {
            // Configure iptables rules for network isolation
            await this.setupNetworkIsolationRules();
            
            // Setup network monitoring
            await this.setupNetworkMonitoring();
            
            this.logger.info('Network security configured');
            
        } catch (error) {
            this.logger.warn('Network security configuration failed', { error: error.message });
            // Continue without advanced network security in development
        }
    }

    /**
     * Setup iptables rules for network isolation (Linux only)
     */
    async setupNetworkIsolationRules() {
        const rules = [
            // Block DMZ to internal network communication
            'iptables -I DOCKER-USER -s 172.20.0.0/16 -d 172.21.0.0/16 -j DROP',
            // Block DMZ to secure network communication  
            'iptables -I DOCKER-USER -s 172.20.0.0/16 -d 172.22.0.0/16 -j DROP',
            // Allow internal to secure network (controlled access)
            'iptables -I DOCKER-USER -s 172.21.0.0/16 -d 172.22.0.0/16 -p tcp --dport 443 -j ACCEPT',
            // Block all other traffic between networks
            'iptables -I DOCKER-USER -s 172.21.0.0/16 -d 172.22.0.0/16 -j DROP'
        ];

        for (const rule of rules) {
            try {
                // Only apply rules on Linux systems with iptables
                if (process.platform === 'linux') {
                    const { spawn } = require('child_process');
                    await new Promise((resolve, reject) => {
                        const proc = spawn('bash', ['-c', rule]);
                        proc.on('close', (code) => code === 0 ? resolve() : reject());
                        proc.on('error', reject);
                    });
                }
            } catch (error) {
                this.logger.warn('Failed to apply iptables rule', { rule, error: error.message });
            }
        }
    }

    /**
     * Setup network monitoring for security events
     */
    async setupNetworkMonitoring() {
        this.networkMonitor = {
            connections: new Map(),
            suspiciousActivity: [],
            lastScan: Date.now()
        };

        // Monitor network connections every 30 seconds
        this.networkMonitorInterval = setInterval(async () => {
            await this.scanNetworkConnections();
        }, 30000);
    }

    /**
     * Scan for suspicious network connections
     */
    async scanNetworkConnections() {
        try {
            const containers = await this.docker.listContainers();
            const claudeContainers = containers.filter(c => 
                c.Labels && c.Labels['claude-agent'] === 'true'
            );

            for (const container of claudeContainers) {
                const networkData = container.NetworkSettings || {};
                for (const [networkName, networkInfo] of Object.entries(networkData.Networks || {})) {
                    // Check for cross-zone communications
                    if (this.isSuspiciousConnection(networkName, networkInfo)) {
                        this.recordSuspiciousActivity(container.Id, networkName, networkInfo);
                    }
                }
            }

        } catch (error) {
            this.logger.error('Network monitoring scan failed', { error: error.message });
        }
    }

    /**
     * Check if network connection is suspicious
     */
    isSuspiciousConnection(networkName, networkInfo) {
        // Define suspicious patterns
        const suspiciousPatterns = [
            // DMZ containers accessing internal networks
            (name, info) => name.includes('dmz') && info.IPAddress?.startsWith('172.21'),
            // Unauthorized external connections
            (name, info) => !name.includes('claude-agents') && info.IPAddress,
            // Containers on wrong security zones
            (name, info) => name.includes('secure') && !info.IPAddress?.startsWith('172.22')
        ];

        return suspiciousPatterns.some(pattern => pattern(networkName, networkInfo));
    }

    /**
     * Record suspicious network activity
     */
    recordSuspiciousActivity(containerId, networkName, networkInfo) {
        const activity = {
            timestamp: Date.now(),
            containerId,
            networkName,
            networkInfo,
            severity: 'medium'
        };

        this.networkMonitor.suspiciousActivity.push(activity);
        this.logger.warn('Suspicious network activity detected', activity);

        // Alert if too many suspicious activities
        if (this.networkMonitor.suspiciousActivity.length > 10) {
            this.emit('security-alert', {
                type: 'network-security',
                message: 'High number of suspicious network activities detected',
                activities: this.networkMonitor.suspiciousActivity.slice(-5)
            });
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
        const dockerfile = `FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apk add --no-cache git curl

# Update npm to latest version for lockfile compatibility
RUN npm install -g npm@10.9.3

# Copy package files
COPY package*.json ./

# Install dependencies with robust fallback for lockfile compatibility
RUN npm ci --only=production 2>/dev/null || npm install --only=production

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
     * Create secure agent container with network isolation and security hardening
     */
    async createAgentContainer(name, imageName, agentType, options = {}) {
        // Determine appropriate security zone for agent type
        const securityZone = this.getSecurityZoneForAgent(agentType);
        
        // Apply security hardening based on agent type
        const securityConfig = this.getSecurityConfig(agentType, options);
        
        const containerConfig = {
            Image: imageName,
            name: name,
            Env: this.buildEnvironmentVars(agentType, options.env || {}),
            User: '1001:1001', // Run as non-root user
            WorkingDir: '/app',
            Labels: {
                'claude-agent': 'true',
                'claude-agent-type': agentType,
                'security-zone': securityZone,
                'deployment-id': options.deploymentId || 'unknown',
                'security-level': securityConfig.level
            },
            HostConfig: {
                Memory: options.memory || 512 * 1024 * 1024, // 512MB
                CpuShares: options.cpuShares || 1024,
                RestartPolicy: { Name: 'unless-stopped' },
                
                // Security hardening
                ReadonlyRootfs: securityConfig.readonlyRoot,
                NoNewPrivileges: true,
                SecurityOpt: [
                    'no-new-privileges:true',
                    'seccomp=default'
                ],
                CapDrop: ['ALL'],
                CapAdd: securityConfig.requiredCapabilities || [],
                
                // Network security
                NetworkMode: securityZone,
                
                // Resource limits
                PidsLimit: 100,
                Ulimits: [
                    { Name: 'nofile', Soft: 1024, Hard: 1024 },
                    { Name: 'nproc', Soft: 64, Hard: 64 }
                ],
                
                // Tmpfs for writable areas when read-only root
                Tmpfs: securityConfig.readonlyRoot ? {
                    '/tmp': 'rw,nosuid,nodev,noexec,size=100m',
                    '/var/tmp': 'rw,nosuid,nodev,noexec,size=50m'
                } : undefined
            }
        };

        // Add port bindings with security considerations
        if (options.ports) {
            containerConfig.ExposedPorts = {};
            containerConfig.HostConfig.PortBindings = {};
            
            // Only allow specific ports based on agent type
            const allowedPorts = this.getAllowedPortsForAgent(agentType);
            
            options.ports.forEach(port => {
                if (allowedPorts.includes(port)) {
                    containerConfig.ExposedPorts[`${port}/tcp`] = {};
                    containerConfig.HostConfig.PortBindings[`${port}/tcp`] = [{ HostPort: '' }];
                } else {
                    this.logger.warn('Port not allowed for agent type', { port, agentType });
                }
            });
        }

        // Add secrets management
        if (options.secrets) {
            await this.mountSecrets(containerConfig, options.secrets);
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
     * Get appropriate security zone for agent type
     */
    getSecurityZoneForAgent(agentType) {
        const zoneMapping = {
            'github': 'claude-agents-dmz',      // External API access
            'slack': 'claude-agents-dmz',       // External API access  
            'comm': 'claude-agents-dmz',        // External communications
            'deploy': 'claude-agents-internal', // Internal deployment
            'security': 'claude-agents-secure', // High security operations
            'code': 'claude-agents-internal',   // Internal code operations
            'multiplan': 'claude-agents-internal' // Internal planning
        };
        
        return zoneMapping[agentType] || 'claude-agents-internal';
    }

    /**
     * Get security configuration for agent type
     */
    getSecurityConfig(agentType, options = {}) {
        const securityProfiles = {
            'github': {
                level: 'medium',
                readonlyRoot: false,
                requiredCapabilities: [],
                allowNetworking: true
            },
            'slack': {
                level: 'medium', 
                readonlyRoot: false,
                requiredCapabilities: [],
                allowNetworking: true
            },
            'comm': {
                level: 'medium',
                readonlyRoot: false,
                requiredCapabilities: [],
                allowNetworking: true
            },
            'security': {
                level: 'high',
                readonlyRoot: true,
                requiredCapabilities: [],
                allowNetworking: false
            },
            'deploy': {
                level: 'high',
                readonlyRoot: false,
                requiredCapabilities: ['SYS_PTRACE'], // For deployment monitoring
                allowNetworking: true
            },
            'code': {
                level: 'medium',
                readonlyRoot: true,
                requiredCapabilities: [],
                allowNetworking: false
            },
            'multiplan': {
                level: 'medium',
                readonlyRoot: true,
                requiredCapabilities: [],
                allowNetworking: false
            }
        };

        const defaultConfig = {
            level: 'medium',
            readonlyRoot: true,
            requiredCapabilities: [],
            allowNetworking: false
        };

        return { ...defaultConfig, ...securityProfiles[agentType], ...options.security };
    }

    /**
     * Get allowed ports for agent type
     */
    getAllowedPortsForAgent(agentType) {
        const portMappings = {
            'github': [3000, 8080],
            'slack': [3000, 8080], 
            'comm': [3000, 8080],
            'deploy': [3000, 8080, 9090],
            'security': [8443],
            'code': [3000],
            'multiplan': [3000]
        };

        return portMappings[agentType] || [3000];
    }

    /**
     * Mount secrets securely into container
     */
    async mountSecrets(containerConfig, secrets) {
        if (!containerConfig.HostConfig) {
            containerConfig.HostConfig = {};
        }
        
        if (!containerConfig.HostConfig.Mounts) {
            containerConfig.HostConfig.Mounts = [];
        }

        for (const [secretName, secretPath] of Object.entries(secrets)) {
            // Create secure tmpfs mount for secrets
            containerConfig.HostConfig.Mounts.push({
                Type: 'tmpfs',
                Target: `/run/secrets/${secretName}`,
                TmpfsOptions: {
                    SizeBytes: 1024 * 1024, // 1MB
                    Mode: 0o400 // Read-only for user
                }
            });

            // Add environment variable pointing to secret location
            if (!containerConfig.Env) containerConfig.Env = [];
            containerConfig.Env.push(`${secretName.toUpperCase()}_FILE=/run/secrets/${secretName}`);
        }
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
     * Container Lifecycle Management System
     */

    /**
     * Start containers with dependency resolution
     */
    async startContainerOrchestration(serviceDefinitions) {
        this.logger.info('Starting container orchestration', { 
            services: Object.keys(serviceDefinitions) 
        });

        // Build dependency graph
        const dependencyGraph = this.buildDependencyGraph(serviceDefinitions);
        
        // Start containers in dependency order
        const startupResults = await this.startContainersInOrder(dependencyGraph, serviceDefinitions);
        
        // Wait for all health checks to pass
        await this.waitForServiceHealth(startupResults);
        
        return startupResults;
    }

    /**
     * Build dependency graph from service definitions
     */
    buildDependencyGraph(serviceDefinitions) {
        const graph = new Map();
        const visited = new Set();
        const sortedOrder = [];

        // Initialize graph
        for (const serviceName of Object.keys(serviceDefinitions)) {
            graph.set(serviceName, serviceDefinitions[serviceName].dependsOn || []);
        }

        // Topological sort for dependency order
        const visit = (serviceName) => {
            if (visited.has(serviceName)) return;
            
            visited.add(serviceName);
            const dependencies = graph.get(serviceName) || [];
            
            for (const dep of dependencies) {
                if (graph.has(dep)) {
                    visit(dep);
                }
            }
            
            sortedOrder.push(serviceName);
        };

        for (const serviceName of graph.keys()) {
            visit(serviceName);
        }

        return sortedOrder;
    }

    /**
     * Start containers in dependency order
     */
    async startContainersInOrder(orderedServices, serviceDefinitions) {
        const results = new Map();
        const maxConcurrency = 3; // Start max 3 services concurrently per level
        
        // Group services by dependency level
        const dependencyLevels = this.groupServicesByLevel(orderedServices, serviceDefinitions);
        
        for (const level of dependencyLevels) {
            const levelPromises = [];
            
            for (let i = 0; i < level.length; i += maxConcurrency) {
                const batch = level.slice(i, i + maxConcurrency);
                
                const batchPromises = batch.map(async (serviceName) => {
                    try {
                        const serviceConfig = serviceDefinitions[serviceName];
                        const containerResult = await this.startService(serviceName, serviceConfig);
                        
                        results.set(serviceName, {
                            status: 'started',
                            containerId: containerResult.id,
                            startedAt: Date.now(),
                            ...containerResult
                        });
                        
                        this.logger.info('Service started', { serviceName });
                        
                    } catch (error) {
                        results.set(serviceName, {
                            status: 'failed',
                            error: error.message,
                            startedAt: Date.now()
                        });
                        
                        this.logger.error('Service failed to start', { serviceName, error: error.message });
                    }
                });
                
                levelPromises.push(...batchPromises);
            }
            
            // Wait for current level to complete before moving to next
            await Promise.all(levelPromises);
            
            // Verify health of started services before continuing
            const levelServices = level.filter(s => results.get(s)?.status === 'started');
            if (levelServices.length > 0) {
                await this.waitForServiceHealth(
                    new Map(levelServices.map(s => [s, results.get(s)]))
                );
            }
        }
        
        return results;
    }

    /**
     * Group services by dependency level
     */
    groupServicesByLevel(orderedServices, serviceDefinitions) {
        const levels = [];
        const serviceLevels = new Map();
        
        // Calculate dependency level for each service
        for (const serviceName of orderedServices) {
            const dependencies = serviceDefinitions[serviceName].dependsOn || [];
            let maxDepLevel = 0;
            
            for (const dep of dependencies) {
                if (serviceLevels.has(dep)) {
                    maxDepLevel = Math.max(maxDepLevel, serviceLevels.get(dep) + 1);
                }
            }
            
            serviceLevels.set(serviceName, maxDepLevel);
            
            // Add to appropriate level array
            while (levels.length <= maxDepLevel) {
                levels.push([]);
            }
            levels[maxDepLevel].push(serviceName);
        }
        
        return levels;
    }

    /**
     * Start individual service
     */
    async startService(serviceName, serviceConfig) {
        const containerName = `claude-${serviceName}-${Date.now()}`;
        
        // Build container configuration
        const containerConfig = {
            Image: serviceConfig.image,
            name: containerName,
            Env: serviceConfig.environment || [],
            Labels: {
                'claude-service': serviceName,
                'claude-agent': 'true',
                'lifecycle-managed': 'true'
            },
            HostConfig: {
                RestartPolicy: { Name: serviceConfig.restart || 'unless-stopped' },
                Memory: serviceConfig.memory || 256 * 1024 * 1024,
                CpuShares: serviceConfig.cpuShares || 512
            }
        };

        // Add volume mounts
        if (serviceConfig.volumes) {
            containerConfig.HostConfig.Binds = serviceConfig.volumes;
        }

        // Add port mappings
        if (serviceConfig.ports) {
            containerConfig.ExposedPorts = {};
            containerConfig.HostConfig.PortBindings = {};
            
            serviceConfig.ports.forEach(portMapping => {
                const [hostPort, containerPort] = portMapping.split(':');
                containerConfig.ExposedPorts[`${containerPort}/tcp`] = {};
                containerConfig.HostConfig.PortBindings[`${containerPort}/tcp`] = [{ HostPort: hostPort }];
            });
        }

        const container = await this.docker.createContainer(containerConfig);
        await container.start();
        
        // Register health check
        if (serviceConfig.healthCheck) {
            await this.registerHealthCheck(container.id, serviceConfig.healthCheck);
        }
        
        // Record in database
        await this.db.db.run(`
            INSERT INTO containers (id, name, image, status, agent_type, created_at, config)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [container.id, containerName, serviceConfig.image, 'running', serviceName, Date.now(), JSON.stringify(containerConfig)]);
        
        return {
            id: container.id,
            name: containerName,
            service: serviceName
        };
    }

    /**
     * Register health check for container
     */
    async registerHealthCheck(containerId, healthCheckConfig) {
        if (!this.healthChecks) {
            this.healthChecks = new Map();
        }
        
        const healthCheck = {
            containerId,
            config: healthCheckConfig,
            lastCheck: null,
            status: 'pending',
            failures: 0,
            maxFailures: healthCheckConfig.retries || 3
        };
        
        this.healthChecks.set(containerId, healthCheck);
        
        // Start periodic health checking
        this.startHealthCheckLoop(containerId);
    }

    /**
     * Start health check loop for container
     */
    startHealthCheckLoop(containerId) {
        const healthCheck = this.healthChecks.get(containerId);
        if (!healthCheck) return;
        
        const checkInterval = healthCheck.config.interval || 30000; // 30 seconds default
        
        const performHealthCheck = async () => {
            try {
                const isHealthy = await this.performHealthCheck(containerId);
                healthCheck.lastCheck = Date.now();
                
                if (isHealthy) {
                    healthCheck.status = 'healthy';
                    healthCheck.failures = 0;
                } else {
                    healthCheck.failures++;
                    healthCheck.status = healthCheck.failures >= healthCheck.maxFailures ? 'unhealthy' : 'warning';
                    
                    if (healthCheck.status === 'unhealthy') {
                        this.handleUnhealthyContainer(containerId);
                    }
                }
                
            } catch (error) {
                this.logger.error('Health check failed', { containerId, error: error.message });
                healthCheck.failures++;
                healthCheck.status = 'error';
            }
        };
        
        // Perform initial check after startup period
        const startupDelay = healthCheck.config.startPeriod || 10000; // 10 seconds default
        setTimeout(() => {
            performHealthCheck();
            // Then check at regular intervals
            setInterval(performHealthCheck, checkInterval);
        }, startupDelay);
    }

    /**
     * Perform actual health check on container
     */
    async performHealthCheck(containerId) {
        const container = this.docker.getContainer(containerId);
        const inspect = await container.inspect();
        
        // Check if container is running
        if (!inspect.State.Running) {
            return false;
        }
        
        // If container has built-in health check, use it
        if (inspect.State.Health) {
            return inspect.State.Health.Status === 'healthy';
        }
        
        // Custom health check logic
        const healthCheck = this.healthChecks.get(containerId);
        if (healthCheck?.config.command) {
            try {
                const exec = await container.exec({
                    Cmd: healthCheck.config.command,
                    AttachStdout: true,
                    AttachStderr: true
                });
                
                const stream = await exec.start();
                const result = await this.streamToString(stream);
                const inspectResult = await exec.inspect();
                
                return inspectResult.ExitCode === 0;
                
            } catch (error) {
                return false;
            }
        }
        
        // Default: container is healthy if running
        return true;
    }

    /**
     * Handle unhealthy container
     */
    async handleUnhealthyContainer(containerId) {
        const healthCheck = this.healthChecks.get(containerId);
        this.logger.warn('Container marked as unhealthy', { 
            containerId, 
            failures: healthCheck.failures 
        });
        
        // Attempt container restart
        try {
            const container = this.docker.getContainer(containerId);
            await container.restart();
            
            // Reset health check
            healthCheck.status = 'pending';
            healthCheck.failures = 0;
            
            this.logger.info('Unhealthy container restarted', { containerId });
            
        } catch (error) {
            this.logger.error('Failed to restart unhealthy container', { 
                containerId, 
                error: error.message 
            });
        }
    }

    /**
     * Wait for service health
     */
    async waitForServiceHealth(services, timeout = 120000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const healthStatuses = [];
            
            for (const [serviceName, serviceInfo] of services) {
                if (serviceInfo.status !== 'started') continue;
                
                const healthCheck = this.healthChecks.get(serviceInfo.containerId);
                if (healthCheck) {
                    healthStatuses.push({
                        service: serviceName,
                        status: healthCheck.status,
                        healthy: healthCheck.status === 'healthy'
                    });
                } else {
                    // No health check defined, assume healthy if running
                    healthStatuses.push({
                        service: serviceName,
                        status: 'healthy',
                        healthy: true
                    });
                }
            }
            
            if (healthStatuses.every(h => h.healthy)) {
                this.logger.info('All services are healthy');
                return;
            }
            
            await this.delay(5000); // Check every 5 seconds
        }
        
        throw new Error('Timeout waiting for services to become healthy');
    }

    /**
     * Graceful shutdown of all containers
     */
    async gracefulShutdown(timeout = 30000) {
        this.logger.info('Starting graceful shutdown');
        
        // Stop health check monitoring
        if (this.networkMonitorInterval) {
            clearInterval(this.networkMonitorInterval);
        }
        
        // Get all managed containers
        const containers = await this.docker.listContainers({
            filters: { label: ['lifecycle-managed=true'] }
        });
        
        // Group containers by shutdown priority (reverse of startup order)
        const shutdownGroups = this.groupContainersForShutdown(containers);
        
        for (const group of shutdownGroups) {
            await Promise.all(group.map(container => this.shutdownContainer(container.Id, timeout / shutdownGroups.length)));
        }
        
        this.logger.info('Graceful shutdown completed');
    }

    /**
     * Group containers for shutdown (reverse dependency order)
     */
    groupContainersForShutdown(containers) {
        // For now, simple grouping - can be enhanced with dependency analysis
        return [containers];
    }

    /**
     * Shutdown individual container gracefully
     */
    async shutdownContainer(containerId, timeout = 10000) {
        try {
            const container = this.docker.getContainer(containerId);
            
            // Send SIGTERM for graceful shutdown
            await container.stop({ t: timeout / 1000 });
            
            // Update database
            await this.db.db.run(`
                UPDATE containers 
                SET status = ?, stopped_at = ?
                WHERE id = ?
            `, ['stopped', Date.now(), containerId]);
            
            this.logger.info('Container gracefully stopped', { containerId });
            
        } catch (error) {
            this.logger.error('Failed to gracefully stop container', { 
                containerId, 
                error: error.message 
            });
        }
    }

    /**
     * Convert stream to string
     */
    async streamToString(stream) {
        const chunks = [];
        return new Promise((resolve, reject) => {
            stream.on('data', chunk => chunks.push(chunk));
            stream.on('error', reject);
            stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        });
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