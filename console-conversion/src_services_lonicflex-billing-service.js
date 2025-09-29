#!/usr/bin/env node
/**
 * LonicFLex Billing Service - Window 3 Enterprise Usage Analytics & Billing
 * Comprehensive billing processing, invoice generation, and usage analytics
 *
 * Handles:
 * - Usage analytics and reporting across teams/projects
 * - Invoice generation with detailed cost breakdowns
 * - Billing cycle management and automated processing
 * - Payment tracking and revenue analytics
 * - Usage trend analysis and forecasting
 * - Cost center allocation and chargeback processing
 * - Integration with cost management service for real-time data
 */

const express = require('express');
const { GovernanceSchemaManager } = require('../database/governance-schema-manager');
const { AuditManager } = require('../components/audit-manager');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const winston = require('winston');
const crypto = require('crypto');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

class LonicFlexBillingService {
    constructor(config = {}) {
        this.config = {
            port: config.port || process.env.BILLING_SERVICE_PORT || 3033,
            serviceName: 'lonicflex-billing',
            costManagementServiceUrl: config.costManagementServiceUrl || 'http://localhost:3032',
            billingCycleDay: config.billingCycleDay || 1, // 1st of month
            invoiceRetentionDays: config.invoiceRetentionDays || 2555, // 7 years
            paymentGracePeriodDays: config.paymentGracePeriodDays || 30,
            defaultCurrency: config.defaultCurrency || 'USD',
            enableAutomatedBilling: config.enableAutomatedBilling !== false,
            enableUsageAnalytics: config.enableUsageAnalytics !== false,
            generatePDFInvoices: config.generatePDFInvoices !== false,
            enableChargebacks: config.enableChargebacks !== false,
            ...config
        };

        // Initialize Express app
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();

        // Initialize core components
        this.db = new GovernanceSchemaManager();
        this.auditManager = new AuditManager();
        this.contextManager = new Factor3ContextManager();

        // Billing cycle management
        this.billingCycles = new Map();          // cycleId -> billing cycle data
        this.activeBillingPeriods = new Map();   // periodId -> period data
        this.invoiceQueue = new Map();           // invoiceId -> processing status
        this.paymentTracking = new Map();        // invoiceId -> payment status

        // Usage analytics engine
        this.usageAggregators = new Map();       // aggregatorId -> usage data
        this.analyticsCache = new Map();         // cacheKey -> analytics results
        this.trendAnalysis = new Map();          // entityId -> trend data
        this.forecastingModels = new Map();      // modelId -> forecast data

        // Cost center and chargeback management
        this.costCenters = new Map();            // costCenterId -> allocation rules
        this.chargebackRules = new Map();        // ruleId -> chargeback configuration
        this.allocationMethods = new Map();      // methodId -> allocation algorithm

        // Invoice and payment processing
        this.invoiceTemplates = new Map();       // templateId -> template config
        this.paymentMethods = new Map();         // methodId -> payment config
        this.revenueTracking = new Map();        // period -> revenue data

        // Statistics and metrics
        this.stats = {
            totalBilledAmount: 0,
            totalInvoicesGenerated: 0,
            totalPaymentsReceived: 0,
            averageInvoiceAmount: 0,
            outstandingBalance: 0,
            currentMonthRevenue: 0,
            usageAnalyticsGenerated: 0,
            chargebacksProcessed: 0,
            forecastAccuracy: 0,
            billingCyclesCompleted: 0
        };

        // Pricing and tax configuration
        this.pricingTiers = new Map();
        this.taxConfiguration = new Map();
        this.discountRules = new Map();

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.label({ label: 'BillingService' })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/lonicflex-billing.log'
                }),
                new winston.transports.File({
                    filename: './logs/lonicflex-usage-analytics.log',
                    level: 'info'
                })
            ]
        });

        this.startTime = new Date();
        this.isInitialized = false;
    }

    /**
     * Setup Express middleware
     */
    setupMiddleware() {
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // CORS headers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });

        // Request tracking and billing attribution
        this.app.use(async (req, res, next) => {
            req.requestId = crypto.randomUUID();
            req.startTime = Date.now();

            // Extract billing attribution context
            req.billingContext = {
                userId: req.headers['x-user-id'] || null,
                teamId: req.headers['x-team-id'] || null,
                projectId: req.headers['x-project-id'] || null,
                costCenterId: req.headers['x-cost-center-id'] || null,
                billingEntityId: req.headers['x-billing-entity-id'] || null
            };

            next();
        });

        // Error handling
        this.app.use((error, req, res, next) => {
            this.logger.error('Billing service error:', {
                error: error.message,
                stack: error.stack,
                requestId: req.requestId
            });

            res.status(500).json({
                success: false,
                error: 'Billing service error',
                requestId: req.requestId
            });
        });
    }

    /**
     * Setup Express routes
     */
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            res.status(health.healthy ? 200 : 503).json(health);
        });

        // Service status and statistics
        this.app.get('/status', (req, res) => {
            res.json({
                service: this.config.serviceName,
                status: 'operational',
                uptime: Date.now() - this.startTime.getTime(),
                stats: this.stats,
                activeBillingPeriods: this.activeBillingPeriods.size,
                pendingInvoices: this.invoiceQueue.size,
                lastUpdate: new Date().toISOString()
            });
        });

        // Usage Analytics Endpoints
        this.app.get('/analytics/usage/:entityType/:entityId', async (req, res) => {
            try {
                const { entityType, entityId } = req.params;
                const { timeRange, granularity, metrics } = req.query;

                const analytics = await this.getUsageAnalytics(
                    entityType,
                    entityId,
                    { timeRange, granularity, metrics: metrics?.split(',') }
                );
                res.json(analytics);
            } catch (error) {
                this.logger.error('Usage analytics request failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Billing Cycle Management
        this.app.post('/billing/cycle/start', async (req, res) => {
            try {
                const cycle = await this.startBillingCycle(req.body);
                res.json(cycle);
            } catch (error) {
                this.logger.error('Billing cycle start failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/billing/cycle/:cycleId/process', async (req, res) => {
            try {
                const { cycleId } = req.params;
                const result = await this.processBillingCycle(cycleId, req.body);
                res.json(result);
            } catch (error) {
                this.logger.error('Billing cycle processing failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Invoice Management
        this.app.post('/invoices/generate', async (req, res) => {
            try {
                const invoice = await this.generateInvoice(req.body, req.billingContext);
                res.json(invoice);
            } catch (error) {
                this.logger.error('Invoice generation failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/invoices/:invoiceId', async (req, res) => {
            try {
                const { invoiceId } = req.params;
                const invoice = await this.getInvoice(invoiceId);
                res.json(invoice);
            } catch (error) {
                this.logger.error('Invoice retrieval failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/invoices/:invoiceId/payment', async (req, res) => {
            try {
                const { invoiceId } = req.params;
                const payment = await this.processPayment(invoiceId, req.body);
                res.json(payment);
            } catch (error) {
                this.logger.error('Payment processing failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Cost Center and Chargeback Management
        this.app.post('/cost-centers/:costCenterId/allocate', async (req, res) => {
            try {
                const { costCenterId } = req.params;
                const allocation = await this.allocateCosts(costCenterId, req.body);
                res.json(allocation);
            } catch (error) {
                this.logger.error('Cost allocation failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.post('/chargebacks/process', async (req, res) => {
            try {
                const chargeback = await this.processChargeback(req.body);
                res.json(chargeback);
            } catch (error) {
                this.logger.error('Chargeback processing failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        // Reporting and Analytics
        this.app.get('/reports/revenue/:period', async (req, res) => {
            try {
                const { period } = req.params;
                const report = await this.generateRevenueReport(period, req.query);
                res.json(report);
            } catch (error) {
                this.logger.error('Revenue report generation failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });

        this.app.get('/forecasts/:entityType/:entityId', async (req, res) => {
            try {
                const { entityType, entityId } = req.params;
                const forecast = await this.generateUsageForecast(entityType, entityId, req.query);
                res.json(forecast);
            } catch (error) {
                this.logger.error('Usage forecast generation failed:', error);
                res.status(500).json({ success: false, error: error.message });
            }
        });
    }

    /**
     * Initialize billing service
     */
    async initialize() {
        try {
            this.logger.info('Initializing LonicFLex Billing Service...');

            // Initialize database
            await this.db.initializeGovernanceSchema();

            // Initialize billing tables if needed
            await this.initializeBillingTables();

            // Load configuration
            await this.loadBillingConfiguration();

            // Initialize cost management service connection
            await this.initializeCostManagementIntegration();

            // Start billing cycle monitor
            this.startBillingCycleMonitor();

            // Start usage analytics processing
            this.startUsageAnalyticsProcessing();

            this.isInitialized = true;
            this.logger.info('Billing service initialized successfully', {
                port: this.config.port,
                billingCycleDay: this.config.billingCycleDay,
                automatedBilling: this.config.enableAutomatedBilling
            });

        } catch (error) {
            this.logger.error('Billing service initialization failed:', { error: error.message });
            throw error;
        }
    }

    /**
     * Get usage analytics for entity
     */
    async getUsageAnalytics(entityType, entityId, options = {}) {
        const {
            timeRange = '30d',
            granularity = 'daily',
            metrics = ['usage', 'cost', 'requests']
        } = options;

        const cacheKey = `analytics:${entityType}:${entityId}:${timeRange}:${granularity}:${metrics.join(',')}`;

        // Check cache first
        if (this.analyticsCache.has(cacheKey)) {
            const cached = this.analyticsCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) { // 5 minute cache
                return cached.data;
            }
        }

        try {
            // Fetch cost data from cost management service
            const costData = await this.fetchCostData(entityType, entityId, timeRange);

            // Process analytics
            const analytics = await this.processUsageAnalytics(costData, {
                granularity,
                metrics,
                entityType,
                entityId
            });

            // Cache results
            this.analyticsCache.set(cacheKey, {
                data: analytics,
                timestamp: Date.now()
            });

            this.stats.usageAnalyticsGenerated++;

            return analytics;

        } catch (error) {
            this.logger.error('Usage analytics processing failed:', {
                entityType,
                entityId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Generate invoice for billing entity
     */
    async generateInvoice(invoiceData, billingContext) {
        const invoiceId = crypto.randomUUID();

        try {
            // Fetch usage data for billing period
            const usageData = await this.fetchUsageDataForPeriod(
                invoiceData.billingPeriod,
                billingContext
            );

            // Calculate costs and apply pricing rules
            const costCalculation = await this.calculateInvoiceAmount(usageData, invoiceData);

            // Generate invoice record
            const invoice = {
                invoiceId,
                billingEntityId: billingContext.billingEntityId || billingContext.teamId,
                billingPeriod: invoiceData.billingPeriod,
                generatedAt: new Date().toISOString(),
                dueDate: this.calculateDueDate(invoiceData.billingPeriod),
                lineItems: costCalculation.lineItems,
                subtotal: costCalculation.subtotal,
                taxes: costCalculation.taxes,
                discounts: costCalculation.discounts,
                totalAmount: costCalculation.totalAmount,
                currency: invoiceData.currency || this.config.defaultCurrency,
                status: 'generated',
                paymentStatus: 'pending',
                usageData: usageData
            };

            // Store in database
            await this.storeInvoice(invoice);

            // Add to processing queue
            this.invoiceQueue.set(invoiceId, {
                invoice,
                status: 'generated',
                createdAt: Date.now()
            });

            // Update statistics
            this.stats.totalInvoicesGenerated++;
            this.stats.totalBilledAmount += invoice.totalAmount;

            // Log invoice generation
            await this.auditManager.logEvent('invoice_generated', {
                invoiceId,
                billingEntityId: invoice.billingEntityId,
                amount: invoice.totalAmount,
                billingPeriod: invoice.billingPeriod
            });

            this.logger.info('Invoice generated successfully', {
                invoiceId,
                amount: invoice.totalAmount,
                billingEntityId: invoice.billingEntityId
            });

            return invoice;

        } catch (error) {
            this.logger.error('Invoice generation failed:', {
                invoiceId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Start billing cycle processing
     */
    async startBillingCycle(cycleData) {
        const cycleId = crypto.randomUUID();

        try {
            const cycle = {
                cycleId,
                startDate: cycleData.startDate || new Date().toISOString(),
                endDate: cycleData.endDate,
                billingEntities: cycleData.billingEntities || [],
                status: 'started',
                createdAt: new Date().toISOString(),
                processedInvoices: 0,
                totalAmount: 0
            };

            this.billingCycles.set(cycleId, cycle);

            // Process billing for each entity
            if (this.config.enableAutomatedBilling) {
                await this.processBillingCycle(cycleId, { automated: true });
            }

            this.logger.info('Billing cycle started', {
                cycleId,
                entitiesCount: cycle.billingEntities.length
            });

            return cycle;

        } catch (error) {
            this.logger.error('Billing cycle start failed:', {
                cycleId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Process billing cycle
     */
    async processBillingCycle(cycleId, options = {}) {
        const cycle = this.billingCycles.get(cycleId);
        if (!cycle) {
            throw new Error(`Billing cycle ${cycleId} not found`);
        }

        try {
            cycle.status = 'processing';
            const results = [];

            for (const entityId of cycle.billingEntities) {
                try {
                    const invoice = await this.generateInvoice({
                        billingPeriod: {
                            start: cycle.startDate,
                            end: cycle.endDate
                        }
                    }, { billingEntityId: entityId });

                    results.push({
                        entityId,
                        invoiceId: invoice.invoiceId,
                        amount: invoice.totalAmount,
                        status: 'success'
                    });

                    cycle.processedInvoices++;
                    cycle.totalAmount += invoice.totalAmount;

                } catch (error) {
                    results.push({
                        entityId,
                        status: 'error',
                        error: error.message
                    });
                }
            }

            cycle.status = 'completed';
            cycle.completedAt = new Date().toISOString();
            cycle.results = results;

            this.stats.billingCyclesCompleted++;

            this.logger.info('Billing cycle completed', {
                cycleId,
                processedInvoices: cycle.processedInvoices,
                totalAmount: cycle.totalAmount
            });

            return cycle;

        } catch (error) {
            cycle.status = 'failed';
            cycle.error = error.message;

            this.logger.error('Billing cycle processing failed:', {
                cycleId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get health status
     */
    getHealthStatus() {
        const memoryUsage = process.memoryUsage();
        const uptime = Date.now() - this.startTime.getTime();

        return {
            healthy: this.isInitialized,
            service: this.config.serviceName,
            uptime: uptime,
            memory: {
                used: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                total: Math.round(memoryUsage.heapTotal / 1024 / 1024)
            },
            stats: this.stats,
            billingCycles: this.billingCycles.size,
            pendingInvoices: this.invoiceQueue.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Fetch cost data from cost management service
     */
    async fetchCostData(entityType, entityId, timeRange) {
        try {
            const response = await axios.get(
                `${this.config.costManagementServiceUrl}/costs/${entityType}/${entityId}`,
                {
                    params: { timeRange },
                    timeout: 10000
                }
            );
            return response.data;
        } catch (error) {
            this.logger.error('Cost data fetch failed:', {
                entityType,
                entityId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Process usage analytics
     */
    async processUsageAnalytics(costData, options) {
        const { granularity, metrics, entityType, entityId } = options;

        const analytics = {
            entityType,
            entityId,
            granularity,
            metrics: {},
            timeRange: costData.timeRange,
            generatedAt: new Date().toISOString()
        };

        // Process each requested metric
        for (const metric of metrics) {
            switch (metric) {
                case 'usage':
                    analytics.metrics.usage = this.analyzeUsage(costData);
                    break;
                case 'cost':
                    analytics.metrics.cost = this.analyzeCost(costData);
                    break;
                case 'requests':
                    analytics.metrics.requests = this.analyzeRequests(costData);
                    break;
                case 'trends':
                    analytics.metrics.trends = await this.analyzeTrends(costData, entityId);
                    break;
            }
        }

        return analytics;
    }

    /**
     * Initialize billing cycle monitor
     */
    startBillingCycleMonitor() {
        // Check for billing cycles every hour
        setInterval(async () => {
            try {
                await this.checkBillingCycles();
            } catch (error) {
                this.logger.error('Billing cycle monitor error:', error);
            }
        }, 3600000); // 1 hour
    }

    /**
     * Start usage analytics processing
     */
    startUsageAnalyticsProcessing() {
        // Process analytics updates every 10 minutes
        setInterval(async () => {
            try {
                await this.updateUsageAnalytics();
            } catch (error) {
                this.logger.error('Usage analytics processing error:', error);
            }
        }, 600000); // 10 minutes
    }

    /**
     * Start the service
     */
    async start() {
        await this.initialize();

        return new Promise((resolve) => {
            const server = this.app.listen(this.config.port, () => {
                this.logger.info(`LonicFLex Billing Service started on port ${this.config.port}`);
                resolve(server);
            });
        });
    }

    // Additional helper methods would be implemented here...
    async initializeBillingTables() { /* Implementation */ }
    async loadBillingConfiguration() { /* Implementation */ }
    async initializeCostManagementIntegration() { /* Implementation */ }
    async fetchUsageDataForPeriod(period, context) { /* Implementation */ }
    async calculateInvoiceAmount(usageData, invoiceData) { /* Implementation */ }
    calculateDueDate(billingPeriod) { /* Implementation */ }
    async storeInvoice(invoice) { /* Implementation */ }
    async getInvoice(invoiceId) { /* Implementation */ }
    async processPayment(invoiceId, paymentData) { /* Implementation */ }
    async allocateCosts(costCenterId, allocationData) { /* Implementation */ }
    async processChargeback(chargebackData) { /* Implementation */ }
    async generateRevenueReport(period, options) { /* Implementation */ }
    async generateUsageForecast(entityType, entityId, options) { /* Implementation */ }
    analyzeUsage(costData) { /* Implementation */ }
    analyzeCost(costData) { /* Implementation */ }
    analyzeRequests(costData) { /* Implementation */ }
    async analyzeTrends(costData, entityId) { /* Implementation */ }
    async checkBillingCycles() { /* Implementation */ }
    async updateUsageAnalytics() { /* Implementation */ }
}

// Export service class
module.exports = { LonicFlexBillingService };

// If this file is run directly, start the service
if (require.main === module) {
    const service = new LonicFlexBillingService();
    service.start().catch(error => {
        console.error('Failed to start billing service:', error);
        process.exit(1);
    });
}