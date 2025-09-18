#!/usr/bin/env node
/**
 * LonicFLex Jenkins Integration Service - Window 2
 * Real Jenkins REST API integration for CI/CD workflow automation
 *
 * Handles:
 * - Jenkins REST API integration with API token authentication
 * - Job management (create, trigger, monitor)
 * - Build artifact handling
 * - Pipeline orchestration and monitoring
 * - Cross-system workflow coordination
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexJenkinsService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.JENKINS_SERVICE_PORT || 3024,
            serviceName: 'lonicflex-jenkins',
            jenkinsUrl: config.jenkinsUrl || process.env.JENKINS_URL || 'http://localhost:8080',
            username: config.username || process.env.JENKINS_USERNAME,
            apiToken: config.apiToken || process.env.JENKINS_API_TOKEN,
            requestTimeout: config.requestTimeout || 60000, // 60 seconds for builds
            pollInterval: config.pollInterval || 10000, // 10 seconds
            retryAttempts: config.retryAttempts || 3,
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new SQLiteManager();
        this.contextManager = new Factor3ContextManager();

        // Jenkins state management
        this.jobs = new Map();                      // jobName -> job info
        this.builds = new Map();                    // buildId -> build info
        this.pipelines = new Map();                 // pipelineId -> pipeline state
        this.activeBuilds = new Map();              // buildNumber -> build tracking
        this.stats = {
            jobsCreated: 0,
            buildsTriggered: 0,
            buildsCompleted: 0,
            buildsFailed: 0,
            pipelinesManaged: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0,
            averageBuildTime: 0
        };

        // Jenkins API client configuration
        this.authenticated = false;
        this.jenkinsVersion = null;

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-jenkins.log'
                })
            ]
        });

        this.startTime = new Date();
    }

    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging middleware
        this.app.use((req, res, next) => {
            const start = Date.now();
            res.on('finish', () => {
                const duration = Date.now() - start;
                this.logger.info('Request completed', {
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration
                });

                // Update average response time
                this.stats.averageResponseTime =
                    (this.stats.averageResponseTime + duration) / 2;
            });
            next();
        });
    }

    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', async (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();

            // Check Jenkins connectivity
            let jenkinsHealth = 'unknown';
            try {
                if (this.authenticated) {
                    await this.getJenkinsInfo();
                    jenkinsHealth = 'connected';
                }
            } catch (error) {
                jenkinsHealth = 'disconnected';
            }

            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                jenkinsHealth,
                jenkinsVersion: this.jenkinsVersion,
                stats: this.stats,
                jobs: this.jobs.size,
                activeBuilds: this.activeBuilds.size,
                timestamp: new Date().toISOString()
            });
        });

        // Create Jenkins job
        this.app.post('/jobs/create', async (req, res) => {
            try {
                const { jobName, jobConfig } = req.body;

                if (!jobName || !jobConfig) {
                    return res.status(400).json({ error: 'jobName and jobConfig required' });
                }

                const job = await this.createJob(jobName, jobConfig);

                this.stats.jobsCreated++;
                this.jobs.set(jobName, job);

                this.logger.info('Jenkins job created', { jobName });

                res.json({
                    success: true,
                    job: {
                        name: jobName,
                        url: `${this.config.jenkinsUrl}/job/${jobName}`,
                        created: true
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create Jenkins job', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Trigger Jenkins build
        this.app.post('/builds/trigger', async (req, res) => {
            try {
                const { jobName, parameters = {}, waitForCompletion = false } = req.body;

                if (!jobName) {
                    return res.status(400).json({ error: 'jobName required' });
                }

                const build = await this.triggerBuild(jobName, parameters, waitForCompletion);

                this.stats.buildsTriggered++;

                this.logger.info('Jenkins build triggered', {
                    jobName,
                    buildNumber: build.buildNumber,
                    parameters
                });

                res.json({
                    success: true,
                    build: {
                        jobName,
                        buildNumber: build.buildNumber,
                        buildUrl: build.buildUrl,
                        queueId: build.queueId,
                        status: build.status,
                        parameters
                    }
                });

            } catch (error) {
                this.logger.error('Failed to trigger Jenkins build', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get build status
        this.app.get('/builds/:jobName/:buildNumber', async (req, res) => {
            try {
                const { jobName, buildNumber } = req.params;

                const build = await this.getBuildInfo(jobName, buildNumber);

                res.json({
                    success: true,
                    build: {
                        jobName,
                        buildNumber: parseInt(buildNumber),
                        status: build.result || 'RUNNING',
                        building: build.building,
                        duration: build.duration,
                        timestamp: build.timestamp,
                        url: build.url,
                        console: `${build.url}console`
                    }
                });

            } catch (error) {
                this.logger.error('Failed to get Jenkins build info', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Get build console output
        this.app.get('/builds/:jobName/:buildNumber/console', async (req, res) => {
            try {
                const { jobName, buildNumber } = req.params;
                const { start = 0 } = req.query;

                const console = await this.getBuildConsole(jobName, buildNumber, parseInt(start));

                res.json({
                    success: true,
                    console: {
                        jobName,
                        buildNumber: parseInt(buildNumber),
                        output: console.output,
                        hasMoreData: console.hasMoreData,
                        size: console.size
                    }
                });

            } catch (error) {
                this.logger.error('Failed to get Jenkins console output', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // List Jenkins jobs
        this.app.get('/jobs', async (req, res) => {
            try {
                const jobs = await this.getJobs();

                res.json({
                    success: true,
                    jobs: jobs.map(job => ({
                        name: job.name,
                        url: job.url,
                        color: job.color,
                        buildable: job.buildable,
                        lastBuild: job.lastBuild?.number || null,
                        lastSuccessfulBuild: job.lastSuccessfulBuild?.number || null,
                        lastFailedBuild: job.lastFailedBuild?.number || null
                    }))
                });

            } catch (error) {
                this.logger.error('Failed to get Jenkins jobs', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create pipeline
        this.app.post('/pipelines/create', async (req, res) => {
            try {
                const { pipelineName, stages, triggerJobName } = req.body;

                if (!pipelineName || !stages || !Array.isArray(stages)) {
                    return res.status(400).json({ error: 'pipelineName and stages array required' });
                }

                const pipeline = await this.createPipeline(pipelineName, stages, triggerJobName);

                this.stats.pipelinesManaged++;
                this.pipelines.set(pipelineName, pipeline);

                this.logger.info('Jenkins pipeline created', { pipelineName, stages: stages.length });

                res.json({
                    success: true,
                    pipeline: {
                        name: pipelineName,
                        stages: stages.length,
                        triggerJob: triggerJobName,
                        created: true
                    }
                });

            } catch (error) {
                this.logger.error('Failed to create Jenkins pipeline', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Standard LonicFLex service coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Service statistics
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                jobs: this.jobs.size,
                pipelines: this.pipelines.size,
                activeBuilds: this.activeBuilds.size,
                jenkinsVersion: this.jenkinsVersion
            });
        });
    }

    async createJob(jobName, jobConfig) {
        const configXml = this.generateJobConfigXML(jobConfig);

        await this.makeJenkinsRequest(
            `job/${jobName}/config.xml`,
            'POST',
            configXml,
            { 'Content-Type': 'application/xml' }
        );

        return {
            name: jobName,
            config: jobConfig,
            createdAt: new Date()
        };
    }

    generateJobConfigXML(jobConfig) {
        const { description = '', scmUrl = '', buildScript = '', parameters = [] } = jobConfig;

        let parametersXml = '';
        if (parameters.length > 0) {
            parametersXml = `
                <properties>
                    <hudson.model.ParametersDefinitionProperty>
                        <parameterDefinitions>
                            ${parameters.map(param => `
                                <hudson.model.StringParameterDefinition>
                                    <name>${param.name}</name>
                                    <description>${param.description || ''}</description>
                                    <defaultValue>${param.defaultValue || ''}</defaultValue>
                                </hudson.model.StringParameterDefinition>
                            `).join('')}
                        </parameterDefinitions>
                    </hudson.model.ParametersDefinitionProperty>
                </properties>
            `;
        }

        return `<?xml version='1.1' encoding='UTF-8'?>
<project>
    <description>${description}</description>
    ${parametersXml}
    <scm class="hudson.plugins.git.GitSCM" plugin="git@4.8.3">
        <configVersion>2</configVersion>
        <userRemoteConfigs>
            <hudson.plugins.git.UserRemoteConfig>
                <url>${scmUrl}</url>
            </hudson.plugins.git.UserRemoteConfig>
        </userRemoteConfigs>
        <branches>
            <hudson.plugins.git.BranchSpec>
                <name>*/main</name>
            </hudson.plugins.git.BranchSpec>
        </branches>
    </scm>
    <builders>
        <hudson.tasks.Shell>
            <command>${buildScript}</command>
        </hudson.tasks.Shell>
    </builders>
    <publishers/>
    <buildWrappers/>
</project>`;
    }

    async triggerBuild(jobName, parameters = {}, waitForCompletion = false) {
        let endpoint = `job/${jobName}/build`;

        // Use buildWithParameters if parameters provided
        if (Object.keys(parameters).length > 0) {
            endpoint = `job/${jobName}/buildWithParameters`;
        }

        // Convert parameters to form data
        const formData = new URLSearchParams();
        Object.entries(parameters).forEach(([key, value]) => {
            formData.append(key, value);
        });

        const response = await this.makeJenkinsRequest(
            endpoint,
            'POST',
            formData.toString(),
            { 'Content-Type': 'application/x-www-form-urlencoded' }
        );

        // Get queue item ID from Location header
        const location = response.headers?.location;
        const queueId = location ? location.split('/').pop() : null;

        let buildNumber = null;
        let buildUrl = null;

        if (waitForCompletion && queueId) {
            // Poll for build number
            buildNumber = await this.pollForBuildNumber(queueId);
            buildUrl = `${this.config.jenkinsUrl}/job/${jobName}/${buildNumber}/`;

            // Track build for completion
            this.activeBuilds.set(`${jobName}-${buildNumber}`, {
                jobName,
                buildNumber,
                startedAt: new Date(),
                status: 'RUNNING'
            });

            // Wait for completion if requested
            if (waitForCompletion) {
                await this.waitForBuildCompletion(jobName, buildNumber);
            }
        }

        return {
            queueId,
            buildNumber,
            buildUrl,
            status: 'QUEUED'
        };
    }

    async pollForBuildNumber(queueId, maxAttempts = 30) {
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const queueItem = await this.makeJenkinsRequest(`queue/item/${queueId}/api/json`);

                if (queueItem.executable) {
                    return queueItem.executable.number;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, 2000));

            } catch (error) {
                this.logger.warn('Queue polling failed', { queueId, attempt: i + 1 });
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        throw new Error(`Build number not found for queue item ${queueId}`);
    }

    async waitForBuildCompletion(jobName, buildNumber, maxWaitTime = 600000) {
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const build = await this.getBuildInfo(jobName, buildNumber);

                if (!build.building && build.result) {
                    // Build completed
                    const buildKey = `${jobName}-${buildNumber}`;
                    const tracked = this.activeBuilds.get(buildKey);

                    if (tracked) {
                        tracked.status = build.result;
                        tracked.completedAt = new Date();
                        tracked.duration = build.duration;

                        // Update stats
                        if (build.result === 'SUCCESS') {
                            this.stats.buildsCompleted++;
                        } else {
                            this.stats.buildsFailed++;
                        }

                        // Update average build time
                        if (build.duration) {
                            this.stats.averageBuildTime =
                                (this.stats.averageBuildTime + build.duration) / 2;
                        }

                        this.activeBuilds.delete(buildKey);
                    }

                    return build;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, this.config.pollInterval));

            } catch (error) {
                this.logger.warn('Build polling failed', { jobName, buildNumber });
                await new Promise(resolve => setTimeout(resolve, this.config.pollInterval));
            }
        }

        throw new Error(`Build ${jobName}#${buildNumber} did not complete within ${maxWaitTime}ms`);
    }

    async getBuildInfo(jobName, buildNumber) {
        return await this.makeJenkinsRequest(`job/${jobName}/${buildNumber}/api/json`);
    }

    async getBuildConsole(jobName, buildNumber, start = 0) {
        const response = await this.makeJenkinsRequest(
            `job/${jobName}/${buildNumber}/logText/progressiveText?start=${start}`,
            'GET',
            null,
            {},
            {
                responseType: 'text',
                validateStatus: status => status < 400
            }
        );

        return {
            output: response.data,
            hasMoreData: response.headers['x-more-data'] === 'true',
            size: parseInt(response.headers['x-text-size'] || '0')
        };
    }

    async getJobs() {
        const response = await this.makeJenkinsRequest('api/json?tree=jobs[name,url,color,buildable,lastBuild[number],lastSuccessfulBuild[number],lastFailedBuild[number]]');
        return response.jobs || [];
    }

    async getJenkinsInfo() {
        return await this.makeJenkinsRequest('api/json');
    }

    async createPipeline(pipelineName, stages, triggerJobName) {
        // Create a pipeline job that orchestrates multiple stages
        const pipelineScript = this.generatePipelineScript(stages);

        const jobConfig = {
            description: `Pipeline: ${pipelineName}`,
            pipelineScript,
            parameters: [
                { name: 'TRIGGER_JOB', defaultValue: triggerJobName || '' }
            ]
        };

        await this.createPipelineJob(pipelineName, pipelineScript);

        return {
            name: pipelineName,
            stages,
            triggerJob: triggerJobName,
            createdAt: new Date()
        };
    }

    generatePipelineScript(stages) {
        const stagesScript = stages.map(stage => `
        stage('${stage.name}') {
            steps {
                ${stage.script || `echo 'Executing ${stage.name}'`}
            }
        }`).join('\n');

        return `
pipeline {
    agent any
    stages {${stagesScript}
    }
    post {
        always {
            echo 'Pipeline completed'
        }
        success {
            echo 'Pipeline succeeded'
        }
        failure {
            echo 'Pipeline failed'
        }
    }
}`;
    }

    async createPipelineJob(jobName, pipelineScript) {
        const configXml = `<?xml version='1.1' encoding='UTF-8'?>
<flow-definition plugin="workflow-job@2.40">
    <definition class="org.jenkinsci.plugins.workflow.cps.CpsFlowDefinition" plugin="workflow-cps@2.87">
        <script>${pipelineScript}</script>
        <sandbox>true</sandbox>
    </definition>
    <triggers/>
    <disabled>false</disabled>
</flow-definition>`;

        await this.makeJenkinsRequest(
            `createItem?name=${jobName}`,
            'POST',
            configXml,
            { 'Content-Type': 'application/xml' }
        );
    }

    async makeJenkinsRequest(endpoint, method = 'GET', data = null, headers = {}, options = {}) {
        const startTime = Date.now();
        this.stats.apiCalls++;

        try {
            if (!this.config.username || !this.config.apiToken) {
                throw new Error('Jenkins credentials not configured');
            }

            const config = {
                method,
                url: `${this.config.jenkinsUrl}/${endpoint}`,
                auth: {
                    username: this.config.username,
                    password: this.config.apiToken
                },
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                timeout: this.config.requestTimeout,
                ...options
            };

            if (data) {
                config.data = data;
            }

            const response = await axios(config);

            this.logger.info('Jenkins API call successful', {
                endpoint,
                method,
                status: response.status,
                duration: Date.now() - startTime
            });

            return response.data !== undefined ? response : { data: response };

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('Jenkins API call failed', {
                endpoint,
                method,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async coordinateWithServices({ event, ...data }) {
        try {
            this.logger.info('Jenkins service coordinating with services', { event, data });

            switch (event) {
                case 'trigger_build':
                    return await this.triggerBuild(
                        data.jobName,
                        data.parameters || {},
                        data.waitForCompletion || false
                    );

                case 'create_job':
                    return await this.createJob(data.jobName, data.jobConfig);

                case 'get_build_status':
                    return await this.getBuildInfo(data.jobName, data.buildNumber);

                case 'create_pipeline':
                    return await this.createPipeline(data.pipelineName, data.stages, data.triggerJobName);

                case 'process_event':
                    // Handle events from Integration Hub
                    if (data.eventType === 'github_pr_created') {
                        return await this.handleGitHubPRBuild(data);
                    } else if (data.eventType === 'deploy_request') {
                        return await this.handleDeploymentPipeline(data);
                    }
                    break;

                default:
                    this.logger.warn('Unknown coordination event', { event });
                    return { success: false, error: `Unknown event: ${event}` };
            }

        } catch (error) {
            this.logger.error('Service coordination failed', { error: error.message, event });
            return { success: false, error: error.message };
        }
    }

    async handleGitHubPRBuild(data) {
        const { prData, jobName = 'pr-validation' } = data;

        return await this.triggerBuild(jobName, {
            GIT_BRANCH: prData.head.ref,
            PR_NUMBER: prData.number.toString(),
            PR_URL: prData.html_url,
            PR_TITLE: prData.title
        });
    }

    async handleDeploymentPipeline(data) {
        const { environment, version, jobName = 'deployment-pipeline' } = data;

        return await this.triggerBuild(jobName, {
            ENVIRONMENT: environment,
            VERSION: version,
            TRIGGER_TIME: new Date().toISOString()
        });
    }

    async initialize() {
        try {
            this.logger.info('Initializing Jenkins Service', {
                port: this.config.port,
                serviceName: this.config.serviceName,
                jenkinsUrl: this.config.jenkinsUrl
            });

            // Initialize database connection
            await this.db.initialize();

            // Test Jenkins connection
            if (this.config.username && this.config.apiToken) {
                await this.testJenkinsConnection();
            } else {
                this.logger.warn('Jenkins credentials not configured - service will run in limited mode');
            }

            this.logger.info('Jenkins Service initialized successfully');

        } catch (error) {
            this.logger.error('Jenkins Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async testJenkinsConnection() {
        try {
            const info = await this.getJenkinsInfo();
            this.authenticated = true;
            this.jenkinsVersion = info.version;

            // Load existing jobs
            const jobs = await this.getJobs();
            jobs.forEach(job => {
                this.jobs.set(job.name, {
                    ...job,
                    cachedAt: new Date()
                });
            });

            this.logger.info('Jenkins connection established', {
                version: this.jenkinsVersion,
                jobs: jobs.length
            });

        } catch (error) {
            this.authenticated = false;
            this.logger.error('Jenkins connection failed', { error: error.message });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('Jenkins Service started', {
                    port: this.config.port,
                    serviceName: this.config.serviceName,
                    pid: process.pid
                });
            });

            // Graceful shutdown handling
            process.on('SIGTERM', () => {
                this.logger.info('Received SIGTERM, shutting down gracefully');
                server.close(() => {
                    process.exit(0);
                });
            });

            process.on('SIGINT', () => {
                this.logger.info('Received SIGINT, shutting down gracefully');
                server.close(() => {
                    process.exit(0);
                });
            });

            return server;

        } catch (error) {
            this.logger.error('Failed to start Jenkins Service', {
                error: error.message
            });
            throw error;
        }
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexJenkinsService();
    service.start().catch(error => {
        console.error('Failed to start Jenkins Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexJenkinsService };