#!/usr/bin/env node
/**
 * LonicFLex ServiceNow Integration Service - Window 2
 * Real ServiceNow API integration for ITSM workflow automation
 *
 * Handles:
 * - ServiceNow Table API integration with OAuth/basic authentication
 * - Incident, change, and request management
 * - Approval workflow integration
 * - SLA and priority handling
 * - Cross-system workflow coordination
 */

const express = require('express');
const axios = require('axios');
const { SQLiteManager } = require('../database/sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
require('dotenv').config();

class LonicFlexServiceNowService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.SERVICENOW_SERVICE_PORT || 3022,
            serviceName: 'lonicflex-servicenow',
            instanceUrl: config.instanceUrl || process.env.SERVICENOW_INSTANCE_URL || 'https://dev123456.service-now.com',
            username: config.username || process.env.SERVICENOW_USERNAME,
            password: config.password || process.env.SERVICENOW_PASSWORD,
            clientId: config.clientId || process.env.SERVICENOW_CLIENT_ID,
            clientSecret: config.clientSecret || process.env.SERVICENOW_CLIENT_SECRET,
            requestTimeout: config.requestTimeout || 30000,
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

        // ServiceNow state management
        this.incidents = new Map();             // incident number -> incident data
        this.changeRequests = new Map();       // change number -> change data
        this.serviceRequests = new Map();      // request number -> request data
        this.approvals = new Map();            // approval sys_id -> approval data
        this.stats = {
            incidentsCreated: 0,
            incidentsUpdated: 0,
            changesCreated: 0,
            changesUpdated: 0,
            requestsCreated: 0,
            requestsUpdated: 0,
            approvalsProcessed: 0,
            apiCalls: 0,
            failedCalls: 0,
            averageResponseTime: 0
        };

        // ServiceNow API client
        this.authenticated = false;
        this.accessToken = null;
        this.tokenExpiry = null;

        // Priority and urgency mappings
        this.priorityMap = {
            'Critical': 1,
            'High': 2,
            'Moderate': 3,
            'Low': 4,
            'Planning': 5
        };

        this.urgencyMap = {
            'Critical': 1,
            'High': 2,
            'Medium': 3,
            'Low': 4
        };

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-servicenow.log'
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
        this.app.get('/health', (req, res) => {
            const uptime = Date.now() - this.startTime.getTime();
            res.json({
                status: 'healthy',
                service: this.config.serviceName,
                uptime,
                initialized: true,
                authenticated: this.authenticated,
                instanceUrl: this.config.instanceUrl,
                stats: this.stats,
                incidentsActive: this.incidents.size,
                changesActive: this.changeRequests.size,
                requestsActive: this.serviceRequests.size
            });
        });

        // Service status endpoint
        this.app.get('/status', (req, res) => {
            res.json({
                service: this.config.serviceName,
                status: 'operational',
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                authenticated: this.authenticated,
                instanceUrl: this.config.instanceUrl,
                incidentsActive: this.incidents.size,
                changesActive: this.changeRequests.size,
                requestsActive: this.serviceRequests.size,
                lastHealthCheck: new Date().toISOString()
            });
        });

        // Create incident
        this.app.post('/incidents/create', async (req, res) => {
            try {
                const incident = await this.createIncident(req.body);
                const evidence = {
                    incidentCreated: !!incident,
                    incidentNumber: !!incident.number,
                    incidentData: !!incident && typeof incident === 'object',
                    apiCallSuccessful: true
                };

                const operationSuccess = evidence.incidentCreated &&
                                       evidence.incidentNumber;

                res.json({
                    success: operationSuccess,
                    incident,
                    message: `Incident ${incident.number} created successfully`,
                    evidence: evidence
                });
            } catch (error) {
                this.logger.error('Incident creation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Update incident
        this.app.put('/incidents/:sysId', async (req, res) => {
            try {
                const { sysId } = req.params;
                const updatedIncident = await this.updateIncident(sysId, req.body);
                res.json({
                    success: true,
                    incident: updatedIncident,
                    message: `Incident updated successfully`
                });
            } catch (error) {
                this.logger.error('Incident update failed', {
                    sysId: req.params.sysId,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Get incident
        this.app.get('/incidents/:sysId', async (req, res) => {
            try {
                const { sysId } = req.params;
                const incident = await this.getIncident(sysId);
                res.json({
                    success: true,
                    incident
                });
            } catch (error) {
                this.logger.error('Incident retrieval failed', {
                    sysId: req.params.sysId,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Create change request
        this.app.post('/changes/create', async (req, res) => {
            try {
                const change = await this.createChangeRequest(req.body);
                res.json({
                    success: true,
                    change,
                    message: `Change request ${change.number} created successfully`
                });
            } catch (error) {
                this.logger.error('Change request creation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Update change request
        this.app.put('/changes/:sysId', async (req, res) => {
            try {
                const { sysId } = req.params;
                const updatedChange = await this.updateChangeRequest(sysId, req.body);
                res.json({
                    success: true,
                    change: updatedChange,
                    message: `Change request updated successfully`
                });
            } catch (error) {
                this.logger.error('Change request update failed', {
                    sysId: req.params.sysId,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Search records
        this.app.post('/search', async (req, res) => {
            try {
                const { table, query, limit = 50 } = req.body;
                const results = await this.searchRecords(table, query, limit);
                res.json({
                    success: true,
                    results,
                    count: results.length
                });
            } catch (error) {
                this.logger.error('Record search failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Create approval
        this.app.post('/approvals/create', async (req, res) => {
            try {
                const approval = await this.createApproval(req.body);
                res.json({
                    success: true,
                    approval,
                    message: `Approval request created successfully`
                });
            } catch (error) {
                this.logger.error('Approval creation failed', { error: error.message });
                res.status(500).json({ error: error.message });
            }
        });

        // Process approval decision
        this.app.post('/approvals/:sysId/decision', async (req, res) => {
            try {
                const { sysId } = req.params;
                const { decision, comments } = req.body;
                const result = await this.processApprovalDecision(sysId, decision, comments);
                res.json({
                    success: true,
                    result,
                    message: `Approval decision processed successfully`
                });
            } catch (error) {
                this.logger.error('Approval decision processing failed', {
                    sysId: req.params.sysId,
                    error: error.message
                });
                res.status(500).json({ error: error.message });
            }
        });

        // Cross-system coordination endpoint
        this.app.post('/coordinate', async (req, res) => {
            try {
                const result = await this.coordinateWithServices(req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Service coordination failed', { error: error.message });
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Service statistics
        this.app.get('/stats', (req, res) => {
            res.json({
                service: this.config.serviceName,
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                authenticated: this.authenticated,
                instanceUrl: this.config.instanceUrl,
                recordsCached: this.incidents.size + this.changeRequests.size + this.serviceRequests.size
            });
        });
    }

    async createIncident(incidentData) {
        const startTime = Date.now();

        try {
            this.logger.info('Creating ServiceNow incident', {
                shortDescription: incidentData.short_description,
                urgency: incidentData.urgency,
                priority: incidentData.priority
            });

            const payload = {
                short_description: incidentData.short_description,
                description: incidentData.description,
                urgency: this.urgencyMap[incidentData.urgency] || incidentData.urgency || 3,
                impact: incidentData.impact || 2,
                category: incidentData.category || 'inquiry',
                subcategory: incidentData.subcategory,
                caller_id: incidentData.caller_id,
                assigned_to: incidentData.assigned_to,
                assignment_group: incidentData.assignment_group,
                location: incidentData.location,
                cmdb_ci: incidentData.cmdb_ci,
                work_notes: incidentData.work_notes
            };

            // Remove undefined values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            const response = await this.makeServiceNowRequest('POST', '/api/now/table/incident', payload);

            const incident = {
                sys_id: response.result.sys_id,
                number: response.result.number,
                short_description: response.result.short_description,
                description: response.result.description,
                state: response.result.state,
                urgency: response.result.urgency,
                priority: response.result.priority,
                category: response.result.category,
                caller_id: response.result.caller_id,
                assigned_to: response.result.assigned_to,
                assignment_group: response.result.assignment_group,
                created_on: response.result.sys_created_on,
                updated_on: response.result.sys_updated_on,
                url: `${this.config.instanceUrl}/nav_to.do?uri=incident.do?sys_id=${response.result.sys_id}`
            };

            // Cache the incident
            this.incidents.set(incident.number, incident);
            this.stats.incidentsCreated++;

            this.logger.info('ServiceNow incident created successfully', {
                incidentNumber: incident.number,
                sysId: incident.sys_id,
                duration: Date.now() - startTime
            });

            return incident;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow incident creation failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async updateIncident(sysId, updateData) {
        const startTime = Date.now();

        try {
            this.logger.info('Updating ServiceNow incident', { sysId });

            const payload = {};

            // Map common update fields
            if (updateData.short_description) {
                payload.short_description = updateData.short_description;
            }
            if (updateData.description) {
                payload.description = updateData.description;
            }
            if (updateData.state !== undefined) {
                payload.state = updateData.state;
            }
            if (updateData.urgency) {
                payload.urgency = this.urgencyMap[updateData.urgency] || updateData.urgency;
            }
            if (updateData.priority) {
                payload.priority = this.priorityMap[updateData.priority] || updateData.priority;
            }
            if (updateData.work_notes) {
                payload.work_notes = updateData.work_notes;
            }
            if (updateData.assigned_to) {
                payload.assigned_to = updateData.assigned_to;
            }
            if (updateData.assignment_group) {
                payload.assignment_group = updateData.assignment_group;
            }
            if (updateData.resolution_code) {
                payload.close_code = updateData.resolution_code;
            }
            if (updateData.resolution_notes) {
                payload.close_notes = updateData.resolution_notes;
            }

            const response = await this.makeServiceNowRequest('PUT', `/api/now/table/incident/${sysId}`, payload);

            this.stats.incidentsUpdated++;

            this.logger.info('ServiceNow incident updated successfully', {
                sysId,
                incidentNumber: response.result.number,
                duration: Date.now() - startTime
            });

            // Update cache
            const cachedIncident = Array.from(this.incidents.values()).find(inc => inc.sys_id === sysId);
            if (cachedIncident) {
                Object.assign(cachedIncident, {
                    short_description: response.result.short_description,
                    description: response.result.description,
                    state: response.result.state,
                    updated_on: response.result.sys_updated_on
                });
            }

            return response.result;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow incident update failed', {
                sysId,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async getIncident(sysId) {
        const startTime = Date.now();

        try {
            this.logger.info('Fetching ServiceNow incident', { sysId });

            const response = await this.makeServiceNowRequest('GET', `/api/now/table/incident/${sysId}`);

            const incident = {
                sys_id: response.result.sys_id,
                number: response.result.number,
                short_description: response.result.short_description,
                description: response.result.description,
                state: response.result.state,
                urgency: response.result.urgency,
                priority: response.result.priority,
                category: response.result.category,
                caller_id: response.result.caller_id,
                assigned_to: response.result.assigned_to,
                assignment_group: response.result.assignment_group,
                created_on: response.result.sys_created_on,
                updated_on: response.result.sys_updated_on,
                url: `${this.config.instanceUrl}/nav_to.do?uri=incident.do?sys_id=${response.result.sys_id}`
            };

            this.logger.info('ServiceNow incident fetched successfully', {
                incidentNumber: incident.number,
                duration: Date.now() - startTime
            });

            return incident;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow incident fetch failed', {
                sysId,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async createChangeRequest(changeData) {
        const startTime = Date.now();

        try {
            this.logger.info('Creating ServiceNow change request', {
                shortDescription: changeData.short_description,
                type: changeData.type,
                risk: changeData.risk
            });

            const payload = {
                short_description: changeData.short_description,
                description: changeData.description,
                type: changeData.type || 'standard',
                risk: changeData.risk || 'moderate',
                impact: changeData.impact || 2,
                priority: this.priorityMap[changeData.priority] || changeData.priority || 3,
                category: changeData.category || 'other',
                requested_by: changeData.requested_by,
                assigned_to: changeData.assigned_to,
                assignment_group: changeData.assignment_group,
                planned_start_date: changeData.planned_start_date,
                planned_end_date: changeData.planned_end_date,
                work_start: changeData.work_start,
                work_end: changeData.work_end,
                implementation_plan: changeData.implementation_plan,
                test_plan: changeData.test_plan,
                backout_plan: changeData.backout_plan,
                cmdb_ci: changeData.cmdb_ci
            };

            // Remove undefined values
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                }
            });

            const response = await this.makeServiceNowRequest('POST', '/api/now/table/change_request', payload);

            const change = {
                sys_id: response.result.sys_id,
                number: response.result.number,
                short_description: response.result.short_description,
                description: response.result.description,
                state: response.result.state,
                type: response.result.type,
                risk: response.result.risk,
                priority: response.result.priority,
                category: response.result.category,
                assigned_to: response.result.assigned_to,
                assignment_group: response.result.assignment_group,
                created_on: response.result.sys_created_on,
                updated_on: response.result.sys_updated_on,
                url: `${this.config.instanceUrl}/nav_to.do?uri=change_request.do?sys_id=${response.result.sys_id}`
            };

            // Cache the change request
            this.changeRequests.set(change.number, change);
            this.stats.changesCreated++;

            this.logger.info('ServiceNow change request created successfully', {
                changeNumber: change.number,
                sysId: change.sys_id,
                duration: Date.now() - startTime
            });

            return change;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow change request creation failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async updateChangeRequest(sysId, updateData) {
        const startTime = Date.now();

        try {
            this.logger.info('Updating ServiceNow change request', { sysId });

            const payload = {};

            // Map common update fields
            if (updateData.short_description) {
                payload.short_description = updateData.short_description;
            }
            if (updateData.description) {
                payload.description = updateData.description;
            }
            if (updateData.state !== undefined) {
                payload.state = updateData.state;
            }
            if (updateData.risk) {
                payload.risk = updateData.risk;
            }
            if (updateData.priority) {
                payload.priority = this.priorityMap[updateData.priority] || updateData.priority;
            }
            if (updateData.work_notes) {
                payload.work_notes = updateData.work_notes;
            }
            if (updateData.assigned_to) {
                payload.assigned_to = updateData.assigned_to;
            }
            if (updateData.assignment_group) {
                payload.assignment_group = updateData.assignment_group;
            }

            const response = await this.makeServiceNowRequest('PUT', `/api/now/table/change_request/${sysId}`, payload);

            this.stats.changesUpdated++;

            this.logger.info('ServiceNow change request updated successfully', {
                sysId,
                changeNumber: response.result.number,
                duration: Date.now() - startTime
            });

            return response.result;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow change request update failed', {
                sysId,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async searchRecords(table, query, limit = 50) {
        const startTime = Date.now();

        try {
            this.logger.info('Searching ServiceNow records', { table, query, limit });

            const response = await this.makeServiceNowRequest('GET', `/api/now/table/${table}?sysparm_query=${encodeURIComponent(query)}&sysparm_limit=${limit}`);

            this.logger.info('ServiceNow record search completed', {
                table,
                count: response.result.length,
                duration: Date.now() - startTime
            });

            return response.result;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow record search failed', {
                table,
                query,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async createApproval(approvalData) {
        const startTime = Date.now();

        try {
            this.logger.info('Creating ServiceNow approval', {
                table: approvalData.source_table,
                sourceId: approvalData.source_id,
                approver: approvalData.approver
            });

            const payload = {
                source_table: approvalData.source_table,
                source_id: approvalData.source_id,
                approver: approvalData.approver,
                comments: approvalData.comments,
                due_date: approvalData.due_date
            };

            const response = await this.makeServiceNowRequest('POST', '/api/now/table/sysapproval_approver', payload);

            const approval = {
                sys_id: response.result.sys_id,
                source_table: response.result.source_table,
                source_id: response.result.source_id,
                approver: response.result.approver,
                state: response.result.state,
                comments: response.result.comments,
                due_date: response.result.due_date,
                created_on: response.result.sys_created_on
            };

            // Cache the approval
            this.approvals.set(approval.sys_id, approval);
            this.stats.approvalsProcessed++;

            this.logger.info('ServiceNow approval created successfully', {
                approvalId: approval.sys_id,
                duration: Date.now() - startTime
            });

            return approval;

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow approval creation failed', {
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async processApprovalDecision(sysId, decision, comments) {
        const startTime = Date.now();

        try {
            this.logger.info('Processing ServiceNow approval decision', {
                sysId,
                decision
            });

            const payload = {
                state: decision.toLowerCase() === 'approve' ? 'approved' : 'rejected',
                comments: comments
            };

            const response = await this.makeServiceNowRequest('PUT', `/api/now/table/sysapproval_approver/${sysId}`, payload);

            this.logger.info('ServiceNow approval decision processed successfully', {
                sysId,
                decision,
                duration: Date.now() - startTime
            });

            return {
                sys_id: sysId,
                decision,
                state: response.result.state,
                comments
            };

        } catch (error) {
            this.stats.failedCalls++;
            this.logger.error('ServiceNow approval decision processing failed', {
                sysId,
                decision,
                error: error.message,
                duration: Date.now() - startTime
            });
            throw error;
        }
    }

    async makeServiceNowRequest(method, endpoint, data = null) {
        const startTime = Date.now();

        if (!this.authenticated) {
            throw new Error('ServiceNow service not authenticated');
        }

        this.stats.apiCalls++;

        try {
            const config = {
                method,
                url: `${this.config.instanceUrl}${endpoint}`,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: this.config.requestTimeout
            };

            // Add authentication
            if (this.config.username && this.config.password) {
                config.auth = {
                    username: this.config.username,
                    password: this.config.password
                };
            } else if (this.accessToken) {
                config.headers['Authorization'] = `Bearer ${this.accessToken}`;
            }

            if (data && (method === 'POST' || method === 'PUT')) {
                config.data = data;
            }

            const response = await axios(config);

            this.logger.debug('ServiceNow API call successful', {
                method,
                endpoint,
                status: response.status,
                duration: Date.now() - startTime
            });

            return response.data;

        } catch (error) {
            this.stats.failedCalls++;

            this.logger.error('ServiceNow API call failed', {
                method,
                endpoint,
                error: error.message,
                status: error.response?.status,
                duration: Date.now() - startTime
            });

            throw new Error(`ServiceNow API error: ${error.message}`);
        }
    }

    async coordinateWithServices({ event, ...data }) {
        this.logger.info('Coordinating with other services', { event, data });

        try {
            switch (event) {
                case 'jira_issue_created':
                    return await this.handleJiraIssueCreated(data);

                case 'github_pr_created':
                    return await this.handleGitHubPRCreated(data);

                case 'production_incident':
                    return await this.handleProductionIncident(data);

                case 'workflow_step':
                    return await this.handleWorkflowStep(data);

                default:
                    this.logger.warn('Unknown coordination event', { event });
                    return { success: false, error: `Unknown event: ${event}` };
            }

        } catch (error) {
            this.logger.error('Service coordination failed', {
                event,
                error: error.message
            });
            return { success: false, error: error.message };
        }
    }

    async handleJiraIssueCreated(data) {
        try {
            const incident = await this.createIncident({
                short_description: `Jira Issue: ${data.summary}`,
                description: `Jira Issue: ${data.key}\n\nDescription: ${data.description}`,
                urgency: 'Medium',
                impact: 2,
                category: 'software',
                subcategory: 'application'
            });

            return {
                success: true,
                action: 'incident_created',
                incident,
                message: `ServiceNow incident ${incident.number} created for Jira issue`
            };

        } catch (error) {
            throw new Error(`Failed to create ServiceNow incident for Jira issue: ${error.message}`);
        }
    }

    async handleGitHubPRCreated(data) {
        try {
            const change = await this.createChangeRequest({
                short_description: `Deployment: ${data.title}`,
                description: `GitHub Pull Request: ${data.url}\n\nDescription: ${data.description}`,
                type: 'normal',
                risk: 'low',
                priority: 'Medium',
                category: 'software',
                implementation_plan: `Deploy changes from PR: ${data.url}`
            });

            return {
                success: true,
                action: 'change_created',
                change,
                message: `ServiceNow change request ${change.number} created for GitHub PR`
            };

        } catch (error) {
            throw new Error(`Failed to create ServiceNow change request for GitHub PR: ${error.message}`);
        }
    }

    async handleProductionIncident(data) {
        try {
            const incident = await this.createIncident({
                short_description: `Production Issue: ${data.title}`,
                description: data.description,
                urgency: data.severity === 'critical' ? 'High' : 'Medium',
                impact: data.severity === 'critical' ? 1 : 2,
                category: 'software',
                subcategory: 'application'
            });

            return {
                success: true,
                action: 'incident_created',
                incident,
                message: `ServiceNow incident ${incident.number} created for production issue`
            };

        } catch (error) {
            throw new Error(`Failed to create ServiceNow incident for production issue: ${error.message}`);
        }
    }

    async handleWorkflowStep(data) {
        try {
            if (data.step === 'create_incident') {
                return await this.createIncident(data.incidentData);
            } else if (data.step === 'update_incident') {
                return await this.updateIncident(data.sysId, data.updateData);
            } else if (data.step === 'create_change') {
                return await this.createChangeRequest(data.changeData);
            } else if (data.step === 'create_approval') {
                return await this.createApproval(data.approvalData);
            } else {
                throw new Error(`Unknown workflow step: ${data.step}`);
            }

        } catch (error) {
            throw new Error(`Workflow step execution failed: ${error.message}`);
        }
    }

    async testConnection() {
        try {
            this.logger.info('Testing ServiceNow connection');

            // Check if demo mode is enabled
            if (process.env.SERVICENOW_DEMO_MODE === 'true' || this.config.demoMode) {
                this.logger.info('ServiceNow service running in demo mode - skipping real authentication');
                this.authenticated = true;
                return true;
            }

            if (!this.config.username || !this.config.password) {
                throw new Error('ServiceNow username or password not configured');
            }

            // Test connection by making a direct API call (bypass authenticated check)
            const testResponse = await axios({
                method: 'GET',
                url: `${this.config.instanceUrl}/api/now/table/sys_user?sysparm_limit=1`,
                auth: {
                    username: this.config.username,
                    password: this.config.password
                },
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                timeout: this.config.requestTimeout
            });

            this.authenticated = true;

            this.logger.info('ServiceNow connection test successful', {
                instanceUrl: this.config.instanceUrl,
                username: this.config.username
            });

            return true;

        } catch (error) {
            this.authenticated = false;
            this.logger.error('ServiceNow connection test failed', { error: error.message });
            throw error;
        }
    }

    async initialize() {
        try {
            this.logger.info('Initializing ServiceNow Service', {
                port: this.config.port,
                serviceName: this.config.serviceName,
                instanceUrl: this.config.instanceUrl
            });

            // Initialize database connection
            await this.db.initialize();

            // Test ServiceNow connection
            await this.testConnection();

            this.logger.info('ServiceNow Service initialized successfully');

        } catch (error) {
            this.logger.error('ServiceNow Service initialization failed', {
                error: error.message
            });
            throw error;
        }
    }

    async start() {
        try {
            await this.initialize();

            const server = this.app.listen(this.config.port, () => {
                this.logger.info('ServiceNow Service started', {
                    port: this.config.port,
                    serviceName: this.config.serviceName,
                    pid: process.pid,
                    instanceUrl: this.config.instanceUrl
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
            this.logger.error('Failed to start ServiceNow Service', {
                error: error.message
            });
            throw error;
        }
    }
}

// Start service if called directly
if (require.main === module) {
    const service = new LonicFlexServiceNowService();
    service.start().catch(error => {
        console.error('Failed to start ServiceNow Service:', error.message);
        process.exit(1);
    });
}

module.exports = { LonicFlexServiceNowService };