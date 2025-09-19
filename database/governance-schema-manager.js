/**
 * LonicFLex Governance Database Schema Manager - Window 3
 * Comprehensive governance, compliance, and analytics database schema
 *
 * Handles:
 * - Governance and RBAC table management
 * - Cost tracking and budgeting schema
 * - Analytics and reporting tables
 * - Audit trail and compliance schema
 * - Database migrations and upgrades
 */

const { SQLiteManager } = require('./sqlite-manager');
const { Factor3ContextManager } = require('../factor3-context-manager');
const winston = require('winston');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class GovernanceSchemaManager extends SQLiteManager {
    constructor(dbPath = null) {
        super(dbPath);

        this.contextManager = new Factor3ContextManager();
        this.schemaVersion = '3.0.0'; // Window 3 schema version
        this.migrationHistory = [];

        // Initialize logger
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.label({ label: 'GovernanceSchema' })
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({
                    filename: './logs/governance-schema.log'
                })
            ]
        });
    }

    /**
     * Initialize governance database schema
     */
    async initializeGovernanceSchema() {
        try {
            this.logger.info('Initializing Window 3 Governance Database Schema...');

            // Initialize base database connection first
            await super.initialize();

            // Create governance tables
            await this.createGovernanceTables();
            await this.createCostManagementTables();
            await this.createAnalyticsTables();
            await this.createComplianceTables();
            await this.createAuditTables();

            // Create indexes for performance
            await this.createGovernanceIndexes();

            // Insert initial data
            await this.insertInitialData();

            // Update schema version
            await this.updateSchemaVersion();

            this.logger.info('Governance database schema initialized successfully', {
                schemaVersion: this.schemaVersion,
                tablesCreated: await this.getTableCount(),
                indexesCreated: await this.getIndexCount()
            });

            return {
                success: true,
                schemaVersion: this.schemaVersion,
                tablesCreated: await this.getTableCount(),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            this.logger.error('Governance schema initialization failed:', { error: error.message });
            throw error;
        }
    }

    /**
     * Create core governance tables
     */
    async createGovernanceTables() {
        const tables = [
            // Users and teams management
            `CREATE TABLE IF NOT EXISTS governance_users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                department TEXT,
                manager_id TEXT,
                status TEXT DEFAULT 'active',
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (manager_id) REFERENCES governance_users (id)
            )`,

            `CREATE TABLE IF NOT EXISTS teams (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                department TEXT,
                manager_id TEXT,
                budget_limit DECIMAL(12,2) DEFAULT 0.00,
                cost_center TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (manager_id) REFERENCES governance_users (id)
            )`,

            // Enhanced user teams with governance
            `CREATE TABLE IF NOT EXISTS user_teams (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                role TEXT NOT NULL,
                permissions TEXT,  -- JSON array of permissions
                start_date DATE DEFAULT CURRENT_DATE,
                end_date DATE,
                approval_status TEXT DEFAULT 'approved',
                approved_by TEXT,
                approved_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES governance_users (id),
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (approved_by) REFERENCES governance_users (id),
                UNIQUE(user_id, team_id, role)
            )`,

            // Project and budget management
            `CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                owner_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                status TEXT DEFAULT 'planning',
                priority TEXT DEFAULT 'medium',
                start_date DATE,
                end_date DATE,
                estimated_cost DECIMAL(12,2) DEFAULT 0.00,
                actual_cost DECIMAL(12,2) DEFAULT 0.00,
                budget_approved BOOLEAN DEFAULT FALSE,
                approved_by TEXT,
                approved_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES governance_users (id),
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (approved_by) REFERENCES governance_users (id)
            )`,

            `CREATE TABLE IF NOT EXISTS project_budgets (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                budget_type TEXT NOT NULL,  -- 'claude_api', 'infrastructure', 'development', 'other'
                monthly_limit DECIMAL(12,2) NOT NULL,
                annual_limit DECIMAL(12,2),
                current_spend DECIMAL(12,2) DEFAULT 0.00,
                forecast_spend DECIMAL(12,2) DEFAULT 0.00,
                alert_threshold DECIMAL(5,2) DEFAULT 0.80,  -- 80% threshold
                hard_limit BOOLEAN DEFAULT FALSE,
                currency TEXT DEFAULT 'USD',
                fiscal_year INTEGER DEFAULT 2025,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (team_id) REFERENCES teams (id),
                UNIQUE(project_id, team_id, budget_type, fiscal_year)
            )`,

            // Workflow permissions and governance
            `CREATE TABLE IF NOT EXISTS workflow_permissions (
                id TEXT PRIMARY KEY,
                workflow_type TEXT NOT NULL,
                workflow_category TEXT,  -- 'development', 'deployment', 'security', 'analytics'
                required_roles TEXT NOT NULL,  -- JSON array of required roles
                approval_required BOOLEAN DEFAULT FALSE,
                approval_roles TEXT,  -- JSON array of approver roles
                approval_timeout INTEGER DEFAULT 3600,  -- seconds
                cost_limit DECIMAL(10,2),
                compliance_requirements TEXT,  -- JSON array of compliance requirements
                risk_level TEXT DEFAULT 'medium',
                auto_approval_conditions TEXT,  -- JSON conditions for auto-approval
                emergency_override BOOLEAN DEFAULT FALSE,
                active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(workflow_type)
            )`,

            // Governance policies and rules
            `CREATE TABLE IF NOT EXISTS governance_policies (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                description TEXT,
                policy_type TEXT NOT NULL,  -- 'access', 'cost', 'compliance', 'security', 'data'
                category TEXT,  -- 'organizational', 'technical', 'legal', 'operational'
                rules TEXT NOT NULL,  -- JSON policy rules
                enforcement_level TEXT DEFAULT 'warning',  -- 'blocking', 'warning', 'advisory'
                compliance_frameworks TEXT,  -- JSON array of frameworks (SOC2, GDPR, etc.)
                affected_resources TEXT,  -- JSON array of affected resources
                exceptions TEXT,  -- JSON array of policy exceptions
                review_frequency INTEGER DEFAULT 90,  -- days
                last_reviewed DATETIME,
                next_review DATETIME,
                owner_id TEXT,
                active BOOLEAN DEFAULT TRUE,
                version INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (owner_id) REFERENCES governance_users (id)
            )`,

            // Policy violations and enforcement
            `CREATE TABLE IF NOT EXISTS policy_violations (
                id TEXT PRIMARY KEY,
                policy_id TEXT NOT NULL,
                user_id TEXT,
                resource TEXT,
                action TEXT,
                violation_type TEXT,  -- 'access', 'cost', 'compliance', 'security'
                severity TEXT DEFAULT 'medium',  -- 'critical', 'high', 'medium', 'low'
                description TEXT,
                violation_data TEXT,  -- JSON violation details
                resolution_status TEXT DEFAULT 'open',  -- 'open', 'investigating', 'resolved', 'accepted'
                resolved_by TEXT,
                resolved_at DATETIME,
                resolution_notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (policy_id) REFERENCES governance_policies (id),
                FOREIGN KEY (user_id) REFERENCES governance_users (id),
                FOREIGN KEY (resolved_by) REFERENCES governance_users (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        this.logger.info('Core governance tables created successfully');
    }

    /**
     * Create cost management and budgeting tables
     */
    async createCostManagementTables() {
        const tables = [
            // Claude API cost tracking
            `CREATE TABLE IF NOT EXISTS claude_api_usage (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                team_id TEXT,
                project_id TEXT,
                workflow_id TEXT,
                session_id TEXT,
                model TEXT,  -- claude-3-sonnet, claude-3-haiku, etc.
                input_tokens INTEGER NOT NULL,
                output_tokens INTEGER NOT NULL,
                total_tokens INTEGER NOT NULL,
                cost_per_input_token DECIMAL(10,8),
                cost_per_output_token DECIMAL(10,8),
                total_cost DECIMAL(10,4),
                currency TEXT DEFAULT 'USD',
                request_type TEXT,  -- 'workflow', 'chat', 'api_call'
                endpoint TEXT,
                response_time INTEGER,  -- milliseconds
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES governance_users (id),
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )`,

            // Infrastructure cost tracking
            `CREATE TABLE IF NOT EXISTS infrastructure_costs (
                id TEXT PRIMARY KEY,
                resource_type TEXT NOT NULL,  -- 'pm2_service', 'docker_container', 'database', 'storage'
                resource_id TEXT NOT NULL,
                team_id TEXT,
                project_id TEXT,
                cost_type TEXT,  -- 'compute', 'storage', 'network', 'licensing'
                hourly_cost DECIMAL(10,6),
                daily_cost DECIMAL(10,4),
                monthly_cost DECIMAL(10,2),
                actual_usage TEXT,  -- JSON usage metrics
                cost_calculation TEXT,  -- JSON cost breakdown
                billing_period TEXT,
                currency TEXT DEFAULT 'USD',
                date DATE DEFAULT CURRENT_DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )`,

            // Budget alerts and notifications
            `CREATE TABLE IF NOT EXISTS budget_alerts (
                id TEXT PRIMARY KEY,
                budget_id TEXT NOT NULL,
                alert_type TEXT NOT NULL,  -- 'threshold', 'overage', 'forecast'
                severity TEXT DEFAULT 'medium',
                threshold_percentage DECIMAL(5,2),
                current_spend DECIMAL(12,2),
                budget_limit DECIMAL(12,2),
                forecast_overage DECIMAL(12,2),
                alert_message TEXT,
                notification_sent BOOLEAN DEFAULT FALSE,
                acknowledged BOOLEAN DEFAULT FALSE,
                acknowledged_by TEXT,
                acknowledged_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (budget_id) REFERENCES project_budgets (id),
                FOREIGN KEY (acknowledged_by) REFERENCES governance_users (id)
            )`,

            // Cost optimization recommendations
            `CREATE TABLE IF NOT EXISTS cost_recommendations (
                id TEXT PRIMARY KEY,
                recommendation_type TEXT NOT NULL,  -- 'model_optimization', 'usage_reduction', 'resource_optimization'
                target_type TEXT,  -- 'user', 'team', 'project', 'system'
                target_id TEXT,
                title TEXT NOT NULL,
                description TEXT,
                potential_savings DECIMAL(10,2),
                implementation_effort TEXT DEFAULT 'medium',  -- 'low', 'medium', 'high'
                priority TEXT DEFAULT 'medium',
                status TEXT DEFAULT 'open',  -- 'open', 'implementing', 'completed', 'dismissed'
                recommendation_data TEXT,  -- JSON recommendation details
                implemented_by TEXT,
                implemented_at DATETIME,
                actual_savings DECIMAL(10,2),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (implemented_by) REFERENCES governance_users (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        this.logger.info('Cost management tables created successfully');
    }

    /**
     * Create analytics and reporting tables
     */
    async createAnalyticsTables() {
        const tables = [
            // System usage analytics
            `CREATE TABLE IF NOT EXISTS usage_analytics (
                id TEXT PRIMARY KEY,
                metric_type TEXT NOT NULL,  -- 'workflow_execution', 'service_usage', 'user_activity'
                metric_name TEXT NOT NULL,
                user_id TEXT,
                team_id TEXT,
                project_id TEXT,
                service_name TEXT,
                metric_value DECIMAL(12,4),
                metric_unit TEXT,
                dimensions TEXT,  -- JSON additional dimensions
                aggregation_period TEXT DEFAULT 'hourly',  -- 'hourly', 'daily', 'weekly', 'monthly'
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES governance_users (id),
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )`,

            // Performance metrics
            `CREATE TABLE IF NOT EXISTS performance_metrics (
                id TEXT PRIMARY KEY,
                metric_category TEXT NOT NULL,  -- 'response_time', 'throughput', 'error_rate', 'availability'
                service_name TEXT NOT NULL,
                endpoint TEXT,
                metric_value DECIMAL(12,6),
                metric_unit TEXT,
                aggregation_type TEXT DEFAULT 'average',  -- 'average', 'min', 'max', 'sum', 'count'
                sample_count INTEGER,
                percentiles TEXT,  -- JSON p50, p95, p99 values
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Business intelligence metrics
            `CREATE TABLE IF NOT EXISTS business_metrics (
                id TEXT PRIMARY KEY,
                metric_name TEXT NOT NULL,
                metric_category TEXT,  -- 'productivity', 'efficiency', 'quality', 'adoption'
                team_id TEXT,
                project_id TEXT,
                metric_value DECIMAL(12,4),
                target_value DECIMAL(12,4),
                variance_percentage DECIMAL(5,2),
                trend TEXT,  -- 'increasing', 'decreasing', 'stable'
                calculation_method TEXT,  -- JSON calculation details
                reporting_period TEXT,  -- 'daily', 'weekly', 'monthly', 'quarterly'
                date DATE DEFAULT CURRENT_DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (team_id) REFERENCES teams (id),
                FOREIGN KEY (project_id) REFERENCES projects (id)
            )`,

            // Scheduled reports
            `CREATE TABLE IF NOT EXISTS scheduled_reports (
                id TEXT PRIMARY KEY,
                report_name TEXT NOT NULL,
                report_type TEXT NOT NULL,  -- 'governance', 'cost', 'performance', 'compliance'
                recipients TEXT,  -- JSON array of email addresses
                schedule_expression TEXT,  -- cron expression
                report_config TEXT,  -- JSON report configuration
                output_format TEXT DEFAULT 'pdf',  -- 'pdf', 'excel', 'csv', 'json'
                delivery_method TEXT DEFAULT 'email',  -- 'email', 'slack', 'webhook'
                last_run DATETIME,
                next_run DATETIME,
                active BOOLEAN DEFAULT TRUE,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (created_by) REFERENCES governance_users (id)
            )`,

            // Report execution history
            `CREATE TABLE IF NOT EXISTS report_executions (
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL,
                execution_status TEXT DEFAULT 'pending',  -- 'pending', 'running', 'completed', 'failed'
                start_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                end_time DATETIME,
                duration_seconds INTEGER,
                records_processed INTEGER,
                output_file_path TEXT,
                output_file_size INTEGER,
                error_message TEXT,
                execution_metadata TEXT,  -- JSON execution details
                FOREIGN KEY (report_id) REFERENCES scheduled_reports (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        this.logger.info('Analytics tables created successfully');
    }

    /**
     * Create compliance and audit tables
     */
    async createComplianceTables() {
        const tables = [
            // Compliance frameworks
            `CREATE TABLE IF NOT EXISTS compliance_frameworks (
                id TEXT PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,  -- 'SOC2', 'GDPR', 'HIPAA', 'PCI-DSS'
                version TEXT,
                description TEXT,
                requirements TEXT,  -- JSON framework requirements
                controls TEXT,  -- JSON compliance controls
                assessment_frequency INTEGER DEFAULT 365,  -- days
                last_assessment DATETIME,
                next_assessment DATETIME,
                compliance_status TEXT DEFAULT 'not_assessed',  -- 'compliant', 'non_compliant', 'not_assessed'
                assessment_score DECIMAL(5,2),
                active BOOLEAN DEFAULT TRUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Compliance assessments
            `CREATE TABLE IF NOT EXISTS compliance_assessments (
                id TEXT PRIMARY KEY,
                framework_id TEXT NOT NULL,
                assessment_type TEXT DEFAULT 'internal',  -- 'internal', 'external', 'self_assessment'
                assessor_id TEXT,
                assessment_period_start DATE,
                assessment_period_end DATE,
                overall_score DECIMAL(5,2),
                compliance_status TEXT,  -- 'compliant', 'non_compliant', 'partially_compliant'
                findings TEXT,  -- JSON assessment findings
                recommendations TEXT,  -- JSON recommendations
                remediation_plan TEXT,  -- JSON remediation actions
                certification_status TEXT,  -- 'certified', 'pending', 'expired', 'failed'
                certificate_expiry DATETIME,
                assessment_report_path TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (framework_id) REFERENCES compliance_frameworks (id),
                FOREIGN KEY (assessor_id) REFERENCES governance_users (id)
            )`,

            // Data privacy and protection
            `CREATE TABLE IF NOT EXISTS data_privacy_records (
                id TEXT PRIMARY KEY,
                data_subject_id TEXT,  -- Individual whose data is processed
                data_type TEXT NOT NULL,  -- 'personal', 'sensitive', 'financial', 'health'
                processing_purpose TEXT,
                legal_basis TEXT,  -- GDPR legal basis
                data_source TEXT,
                retention_period INTEGER,  -- days
                deletion_date DATETIME,
                consent_obtained BOOLEAN DEFAULT FALSE,
                consent_date DATETIME,
                consent_method TEXT,
                data_location TEXT,  -- jurisdiction/region
                encryption_status BOOLEAN DEFAULT FALSE,
                access_restrictions TEXT,  -- JSON access controls
                processing_activities TEXT,  -- JSON processing log
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,

            // Compliance violations and incidents
            `CREATE TABLE IF NOT EXISTS compliance_incidents (
                id TEXT PRIMARY KEY,
                incident_type TEXT NOT NULL,  -- 'data_breach', 'access_violation', 'policy_breach'
                severity TEXT DEFAULT 'medium',
                framework_id TEXT,
                affected_data_subjects INTEGER,
                affected_records INTEGER,
                incident_description TEXT,
                discovery_date DATETIME,
                discovery_method TEXT,
                reported_date DATETIME,
                reported_to TEXT,  -- regulatory authorities
                investigation_status TEXT DEFAULT 'open',
                investigation_findings TEXT,
                remediation_actions TEXT,  -- JSON remediation steps
                lessons_learned TEXT,
                incident_cost DECIMAL(12,2),
                regulatory_fine DECIMAL(12,2),
                closed_date DATETIME,
                created_by TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (framework_id) REFERENCES compliance_frameworks (id),
                FOREIGN KEY (created_by) REFERENCES governance_users (id)
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        this.logger.info('Compliance tables created successfully');
    }

    /**
     * Create comprehensive audit trail tables
     */
    async createAuditTables() {
        const tables = [
            // Enhanced audit trail
            `CREATE TABLE IF NOT EXISTS audit_trail (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT UNIQUE NOT NULL,
                event_type TEXT NOT NULL,
                event_category TEXT,  -- 'authentication', 'authorization', 'data_access', 'configuration'
                user_id TEXT,
                impersonated_user_id TEXT,  -- for admin impersonation
                session_id TEXT,
                resource_type TEXT,
                resource_id TEXT,
                action TEXT NOT NULL,
                outcome TEXT,  -- 'success', 'failure', 'partial'
                risk_level TEXT DEFAULT 'low',  -- 'critical', 'high', 'medium', 'low'
                details TEXT,  -- JSON event details
                before_state TEXT,  -- JSON before state
                after_state TEXT,  -- JSON after state
                ip_address TEXT,
                user_agent TEXT,
                request_id TEXT,
                correlation_id TEXT,  -- for tracking related events
                compliance_relevant BOOLEAN DEFAULT TRUE,
                retention_period INTEGER DEFAULT 2555,  -- 7 years in days
                geographic_location TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES governance_users (id),
                FOREIGN KEY (impersonated_user_id) REFERENCES governance_users (id)
            )`,

            // Access logs for detailed access tracking
            `CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                resource_id TEXT,
                access_type TEXT,  -- 'read', 'write', 'delete', 'execute'
                access_result TEXT,  -- 'granted', 'denied'
                permission_used TEXT,
                role_used TEXT,
                team_context TEXT,
                project_context TEXT,
                access_duration INTEGER,  -- seconds
                data_accessed TEXT,  -- JSON description of data accessed
                sensitive_data BOOLEAN DEFAULT FALSE,
                ip_address TEXT,
                session_id TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES governance_users (id)
            )`,

            // System configuration changes
            `CREATE TABLE IF NOT EXISTS configuration_changes (
                id TEXT PRIMARY KEY,
                change_type TEXT NOT NULL,  -- 'policy', 'role', 'permission', 'budget', 'service'
                component TEXT NOT NULL,
                configuration_key TEXT,
                old_value TEXT,
                new_value TEXT,
                change_reason TEXT,
                approval_required BOOLEAN DEFAULT FALSE,
                approved_by TEXT,
                approval_date DATETIME,
                implemented_by TEXT NOT NULL,
                implementation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                rollback_possible BOOLEAN DEFAULT TRUE,
                rollback_data TEXT,  -- JSON rollback information
                impact_assessment TEXT,  -- JSON impact analysis
                validation_status TEXT DEFAULT 'pending',  -- 'pending', 'validated', 'failed'
                validation_results TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (approved_by) REFERENCES governance_users (id),
                FOREIGN KEY (implemented_by) REFERENCES governance_users (id)
            )`,

            // Audit log integrity verification
            `CREATE TABLE IF NOT EXISTS audit_integrity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                log_table TEXT NOT NULL,
                log_entry_id TEXT NOT NULL,
                hash_algorithm TEXT DEFAULT 'SHA-256',
                entry_hash TEXT NOT NULL,
                chain_hash TEXT,  -- hash of previous entry for chain integrity
                verification_status TEXT DEFAULT 'valid',  -- 'valid', 'invalid', 'missing'
                last_verified DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`
        ];

        for (const table of tables) {
            await this.run(table);
        }

        this.logger.info('Audit tables created successfully');
    }

    /**
     * Create performance indexes for all governance tables
     */
    async createGovernanceIndexes() {
        const indexes = [
            // Governance table indexes
            'CREATE INDEX IF NOT EXISTS idx_governance_users_email ON governance_users(email)',
            'CREATE INDEX IF NOT EXISTS idx_governance_users_status ON governance_users(status)',
            'CREATE INDEX IF NOT EXISTS idx_teams_department ON teams(department)',
            'CREATE INDEX IF NOT EXISTS idx_teams_status ON teams(status)',
            'CREATE INDEX IF NOT EXISTS idx_user_teams_user_id ON user_teams(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_teams_team_id ON user_teams(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_user_teams_role ON user_teams(role)',

            // Project and budget indexes
            'CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)',
            'CREATE INDEX IF NOT EXISTS idx_projects_team_id ON projects(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)',
            'CREATE INDEX IF NOT EXISTS idx_project_budgets_project_id ON project_budgets(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_budgets_team_id ON project_budgets(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_project_budgets_budget_type ON project_budgets(budget_type)',

            // Workflow and policy indexes
            'CREATE INDEX IF NOT EXISTS idx_workflow_permissions_type ON workflow_permissions(workflow_type)',
            'CREATE INDEX IF NOT EXISTS idx_workflow_permissions_category ON workflow_permissions(workflow_category)',
            'CREATE INDEX IF NOT EXISTS idx_governance_policies_type ON governance_policies(policy_type)',
            'CREATE INDEX IF NOT EXISTS idx_governance_policies_active ON governance_policies(active)',
            'CREATE INDEX IF NOT EXISTS idx_policy_violations_policy_id ON policy_violations(policy_id)',
            'CREATE INDEX IF NOT EXISTS idx_policy_violations_user_id ON policy_violations(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_policy_violations_severity ON policy_violations(severity)',

            // Cost management indexes
            'CREATE INDEX IF NOT EXISTS idx_claude_api_usage_user_id ON claude_api_usage(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_claude_api_usage_team_id ON claude_api_usage(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_claude_api_usage_project_id ON claude_api_usage(project_id)',
            'CREATE INDEX IF NOT EXISTS idx_claude_api_usage_timestamp ON claude_api_usage(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_team_id ON infrastructure_costs(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_infrastructure_costs_date ON infrastructure_costs(date)',
            'CREATE INDEX IF NOT EXISTS idx_budget_alerts_budget_id ON budget_alerts(budget_id)',
            'CREATE INDEX IF NOT EXISTS idx_budget_alerts_severity ON budget_alerts(severity)',

            // Analytics indexes
            'CREATE INDEX IF NOT EXISTS idx_usage_analytics_metric_type ON usage_analytics(metric_type)',
            'CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_id ON usage_analytics(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_usage_analytics_team_id ON usage_analytics(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_usage_analytics_timestamp ON usage_analytics(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_service ON performance_metrics(service_name)',
            'CREATE INDEX IF NOT EXISTS idx_performance_metrics_category ON performance_metrics(metric_category)',
            'CREATE INDEX IF NOT EXISTS idx_business_metrics_team_id ON business_metrics(team_id)',
            'CREATE INDEX IF NOT EXISTS idx_business_metrics_date ON business_metrics(date)',

            // Compliance indexes
            'CREATE INDEX IF NOT EXISTS idx_compliance_frameworks_active ON compliance_frameworks(active)',
            'CREATE INDEX IF NOT EXISTS idx_compliance_assessments_framework_id ON compliance_assessments(framework_id)',
            'CREATE INDEX IF NOT EXISTS idx_data_privacy_records_data_type ON data_privacy_records(data_type)',
            'CREATE INDEX IF NOT EXISTS idx_compliance_incidents_incident_type ON compliance_incidents(incident_type)',
            'CREATE INDEX IF NOT EXISTS idx_compliance_incidents_severity ON compliance_incidents(severity)',

            // Audit trail indexes
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_event_type ON audit_trail(event_type)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON audit_trail(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_resource_type ON audit_trail(resource_type)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON audit_trail(created_at)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_compliance_relevant ON audit_trail(compliance_relevant)',
            'CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id)',
            'CREATE INDEX IF NOT EXISTS idx_access_logs_resource_type ON access_logs(resource_type)',
            'CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_configuration_changes_change_type ON configuration_changes(change_type)',
            'CREATE INDEX IF NOT EXISTS idx_configuration_changes_component ON configuration_changes(component)',

            // Composite indexes for common queries
            'CREATE INDEX IF NOT EXISTS idx_user_teams_user_team ON user_teams(user_id, team_id)',
            'CREATE INDEX IF NOT EXISTS idx_claude_usage_user_date ON claude_api_usage(user_id, timestamp)',
            'CREATE INDEX IF NOT EXISTS idx_audit_trail_user_event ON audit_trail(user_id, event_type, created_at)',
            'CREATE INDEX IF NOT EXISTS idx_budget_spend_tracking ON project_budgets(team_id, budget_type, current_spend)',
            'CREATE INDEX IF NOT EXISTS idx_policy_violations_status ON policy_violations(resolution_status, severity, created_at)'
        ];

        let indexesCreated = 0;
        for (const index of indexes) {
            try {
                await this.run(index);
                indexesCreated++;
            } catch (error) {
                this.logger.warn('Failed to create index:', { index, error: error.message });
            }
        }

        this.logger.info(`Created ${indexesCreated} governance database indexes`);
        return indexesCreated;
    }

    /**
     * Insert initial governance data
     */
    async insertInitialData() {
        try {
            // Insert compliance frameworks
            const frameworks = [
                {
                    id: 'soc2_type2',
                    name: 'SOC 2 Type II',
                    version: '2017',
                    description: 'Service Organization Control 2 Type II audit framework',
                    requirements: JSON.stringify({
                        security: 'CC6.1, CC6.2, CC6.3, CC6.6, CC6.7',
                        availability: 'A1.1, A1.2',
                        confidentiality: 'C1.1, C1.2'
                    }),
                    assessment_frequency: 365
                },
                {
                    id: 'gdpr',
                    name: 'GDPR',
                    version: '2018',
                    description: 'General Data Protection Regulation compliance',
                    requirements: JSON.stringify({
                        lawfulness: 'Article 6',
                        consent: 'Article 7',
                        data_subject_rights: 'Articles 15-22',
                        privacy_by_design: 'Article 25'
                    }),
                    assessment_frequency: 365
                }
            ];

            for (const framework of frameworks) {
                await this.run(
                    `INSERT OR IGNORE INTO compliance_frameworks
                     (id, name, version, description, requirements, assessment_frequency)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [framework.id, framework.name, framework.version, framework.description,
                     framework.requirements, framework.assessment_frequency]
                );
            }

            // Insert initial governance policies
            const policies = [
                {
                    id: 'claude_api_usage_policy',
                    name: 'Claude API Usage Policy',
                    description: 'Governs appropriate use of Claude API within organization',
                    policy_type: 'cost',
                    category: 'technical',
                    rules: JSON.stringify({
                        max_tokens_per_request: 100000,
                        max_daily_cost_per_user: 50,
                        prohibited_content: ['personal_data', 'credentials', 'proprietary_code']
                    }),
                    enforcement_level: 'blocking',
                    compliance_frameworks: JSON.stringify(['soc2_type2'])
                },
                {
                    id: 'data_retention_policy',
                    name: 'Data Retention Policy',
                    description: 'Defines data retention requirements and deletion schedules',
                    policy_type: 'compliance',
                    category: 'legal',
                    rules: JSON.stringify({
                        audit_logs: 2555,  // 7 years
                        user_data: 1095,   // 3 years
                        analytics_data: 730 // 2 years
                    }),
                    enforcement_level: 'blocking',
                    compliance_frameworks: JSON.stringify(['gdpr', 'soc2_type2'])
                }
            ];

            for (const policy of policies) {
                await this.run(
                    `INSERT OR IGNORE INTO governance_policies
                     (id, name, description, policy_type, category, rules, enforcement_level, compliance_frameworks)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [policy.id, policy.name, policy.description, policy.policy_type,
                     policy.category, policy.rules, policy.enforcement_level, policy.compliance_frameworks]
                );
            }

            // Insert default workflow permissions
            const workflows = [
                {
                    id: 'claude_workflow_basic',
                    workflow_type: 'claude_workflow',
                    workflow_category: 'development',
                    required_roles: JSON.stringify(['developer', 'admin']),
                    cost_limit: 10.00,
                    risk_level: 'low'
                },
                {
                    id: 'deployment_production',
                    workflow_type: 'deployment_production',
                    workflow_category: 'deployment',
                    required_roles: JSON.stringify(['admin']),
                    approval_required: true,
                    approval_roles: JSON.stringify(['manager', 'admin']),
                    cost_limit: 100.00,
                    risk_level: 'high'
                }
            ];

            for (const workflow of workflows) {
                await this.run(
                    `INSERT OR IGNORE INTO workflow_permissions
                     (id, workflow_type, workflow_category, required_roles, approval_required, approval_roles, cost_limit, risk_level)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [workflow.id, workflow.workflow_type, workflow.workflow_category,
                     workflow.required_roles, workflow.approval_required, workflow.approval_roles,
                     workflow.cost_limit, workflow.risk_level]
                );
            }

            this.logger.info('Initial governance data inserted successfully');

        } catch (error) {
            this.logger.error('Failed to insert initial data:', { error: error.message });
            throw error;
        }
    }

    /**
     * Update schema version
     */
    async updateSchemaVersion() {
        await this.run(
            `INSERT OR REPLACE INTO configuration (key, value, updated_at)
             VALUES ('schema_version', ?, CURRENT_TIMESTAMP)`,
            [this.schemaVersion]
        );

        await this.run(
            `INSERT OR REPLACE INTO configuration (key, value, updated_at)
             VALUES ('governance_schema_initialized', 'true', CURRENT_TIMESTAMP)`
        );
    }

    /**
     * Get total table count
     */
    async getTableCount() {
        const result = await this.getSQL(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );
        return result.count;
    }

    /**
     * Get total index count
     */
    async getIndexCount() {
        const result = await this.getSQL(
            "SELECT COUNT(*) as count FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'"
        );
        return result.count;
    }

    /**
     * Verify schema integrity
     */
    async verifySchemaIntegrity() {
        try {
            const results = {
                tables: await this.getTableCount(),
                indexes: await this.getIndexCount(),
                schemaVersion: this.schemaVersion,
                errors: []
            };

            // Verify critical tables exist
            const criticalTables = [
                'governance_users', 'teams', 'user_teams', 'projects', 'project_budgets',
                'workflow_permissions', 'governance_policies', 'claude_api_usage',
                'audit_trail', 'compliance_frameworks'
            ];

            for (const table of criticalTables) {
                const exists = await this.getSQL(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [table]
                );

                if (!exists) {
                    results.errors.push(`Critical table missing: ${table}`);
                }
            }

            results.healthy = results.errors.length === 0;

            this.logger.info('Schema integrity verification completed', results);
            return results;

        } catch (error) {
            this.logger.error('Schema integrity verification failed:', { error: error.message });
            throw error;
        }
    }
}

module.exports = { GovernanceSchemaManager };