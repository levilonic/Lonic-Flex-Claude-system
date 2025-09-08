const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');
const winston = require('winston');

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
            agentFailures: 3
        };
        this.collectors = new Map();
        this.isRunning = false;
        this.collectInterval = 60000; // 1 minute
        this.retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
        
        this.setupLogger();
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