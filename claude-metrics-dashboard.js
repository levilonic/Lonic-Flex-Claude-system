const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { MonitoringSystem } = require('./claude-monitoring');

class MetricsDashboard {
    constructor(port = 3001) {
        this.app = express();
        this.port = port;
        this.monitoring = new MonitoringSystem();
        this.isRunning = false;
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // CORS middleware
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }

    setupRoutes() {
        // Dashboard home page
        this.app.get('/', (req, res) => {
            res.send(this.generateDashboardHTML());
        });

        // API endpoints
        this.app.get('/api/metrics', async (req, res) => {
            try {
                const timeRange = parseInt(req.query.timeRange) || 3600000;
                const category = req.query.category || null;
                const metrics = await this.monitoring.getMetrics(category, timeRange);
                res.json(metrics);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/alerts', async (req, res) => {
            try {
                const timeRange = parseInt(req.query.timeRange) || 86400000;
                const status = req.query.status || null;
                const alerts = await this.monitoring.getAlerts(status, timeRange);
                res.json(alerts);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/report', async (req, res) => {
            try {
                const timeRange = parseInt(req.query.timeRange) || 86400000;
                const report = await this.monitoring.generateReport(timeRange);
                res.json(report);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/health', (req, res) => {
            res.json({
                status: 'healthy',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: Date.now()
            });
        });

        // Real-time metrics endpoint (SSE)
        this.app.get('/api/stream', (req, res) => {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            const sendMetrics = (metrics) => {
                res.write(`data: ${JSON.stringify(metrics)}\n\n`);
            };

            this.monitoring.on('metricsCollected', sendMetrics);

            req.on('close', () => {
                this.monitoring.removeListener('metricsCollected', sendMetrics);
            });
        });
    }

    async start() {
        if (this.isRunning) return;

        await this.monitoring.initialize();
        await this.monitoring.start();

        this.server = this.app.listen(this.port, () => {
            console.log(`📊 Metrics Dashboard running on http://localhost:${this.port}`);
        });

        this.isRunning = true;
    }

    async stop() {
        if (!this.isRunning) return;

        await this.monitoring.stop();
        
        if (this.server) {
            this.server.close();
        }

        this.isRunning = false;
    }

    generateDashboardHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LonicFLex Monitoring Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #fff;
            min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            backdrop-filter: blur(10px);
        }
        .header h1 { font-size: 2.5rem; margin-bottom: 10px; }
        .header p { opacity: 0.8; font-size: 1.1rem; }
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .card {
            background: rgba(255,255,255,0.1);
            border-radius: 15px;
            padding: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.2);
        }
        .card h3 {
            margin-bottom: 15px;
            font-size: 1.3rem;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            margin: 10px 0;
        }
        .metric-label {
            opacity: 0.7;
            font-size: 0.9rem;
            margin-bottom: 5px;
        }
        .status-indicator {
            display: inline-block;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            margin-left: 10px;
        }
        .status-healthy { background: #4ade80; }
        .status-warning { background: #fbbf24; }
        .status-error { background: #f87171; }
        .alerts {
            background: rgba(248,113,113,0.2);
            border-color: rgba(248,113,113,0.3);
        }
        .alert-item {
            padding: 10px;
            margin: 5px 0;
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            font-size: 0.9rem;
        }
        .chart-placeholder {
            height: 200px;
            background: rgba(255,255,255,0.05);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-top: 15px;
        }
        .refresh-btn {
            background: rgba(255,255,255,0.2);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            margin-top: 10px;
        }
        .refresh-btn:hover {
            background: rgba(255,255,255,0.3);
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 LonicFLex Monitoring</h1>
            <p>Multi-Agent Infrastructure Metrics & Health Dashboard</p>
        </div>

        <div class="grid">
            <div class="card">
                <h3>🖥️ System Health <span class="status-indicator status-healthy" id="system-status"></span></h3>
                <div class="metric-label">Memory Usage</div>
                <div class="metric-value" id="memory-usage">--</div>
                <div class="metric-label">Uptime</div>
                <div class="metric-value" id="uptime">--</div>
            </div>

            <div class="card">
                <h3>🤖 Agent Performance <span class="status-indicator status-healthy" id="agent-status"></span></h3>
                <div class="metric-label">Active Agents</div>
                <div class="metric-value" id="active-agents">--</div>
                <div class="metric-label">Success Rate</div>
                <div class="metric-value" id="success-rate">--</div>
            </div>

            <div class="card">
                <h3>💬 Slack Integration <span class="status-indicator status-healthy" id="slack-status"></span></h3>
                <div class="metric-label">Messages Processed</div>
                <div class="metric-value" id="slack-messages">--</div>
                <div class="metric-label">Response Time</div>
                <div class="metric-value" id="slack-response">--</div>
            </div>

            <div class="card">
                <h3>🐙 GitHub Integration <span class="status-indicator status-healthy" id="github-status"></span></h3>
                <div class="metric-label">Webhooks Received</div>
                <div class="metric-value" id="github-webhooks">--</div>
                <div class="metric-label">Rate Limit</div>
                <div class="metric-value" id="github-rate-limit">--</div>
            </div>

            <div class="card">
                <h3>💾 Database <span class="status-indicator status-healthy" id="db-status"></span></h3>
                <div class="metric-label">Connections</div>
                <div class="metric-value" id="db-connections">--</div>
                <div class="metric-label">Query Time</div>
                <div class="metric-value" id="db-query-time">--</div>
            </div>

            <div class="card alerts">
                <h3>🚨 Active Alerts</h3>
                <div id="alerts-list">No active alerts</div>
                <button class="refresh-btn" onclick="refreshAlerts()">Refresh Alerts</button>
            </div>
        </div>

        <div class="card">
            <h3>📈 Real-time Metrics</h3>
            <div class="chart-placeholder">
                Real-time chart will appear here<br>
                <small>(Connect to /api/stream for live data)</small>
            </div>
        </div>
    </div>

    <script>
        async function fetchMetrics() {
            try {
                const response = await fetch('/api/report?timeRange=300000'); // 5 minutes
                const data = await response.json();
                
                // Update system metrics
                if (data.summary?.system) {
                    document.getElementById('memory-usage').textContent = 
                        Math.round(data.summary.system.avgMemoryUsage) + '%';
                    document.getElementById('uptime').textContent = 
                        Math.round(data.summary.system.uptimeHours) + 'h';
                }
                
                // Update agent metrics
                if (data.summary?.agents) {
                    document.getElementById('success-rate').textContent = 
                        Math.round(data.summary.agents.avgSuccessRate) + '%';
                    document.getElementById('active-agents').textContent = '6/6';
                }
                
                // Update integration metrics (simulated for demo)
                document.getElementById('slack-messages').textContent = Math.floor(Math.random() * 50);
                document.getElementById('slack-response').textContent = Math.floor(Math.random() * 1000) + 'ms';
                document.getElementById('github-webhooks').textContent = Math.floor(Math.random() * 10);
                document.getElementById('github-rate-limit').textContent = Math.floor(Math.random() * 1000) + 3000;
                document.getElementById('db-connections').textContent = Math.floor(Math.random() * 5) + 1;
                document.getElementById('db-query-time').textContent = Math.floor(Math.random() * 50) + 10 + 'ms';
                
            } catch (error) {
                console.error('Failed to fetch metrics:', error);
            }
        }
        
        async function refreshAlerts() {
            try {
                const response = await fetch('/api/alerts?timeRange=3600000');
                const alerts = await response.json();
                const alertsList = document.getElementById('alerts-list');
                
                if (alerts.length === 0) {
                    alertsList.innerHTML = 'No active alerts';
                } else {
                    alertsList.innerHTML = alerts.slice(0, 3).map(alert => 
                        '<div class="alert-item">' + alert.message + '</div>'
                    ).join('');
                }
            } catch (error) {
                console.error('Failed to fetch alerts:', error);
            }
        }
        
        // Initialize dashboard
        fetchMetrics();
        refreshAlerts();
        
        // Auto-refresh every 30 seconds
        setInterval(fetchMetrics, 30000);
        setInterval(refreshAlerts, 60000);
        
        // Connect to real-time stream
        const eventSource = new EventSource('/api/stream');
        eventSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('Real-time metrics:', data);
            // Update charts here when implemented
        };
    </script>
</body>
</html>`;
    }
}

module.exports = { MetricsDashboard };

if (require.main === module) {
    const dashboard = new MetricsDashboard(3001);
    
    async function demo() {
        console.log('📊 Starting Metrics Dashboard Demo...\n');
        
        await dashboard.start();
        
        console.log('🌐 Dashboard available at: http://localhost:3001');
        console.log('📡 Real-time metrics streaming enabled');
        console.log('🔄 Auto-refresh every 30 seconds\n');
        
        console.log('Available endpoints:');
        console.log('  GET /                    - Dashboard UI');
        console.log('  GET /api/metrics         - Get metrics data');
        console.log('  GET /api/alerts          - Get alerts');
        console.log('  GET /api/report          - Generate report');
        console.log('  GET /api/health          - Health check');
        console.log('  GET /api/stream          - Real-time stream\n');
        
        // Keep running for demo
        process.on('SIGINT', async () => {
            console.log('\n🛑 Stopping dashboard...');
            await dashboard.stop();
            process.exit(0);
        });
    }

    demo().catch(console.error);
}