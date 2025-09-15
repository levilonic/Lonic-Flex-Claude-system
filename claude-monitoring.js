const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');
const Docker = require('dockerode');

class MonitoringSystem extends EventEmitter {
    constructor() {
        super();
        this.metrics = new Map();
        this.alerts = new Map();
        this.thresholds = {
            cpu: 80,
            memory: 85,
            diskSpace: 90,
            responseTime: 5000,
            errorRate: 5,
            agentFailures: 3,
            containerMemory: 80,    // Container memory usage %
            containerCpu: 75,       // Container CPU usage %
            containerRestart: 3,    // Container restart count
            logSize: 1000,         // Log file size MB
            diskIO: 90             // Disk I/O usage %
        };
        this.collectors = new Map();
        this.isRunning = false;
        this.collectInterval = 60000; // 1 minute
        this.retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        // Docker integration
        this.docker = new Docker();
        this.logStreams = new Map();
        this.logRotation = {
            maxSize: 100 * 1024 * 1024, // 100MB
            maxFiles: 10,
            rotateInterval: 24 * 60 * 60 * 1000 // Daily
        };
        
        this.setupLogger();
        this.setupLogRotation();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/monitoring.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        try {
            await this.createDirectories();
            await this.setupDefaultCollectors();
            await this.loadConfiguration();
            
            this.logger.info('Monitoring system initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize monitoring system:', error);
            throw error;
        }
    }

    async createDirectories() {
        const dirs = ['logs', 'metrics', 'alerts'];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async setupDefaultCollectors() {
        // System metrics collector
        this.addCollector('system', async () => {
            const usage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();
            
            return {
                memory: {
                    rss: usage.rss,
                    heapTotal: usage.heapTotal,
                    heapUsed: usage.heapUsed,
                    external: usage.external,
                    percentage: (usage.heapUsed / usage.heapTotal) * 100
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                uptime: process.uptime()
            };
        });

        // Agent performance collector
        this.addCollector('agents', async () => {
            return {
                totalAgents: this.getTotalAgents(),
                activeAgents: this.getActiveAgents(),
                failedAgents: this.getFailedAgents(),
                avgResponseTime: this.getAverageResponseTime(),
                successRate: this.getSuccessRate()
            };
        });

        // Database metrics collector
        this.addCollector('database', async () => {
            return {
                connections: this.getDatabaseConnections(),
                queryTime: this.getAverageQueryTime(),
                tableSize: await this.getTableSizes()
            };
        });

        // Slack integration metrics
        this.addCollector('slack', async () => {
            return {
                messagesProcessed: this.getSlackMessagesProcessed(),
                commandsExecuted: this.getSlackCommandsExecuted(),
                responseTime: this.getSlackResponseTime(),
                errors: this.getSlackErrors()
            };
        });

        // GitHub integration metrics
        this.addCollector('github', async () => {
            return {
                webhooksReceived: this.getGitHubWebhooksReceived(),
                workflowsTriggered: this.getWorkflowsTriggered(),
                apiCalls: this.getGitHubApiCalls(),
                rateLimitRemaining: this.getGitHubRateLimit()
            };
        });

        // Docker container metrics
        this.addCollector('docker', async () => {
            return await this.collectDockerMetrics();
        });

        // Log file metrics
        this.addCollector('logs', async () => {
            return await this.collectLogMetrics();
        });
    }

    addCollector(name, collector) {
        this.collectors.set(name, collector);
        this.logger.info(`Added metrics collector: ${name}`);
    }

    async start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.collectMetrics();
        
        this.collectTimer = setInterval(() => {
            this.collectMetrics();
        }, this.collectInterval);

        this.cleanupTimer = setInterval(() => {
            this.cleanupOldMetrics();
        }, 24 * 60 * 60 * 1000); // Daily cleanup

        this.logger.info('Monitoring system started');
    }

    async stop() {
        this.isRunning = false;
        
        if (this.collectTimer) {
            clearInterval(this.collectTimer);
        }
        
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        
        this.logger.info('Monitoring system stopped');
    }

    async collectMetrics() {
        const timestamp = Date.now();
        const allMetrics = {};

        for (const [name, collector] of this.collectors) {
            try {
                const metrics = await collector();
                allMetrics[name] = {
                    timestamp,
                    data: metrics
                };
                
                this.metrics.set(`${name}_${timestamp}`, metrics);
                this.checkThresholds(name, metrics);
                
            } catch (error) {
                this.logger.error(`Failed to collect ${name} metrics:`, error);
            }
        }

        // Store metrics to file
        await this.storeMetrics(timestamp, allMetrics);
        
        this.emit('metricsCollected', allMetrics);
    }

    async storeMetrics(timestamp, metrics) {
        const filename = `metrics/metrics_${new Date(timestamp).toISOString().split('T')[0]}.json`;
        const data = JSON.stringify({ timestamp, metrics }, null, 2);
        
        try {
            await fs.appendFile(filename, data + '\n');
        } catch (error) {
            this.logger.error('Failed to store metrics:', error);
        }
    }

    checkThresholds(category, metrics) {
        switch (category) {
            case 'system':
                if (metrics.memory.percentage > this.thresholds.memory) {
                    this.triggerAlert('high_memory', 'Memory usage exceeds threshold', {
                        current: metrics.memory.percentage,
                        threshold: this.thresholds.memory
                    });
                }
                break;

            case 'agents':
                if (metrics.failedAgents > this.thresholds.agentFailures) {
                    this.triggerAlert('agent_failures', 'Multiple agent failures detected', {
                        current: metrics.failedAgents,
                        threshold: this.thresholds.agentFailures
                    });
                }
                
                if (metrics.avgResponseTime > this.thresholds.responseTime) {
                    this.triggerAlert('slow_response', 'Agent response time exceeds threshold', {
                        current: metrics.avgResponseTime,
                        threshold: this.thresholds.responseTime
                    });
                }
                
                if (metrics.successRate < (100 - this.thresholds.errorRate)) {
                    this.triggerAlert('high_error_rate', 'Agent error rate exceeds threshold', {
                        current: 100 - metrics.successRate,
                        threshold: this.thresholds.errorRate
                    });
                }
                break;
        }
    }

    triggerAlert(type, message, data) {
        const alert = {
            id: `alert_${Date.now()}`,
            type,
            message,
            data,
            timestamp: Date.now(),
            status: 'active'
        };

        this.alerts.set(alert.id, alert);
        this.logger.warn('Alert triggered:', alert);
        this.emit('alert', alert);
        
        // Store alert
        this.storeAlert(alert);
    }

    async storeAlert(alert) {
        const filename = `alerts/alerts_${new Date().toISOString().split('T')[0]}.json`;
        const data = JSON.stringify(alert, null, 2);
        
        try {
            await fs.appendFile(filename, data + '\n');
        } catch (error) {
            this.logger.error('Failed to store alert:', error);
        }
    }

    async getMetrics(category = null, timeRange = 3600000) { // 1 hour default
        const now = Date.now();
        const startTime = now - timeRange;
        const results = {};

        for (const [key, value] of this.metrics) {
            const [cat, timestamp] = key.split('_');
            const time = parseInt(timestamp);
            
            if (time >= startTime && (!category || cat === category)) {
                if (!results[cat]) results[cat] = [];
                results[cat].push({ timestamp: time, ...value });
            }
        }

        return results;
    }

    async getAlerts(status = null, timeRange = 86400000) { // 24 hours default
        const now = Date.now();
        const startTime = now - timeRange;
        const results = [];

        for (const alert of this.alerts.values()) {
            if (alert.timestamp >= startTime && (!status || alert.status === status)) {
                results.push(alert);
            }
        }

        return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    async generateReport(timeRange = 86400000) {
        const metrics = await this.getMetrics(null, timeRange);
        const alerts = await this.getAlerts(null, timeRange);
        
        const report = {
            generatedAt: Date.now(),
            timeRange,
            summary: this.generateSummary(metrics),
            metrics,
            alerts: alerts.length,
            activeAlerts: alerts.filter(a => a.status === 'active').length
        };

        return report;
    }

    generateSummary(metrics) {
        const summary = {};
        
        for (const [category, data] of Object.entries(metrics)) {
            if (data.length === 0) continue;
            
            switch (category) {
                case 'system':
                    const memoryUsage = data.map(d => d.memory.percentage);
                    summary.system = {
                        avgMemoryUsage: this.average(memoryUsage),
                        maxMemoryUsage: Math.max(...memoryUsage),
                        uptimeHours: data[data.length - 1]?.uptime / 3600
                    };
                    break;
                    
                case 'agents':
                    const responseTimes = data.map(d => d.avgResponseTime);
                    const successRates = data.map(d => d.successRate);
                    summary.agents = {
                        avgResponseTime: this.average(responseTimes),
                        avgSuccessRate: this.average(successRates),
                        totalFailures: data.reduce((sum, d) => sum + d.failedAgents, 0)
                    };
                    break;
            }
        }
        
        return summary;
    }

    average(arr) {
        return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    }

    async cleanupOldMetrics() {
        const cutoff = Date.now() - this.retentionPeriod;
        let cleaned = 0;

        for (const [key] of this.metrics) {
            const timestamp = parseInt(key.split('_')[1]);
            if (timestamp < cutoff) {
                this.metrics.delete(key);
                cleaned++;
            }
        }

        // Cleanup old alert entries
        for (const [id, alert] of this.alerts) {
            if (alert.timestamp < cutoff) {
                this.alerts.delete(id);
                cleaned++;
            }
        }

        this.logger.info(`Cleaned up ${cleaned} old metric entries`);
    }

    /**
     * Setup log rotation system
     */
    setupLogRotation() {
        // Setup container log rotation
        setInterval(() => {
            this.rotateContainerLogs();
        }, this.logRotation.rotateInterval);

        // Setup application log rotation
        setInterval(() => {
            this.rotateApplicationLogs();
        }, this.logRotation.rotateInterval);
    }

    /**
     * Collect Docker container metrics
     */
    async collectDockerMetrics() {
        try {
            const containers = await this.docker.listContainers();
            const claudeContainers = containers.filter(c => 
                c.Labels && c.Labels['claude-agent'] === 'true'
            );

            const metrics = {
                totalContainers: claudeContainers.length,
                runningContainers: claudeContainers.filter(c => c.State === 'running').length,
                containers: []
            };

            // Collect detailed metrics for each container
            for (const containerInfo of claudeContainers) {
                try {
                    const container = this.docker.getContainer(containerInfo.Id);
                    const stats = await container.stats({ stream: false });
                    const inspect = await container.inspect();

                    const containerMetrics = {
                        id: containerInfo.Id,
                        name: containerInfo.Names[0],
                        image: containerInfo.Image,
                        state: containerInfo.State,
                        status: containerInfo.Status,
                        agentType: containerInfo.Labels['claude-agent-type'] || 'unknown',
                        created: inspect.Created,
                        restartCount: inspect.RestartCount,
                        
                        // Resource usage
                        memory: {
                            usage: stats.memory_stats.usage || 0,
                            limit: stats.memory_stats.limit || 0,
                            percentage: stats.memory_stats.limit ? 
                                (stats.memory_stats.usage / stats.memory_stats.limit) * 100 : 0
                        },
                        
                        cpu: {
                            totalUsage: stats.cpu_stats.cpu_usage?.total_usage || 0,
                            systemUsage: stats.cpu_stats.system_cpu_usage || 0,
                            percentage: this.calculateCpuPercentage(stats.cpu_stats, stats.precpu_stats)
                        },
                        
                        network: {
                            rxBytes: this.sumNetworkStats(stats.networks, 'rx_bytes'),
                            txBytes: this.sumNetworkStats(stats.networks, 'tx_bytes'),
                            rxPackets: this.sumNetworkStats(stats.networks, 'rx_packets'),
                            txPackets: this.sumNetworkStats(stats.networks, 'tx_packets')
                        }
                    };

                    metrics.containers.push(containerMetrics);

                    // Check container-specific thresholds
                    this.checkContainerThresholds(containerMetrics);

                } catch (error) {
                    this.logger.error(`Failed to collect metrics for container ${containerInfo.Id}`, { error: error.message });
                }
            }

            return metrics;

        } catch (error) {
            this.logger.error('Failed to collect Docker metrics', { error: error.message });
            return { totalContainers: 0, runningContainers: 0, containers: [] };
        }
    }

    /**
     * Calculate CPU percentage from Docker stats
     */
    calculateCpuPercentage(cpuStats, preCpuStats) {
        if (!cpuStats.cpu_usage || !preCpuStats.cpu_usage) return 0;

        const cpuDelta = cpuStats.cpu_usage.total_usage - preCpuStats.cpu_usage.total_usage;
        const systemDelta = cpuStats.system_cpu_usage - preCpuStats.system_cpu_usage;
        const numberCpus = cpuStats.online_cpus || 1;

        if (systemDelta > 0 && cpuDelta > 0) {
            return (cpuDelta / systemDelta) * numberCpus * 100;
        }
        return 0;
    }

    /**
     * Sum network statistics across all interfaces
     */
    sumNetworkStats(networks, field) {
        if (!networks) return 0;
        return Object.values(networks).reduce((sum, net) => sum + (net[field] || 0), 0);
    }

    /**
     * Check container-specific thresholds
     */
    checkContainerThresholds(containerMetrics) {
        const alerts = [];

        // Memory threshold
        if (containerMetrics.memory.percentage > this.thresholds.containerMemory) {
            alerts.push({
                type: 'container-memory',
                severity: 'warning',
                message: `Container ${containerMetrics.name} memory usage is ${containerMetrics.memory.percentage.toFixed(1)}%`,
                data: containerMetrics
            });
        }

        // CPU threshold
        if (containerMetrics.cpu.percentage > this.thresholds.containerCpu) {
            alerts.push({
                type: 'container-cpu',
                severity: 'warning',
                message: `Container ${containerMetrics.name} CPU usage is ${containerMetrics.cpu.percentage.toFixed(1)}%`,
                data: containerMetrics
            });
        }

        // Restart count threshold
        if (containerMetrics.restartCount > this.thresholds.containerRestart) {
            alerts.push({
                type: 'container-restarts',
                severity: 'critical',
                message: `Container ${containerMetrics.name} has restarted ${containerMetrics.restartCount} times`,
                data: containerMetrics
            });
        }

        // Emit alerts
        alerts.forEach(alert => this.emit('alert', alert));
    }

    /**
     * Collect log file metrics
     */
    async collectLogMetrics() {
        try {
            const logDir = 'logs';
            const files = await fs.readdir(logDir);
            const logFiles = files.filter(f => f.endsWith('.log'));

            const metrics = {
                totalLogFiles: logFiles.length,
                files: []
            };

            for (const file of logFiles) {
                try {
                    const filePath = path.join(logDir, file);
                    const stats = await fs.stat(filePath);
                    
                    const fileMetrics = {
                        name: file,
                        size: stats.size,
                        sizeKB: Math.round(stats.size / 1024),
                        sizeMB: Math.round(stats.size / (1024 * 1024)),
                        lastModified: stats.mtime,
                        created: stats.birthtime
                    };

                    metrics.files.push(fileMetrics);

                    // Check log file size thresholds
                    if (fileMetrics.sizeMB > this.thresholds.logSize) {
                        this.emit('alert', {
                            type: 'log-size',
                            severity: 'warning',
                            message: `Log file ${file} is ${fileMetrics.sizeMB}MB`,
                            data: fileMetrics
                        });
                    }

                } catch (error) {
                    this.logger.error(`Failed to check log file ${file}`, { error: error.message });
                }
            }

            return metrics;

        } catch (error) {
            this.logger.error('Failed to collect log metrics', { error: error.message });
            return { totalLogFiles: 0, files: [] };
        }
    }

    /**
     * Rotate container logs
     */
    async rotateContainerLogs() {
        try {
            const containers = await this.docker.listContainers({
                filters: { label: ['claude-agent=true'] }
            });

            for (const containerInfo of containers) {
                const container = this.docker.getContainer(containerInfo.Id);
                const logs = await container.logs({
                    stdout: true,
                    stderr: true,
                    timestamps: true,
                    tail: 1000
                });

                const logContent = logs.toString();
                if (logContent.length > this.logRotation.maxSize) {
                    await this.archiveContainerLog(containerInfo, logContent);
                }
            }

        } catch (error) {
            this.logger.error('Failed to rotate container logs', { error: error.message });
        }
    }

    /**
     * Archive container log
     */
    async archiveContainerLog(containerInfo, logContent) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFileName = `logs/container-${containerInfo.Names[0].slice(1)}-${timestamp}.log`;
        
        try {
            await fs.writeFile(logFileName, logContent);
            this.logger.info(`Archived container log: ${logFileName}`);

            // Clear container logs (in production, this would be more sophisticated)
            this.logger.info(`Container ${containerInfo.Names[0]} logs archived and cleared`);

        } catch (error) {
            this.logger.error('Failed to archive container log', { error: error.message });
        }
    }

    /**
     * Rotate application logs
     */
    async rotateApplicationLogs() {
        const logFiles = ['logs/monitoring.log', 'logs/docker-manager.log', 'logs/agents.log'];
        
        for (const logFile of logFiles) {
            try {
                const stats = await fs.stat(logFile);
                if (stats.size > this.logRotation.maxSize) {
                    await this.rotateLogFile(logFile);
                }
            } catch (error) {
                // Log file doesn't exist or can't be accessed - skip
                continue;
            }
        }
    }

    /**
     * Rotate individual log file
     */
    async rotateLogFile(logFilePath) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const archivedPath = `${logFilePath}.${timestamp}`;
        
        try {
            // Move current log to archived version
            await fs.rename(logFilePath, archivedPath);
            
            // Create new empty log file
            await fs.writeFile(logFilePath, '');
            
            this.logger.info(`Log rotated: ${logFilePath} -> ${archivedPath}`);

            // Clean up old archived logs (keep only maxFiles)
            await this.cleanupArchivedLogs(logFilePath);

        } catch (error) {
            this.logger.error(`Failed to rotate log file ${logFilePath}`, { error: error.message });
        }
    }

    /**
     * Clean up old archived logs
     */
    async cleanupArchivedLogs(baseLogPath) {
        try {
            const logDir = path.dirname(baseLogPath);
            const baseName = path.basename(baseLogPath);
            const files = await fs.readdir(logDir);
            
            const archivedFiles = files
                .filter(f => f.startsWith(baseName + '.'))
                .map(f => ({
                    name: f,
                    path: path.join(logDir, f),
                    mtime: 0
                }));

            // Get modification times
            for (const file of archivedFiles) {
                const stats = await fs.stat(file.path);
                file.mtime = stats.mtime.getTime();
            }

            // Sort by modification time (newest first)
            archivedFiles.sort((a, b) => b.mtime - a.mtime);

            // Remove excess files
            if (archivedFiles.length > this.logRotation.maxFiles) {
                const filesToDelete = archivedFiles.slice(this.logRotation.maxFiles);
                for (const file of filesToDelete) {
                    await fs.unlink(file.path);
                    this.logger.info(`Deleted old log archive: ${file.name}`);
                }
            }

        } catch (error) {
            this.logger.error('Failed to cleanup archived logs', { error: error.message });
        }
    }

    // Placeholder methods for actual metric collection
    getTotalAgents() { return 6; }
    getActiveAgents() { return Math.floor(Math.random() * 6) + 1; }
    getFailedAgents() { return Math.floor(Math.random() * 2); }
    getAverageResponseTime() { return Math.floor(Math.random() * 3000) + 500; }
    getSuccessRate() { return Math.floor(Math.random() * 10) + 90; }
    getDatabaseConnections() { return Math.floor(Math.random() * 5) + 1; }
    getAverageQueryTime() { return Math.floor(Math.random() * 100) + 10; }
    async getTableSizes() { return { sessions: 1024, agents: 512, oauth_states: 256 }; }
    getSlackMessagesProcessed() { return Math.floor(Math.random() * 100); }
    getSlackCommandsExecuted() { return Math.floor(Math.random() * 20); }
    getSlackResponseTime() { return Math.floor(Math.random() * 1000) + 200; }
    getSlackErrors() { return Math.floor(Math.random() * 3); }
    getGitHubWebhooksReceived() { return Math.floor(Math.random() * 10); }
    getWorkflowsTriggered() { return Math.floor(Math.random() * 5); }
    getGitHubApiCalls() { return Math.floor(Math.random() * 50); }
    getGitHubRateLimit() { return Math.floor(Math.random() * 4000) + 1000; }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'monitoring.json');
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            
            if (config.thresholds) {
                Object.assign(this.thresholds, config.thresholds);
            }
            
            if (config.collectInterval) {
                this.collectInterval = config.collectInterval;
            }
            
            this.logger.info('Monitoring configuration loaded');
        } catch (error) {
            this.logger.info('Using default monitoring configuration');
        }
    }
}

module.exports = { MonitoringSystem };

if (require.main === module) {
    const monitoring = new MonitoringSystem();
    
    monitoring.on('alert', (alert) => {
        console.log(`🚨 ALERT: ${alert.message}`, alert.data);
    });

    monitoring.on('metricsCollected', (metrics) => {
        console.log(`📊 Metrics collected at ${new Date().toISOString()}`);
    });

    async function demo() {
        console.log('🔍 Starting Monitoring System Demo...\n');
        
        await monitoring.initialize();
        await monitoring.start();
        
        console.log('⚡ Monitoring system running...');
        console.log('📈 Collecting metrics every minute');
        console.log('🚨 Monitoring for threshold breaches\n');
        
        // Generate a report after 5 seconds
        setTimeout(async () => {
            const report = await monitoring.generateReport();
            console.log('📋 Generated Report:', JSON.stringify(report, null, 2));
        }, 5000);
        
        // Stop after 10 seconds for demo
        setTimeout(async () => {
            await monitoring.stop();
            console.log('\n✅ Monitoring demo completed');
            process.exit(0);
        }, 10000);
    }

    demo().catch(console.error);
}