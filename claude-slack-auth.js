const { App } = require('@slack/bolt');
const { WebClient } = require('@slack/web-api');
const crypto = require('crypto');
const { SQLiteManager } = require('./database/sqlite-manager');
const winston = require('winston');

/**
 * Slack OAuth and Role Management System
 * 
 * Handles Slack OAuth flow, user permissions, and role-based access control
 * Following security best practices and 12-Factor principles
 */
class SlackAuthManager {
    constructor(options = {}) {
        this.config = {
            clientId: options.clientId || process.env.SLACK_CLIENT_ID,
            clientSecret: options.clientSecret || process.env.SLACK_CLIENT_SECRET,
            signingSecret: options.signingSecret || process.env.SLACK_SIGNING_SECRET,
            redirectUri: options.redirectUri || process.env.SLACK_REDIRECT_URI,
            scopes: options.scopes || [
                'app_mentions:read',
                'chat:write',
                'commands',
                'reactions:read',
                'workflow.steps:execute',
                'users:read',
                'channels:read',
                'groups:read'
            ],
            ...options
        };

        // Database and logger
        this.db = new SQLiteManager();
        this.logger = winston.createLogger({
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.Console(),
                new winston.transports.File({ filename: 'slack-auth.log' })
            ]
        });

        // Role definitions
        this.roles = new Map([
            ['admin', {
                name: 'Administrator',
                permissions: ['*'], // All permissions
                description: 'Full system access'
            }],
            ['developer', {
                name: 'Developer',
                permissions: [
                    'workflow.start',
                    'workflow.view',
                    'agent.view',
                    'deployment.staging',
                    'security.scan'
                ],
                description: 'Development and testing access'
            }],
            ['operator', {
                name: 'Operator',
                permissions: [
                    'workflow.start',
                    'workflow.view',
                    'workflow.approve',
                    'deployment.production',
                    'monitoring.view'
                ],
                description: 'Production operations access'
            }],
            ['viewer', {
                name: 'Viewer',
                permissions: [
                    'workflow.view',
                    'agent.view',
                    'monitoring.view'
                ],
                description: 'Read-only access'
            }]
        ]);

        // Permission definitions
        this.permissions = new Map([
            ['workflow.start', 'Start new workflows'],
            ['workflow.view', 'View workflow status'],
            ['workflow.approve', 'Approve workflow requests'],
            ['workflow.cancel', 'Cancel running workflows'],
            ['agent.view', 'View agent status'],
            ['agent.restart', 'Restart agents'],
            ['deployment.staging', 'Deploy to staging'],
            ['deployment.production', 'Deploy to production'],
            ['security.scan', 'Run security scans'],
            ['monitoring.view', 'View monitoring data'],
            ['config.edit', 'Edit configuration'],
            ['user.manage', 'Manage user permissions']
        ]);

        // Active sessions and tokens
        this.activeSessions = new Map();
        this.workspaceTokens = new Map();
    }

    /**
     * Initialize the auth manager
     */
    async initialize() {
        try {
            await this.db.initialize();
            
            // Create auth tables
            await this.createAuthTables();
            
            // Load existing workspace tokens
            await this.loadWorkspaceTokens();
            
            this.logger.info('Slack auth manager initialized successfully');

        } catch (error) {
            this.logger.error('Failed to initialize Slack auth manager', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Create authentication database tables
     */
    async createAuthTables() {
        // Workspaces table
        await this.db.db.run(`
            CREATE TABLE IF NOT EXISTS slack_workspaces (
                team_id TEXT PRIMARY KEY,
                team_name TEXT NOT NULL,
                bot_user_id TEXT NOT NULL,
                bot_access_token TEXT NOT NULL,
                user_access_token TEXT,
                scope TEXT NOT NULL,
                installed_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )
        `);

        // Users and roles table
        await this.db.db.run(`
            CREATE TABLE IF NOT EXISTS slack_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                username TEXT NOT NULL,
                email TEXT,
                role TEXT DEFAULT 'viewer',
                permissions TEXT, -- JSON array of additional permissions
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, team_id)
            )
        `);

        // OAuth states table (for CSRF protection)
        await this.db.db.run(`
            CREATE TABLE IF NOT EXISTS oauth_states (
                state TEXT PRIMARY KEY,
                team_id TEXT,
                user_id TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            )
        `);

        // Access logs table
        await this.db.db.run(`
            CREATE TABLE IF NOT EXISTS access_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                team_id TEXT NOT NULL,
                action TEXT NOT NULL,
                permission TEXT NOT NULL,
                allowed BOOLEAN NOT NULL,
                timestamp INTEGER NOT NULL,
                details TEXT -- JSON
            )
        `);
    }

    /**
     * Generate OAuth installation URL
     */
    generateInstallUrl(teamId = null) {
        const state = this.generateState(teamId);
        const scopes = this.config.scopes.join(',');
        
        const params = new URLSearchParams({
            client_id: this.config.clientId,
            scope: scopes,
            redirect_uri: this.config.redirectUri,
            state: state
        });

        return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
    }

    /**
     * Generate secure state parameter for OAuth
     */
    generateState(teamId = null) {
        const state = crypto.randomBytes(16).toString('hex');
        const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes
        
        // Store state in database
        this.db.db.run(`
            INSERT INTO oauth_states (state, team_id, created_at, expires_at)
            VALUES (?, ?, ?, ?)
        `, [state, teamId, Date.now(), expiresAt]);

        return state;
    }

    /**
     * Handle OAuth callback
     */
    async handleOAuthCallback(code, state) {
        try {
            // Verify state parameter
            const stateRecord = await this.db.db.get(`
                SELECT * FROM oauth_states WHERE state = ? AND expires_at > ?
            `, [state, Date.now()]);

            if (!stateRecord) {
                throw new Error('Invalid or expired OAuth state');
            }

            // Exchange code for tokens
            const client = new WebClient();
            const result = await client.oauth.v2.access({
                client_id: this.config.clientId,
                client_secret: this.config.clientSecret,
                code: code,
                redirect_uri: this.config.redirectUri
            });

            if (!result.ok) {
                throw new Error(`OAuth exchange failed: ${result.error}`);
            }

            // Store workspace installation
            await this.storeWorkspaceInstallation(result);

            // Clean up used state
            await this.db.db.run(`
                DELETE FROM oauth_states WHERE state = ?
            `, [state]);

            this.logger.info('OAuth installation completed', {
                teamId: result.team.id,
                teamName: result.team.name
            });

            return {
                success: true,
                teamId: result.team.id,
                teamName: result.team.name
            };

        } catch (error) {
            this.logger.error('OAuth callback failed', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Store workspace installation details
     */
    async storeWorkspaceInstallation(oauthResult) {
        const {
            team,
            bot_user_id,
            access_token,
            scope,
            authed_user
        } = oauthResult;

        const now = Date.now();

        // Store workspace
        await this.db.db.run(`
            INSERT OR REPLACE INTO slack_workspaces (
                team_id, team_name, bot_user_id, bot_access_token, 
                user_access_token, scope, installed_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            team.id,
            team.name,
            bot_user_id,
            access_token,
            authed_user?.access_token,
            scope,
            now,
            now
        ]);

        // Store installing user as admin
        if (authed_user) {
            await this.createOrUpdateUser(
                authed_user.id,
                team.id,
                authed_user.name || 'Unknown',
                null,
                'admin'
            );
        }

        // Cache token
        this.workspaceTokens.set(team.id, access_token);
    }

    /**
     * Load workspace tokens from database
     */
    async loadWorkspaceTokens() {
        const workspaces = await this.db.db.all(`
            SELECT team_id, bot_access_token FROM slack_workspaces
        `);

        for (const workspace of workspaces) {
            this.workspaceTokens.set(workspace.team_id, workspace.bot_access_token);
        }

        this.logger.info('Loaded workspace tokens', { 
            count: workspaces.length 
        });
    }

    /**
     * Create or update user
     */
    async createOrUpdateUser(userId, teamId, username, email = null, role = 'viewer', additionalPermissions = []) {
        const now = Date.now();
        
        await this.db.db.run(`
            INSERT OR REPLACE INTO slack_users (
                user_id, team_id, username, email, role, permissions, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, 
                COALESCE((SELECT created_at FROM slack_users WHERE user_id = ? AND team_id = ?), ?),
                ?
            )
        `, [
            userId, teamId, username, email, role, 
            JSON.stringify(additionalPermissions),
            userId, teamId, now, now
        ]);

        this.logger.info('User created/updated', {
            userId,
            teamId,
            role,
            additionalPermissions: additionalPermissions.length
        });
    }

    /**
     * Check if user has permission
     */
    async hasPermission(userId, teamId, permission) {
        try {
            const user = await this.db.db.get(`
                SELECT role, permissions FROM slack_users 
                WHERE user_id = ? AND team_id = ?
            `, [userId, teamId]);

            if (!user) {
                // User not found, default to viewer role
                await this.createOrUpdateUser(userId, teamId, 'Unknown User');
                return this.roleHasPermission('viewer', permission);
            }

            // Check role permissions
            const hasRolePermission = this.roleHasPermission(user.role, permission);
            
            // Check additional permissions
            const additionalPermissions = user.permissions ? JSON.parse(user.permissions) : [];
            const hasAdditionalPermission = additionalPermissions.includes(permission);

            const allowed = hasRolePermission || hasAdditionalPermission;

            // Log access attempt
            await this.logAccess(userId, teamId, 'permission_check', permission, allowed, {
                role: user.role,
                additionalPermissions: additionalPermissions.length
            });

            return allowed;

        } catch (error) {
            this.logger.error('Permission check failed', {
                userId,
                teamId,
                permission,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Check if role has permission
     */
    roleHasPermission(roleName, permission) {
        const role = this.roles.get(roleName);
        if (!role) return false;

        // Admin has all permissions
        if (role.permissions.includes('*')) return true;
        
        // Check specific permission
        return role.permissions.includes(permission);
    }

    /**
     * Get user details with role and permissions
     */
    async getUserDetails(userId, teamId) {
        const user = await this.db.db.get(`
            SELECT * FROM slack_users 
            WHERE user_id = ? AND team_id = ?
        `, [userId, teamId]);

        if (!user) {
            return null;
        }

        const role = this.roles.get(user.role);
        const additionalPermissions = user.permissions ? JSON.parse(user.permissions) : [];

        return {
            ...user,
            roleInfo: role,
            additionalPermissions,
            allPermissions: role ? [...role.permissions, ...additionalPermissions] : additionalPermissions
        };
    }

    /**
     * Update user role
     */
    async updateUserRole(userId, teamId, newRole, updatedBy) {
        if (!this.roles.has(newRole)) {
            throw new Error(`Invalid role: ${newRole}`);
        }

        await this.db.db.run(`
            UPDATE slack_users 
            SET role = ?, updated_at = ?
            WHERE user_id = ? AND team_id = ?
        `, [newRole, Date.now(), userId, teamId]);

        await this.logAccess(updatedBy, teamId, 'role_update', 'user.manage', true, {
            targetUser: userId,
            newRole: newRole
        });

        this.logger.info('User role updated', {
            userId,
            teamId,
            newRole,
            updatedBy
        });
    }

    /**
     * Add permission to user
     */
    async addUserPermission(userId, teamId, permission, grantedBy) {
        const user = await this.db.db.get(`
            SELECT permissions FROM slack_users 
            WHERE user_id = ? AND team_id = ?
        `, [userId, teamId]);

        if (!user) {
            throw new Error('User not found');
        }

        const currentPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        
        if (!currentPermissions.includes(permission)) {
            currentPermissions.push(permission);
            
            await this.db.db.run(`
                UPDATE slack_users 
                SET permissions = ?, updated_at = ?
                WHERE user_id = ? AND team_id = ?
            `, [JSON.stringify(currentPermissions), Date.now(), userId, teamId]);

            await this.logAccess(grantedBy, teamId, 'permission_grant', 'user.manage', true, {
                targetUser: userId,
                permission: permission
            });

            this.logger.info('Permission granted to user', {
                userId,
                teamId,
                permission,
                grantedBy
            });
        }
    }

    /**
     * Remove permission from user
     */
    async removeUserPermission(userId, teamId, permission, removedBy) {
        const user = await this.db.db.get(`
            SELECT permissions FROM slack_users 
            WHERE user_id = ? AND team_id = ?
        `, [userId, teamId]);

        if (!user) {
            throw new Error('User not found');
        }

        const currentPermissions = user.permissions ? JSON.parse(user.permissions) : [];
        const updatedPermissions = currentPermissions.filter(p => p !== permission);

        await this.db.db.run(`
            UPDATE slack_users 
            SET permissions = ?, updated_at = ?
            WHERE user_id = ? AND team_id = ?
        `, [JSON.stringify(updatedPermissions), Date.now(), userId, teamId]);

        await this.logAccess(removedBy, teamId, 'permission_revoke', 'user.manage', true, {
            targetUser: userId,
            permission: permission
        });

        this.logger.info('Permission removed from user', {
            userId,
            teamId,
            permission,
            removedBy
        });
    }

    /**
     * Log access attempt
     */
    async logAccess(userId, teamId, action, permission, allowed, details = {}) {
        await this.db.db.run(`
            INSERT INTO access_logs (
                user_id, team_id, action, permission, allowed, timestamp, details
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
            userId, teamId, action, permission, allowed ? 1 : 0, 
            Date.now(), JSON.stringify(details)
        ]);
    }

    /**
     * Get workspace bot token
     */
    getWorkspaceToken(teamId) {
        return this.workspaceTokens.get(teamId);
    }

    /**
     * Create Slack client for workspace
     */
    createWorkspaceClient(teamId) {
        const token = this.getWorkspaceToken(teamId);
        if (!token) {
            throw new Error(`No bot token found for workspace: ${teamId}`);
        }

        return new WebClient(token);
    }

    /**
     * Get all users for workspace
     */
    async getWorkspaceUsers(teamId) {
        return await this.db.db.all(`
            SELECT * FROM slack_users 
            WHERE team_id = ?
            ORDER BY username
        `, [teamId]);
    }

    /**
     * Get access logs
     */
    async getAccessLogs(teamId, limit = 100) {
        return await this.db.db.all(`
            SELECT * FROM access_logs 
            WHERE team_id = ?
            ORDER BY timestamp DESC 
            LIMIT ?
        `, [teamId, limit]);
    }

    /**
     * Get available roles
     */
    getAvailableRoles() {
        return Array.from(this.roles.entries()).map(([name, role]) => ({
            name,
            ...role
        }));
    }

    /**
     * Get available permissions
     */
    getAvailablePermissions() {
        return Array.from(this.permissions.entries()).map(([name, description]) => ({
            name,
            description
        }));
    }

    /**
     * Check workspace installation status
     */
    async isWorkspaceInstalled(teamId) {
        const workspace = await this.db.db.get(`
            SELECT team_id FROM slack_workspaces WHERE team_id = ?
        `, [teamId]);

        return !!workspace;
    }

    /**
     * Revoke workspace access
     */
    async revokeWorkspaceAccess(teamId) {
        // Remove from database
        await this.db.db.run(`
            DELETE FROM slack_workspaces WHERE team_id = ?
        `, [teamId]);

        await this.db.db.run(`
            DELETE FROM slack_users WHERE team_id = ?
        `, [teamId]);

        // Remove from cache
        this.workspaceTokens.delete(teamId);

        this.logger.info('Workspace access revoked', { teamId });
    }

    /**
     * Cleanup expired OAuth states
     */
    async cleanupExpiredStates() {
        const result = await this.db.db.run(`
            DELETE FROM oauth_states WHERE expires_at < ?
        `, [Date.now()]);

        if (result.changes > 0) {
            this.logger.info('Cleaned up expired OAuth states', { 
                count: result.changes 
            });
        }
    }
}

/**
 * Demo function
 */
async function demonstrateSlackAuth() {
    console.log('🔐 Slack OAuth and Role Management Demo\n');
    
    try {
        const authManager = new SlackAuthManager({
            clientId: 'demo-client-id',
            clientSecret: 'demo-client-secret',
            redirectUri: 'https://example.com/oauth/callback'
        });
        
        await authManager.initialize();

        console.log('✅ Slack Auth Manager Features:');
        console.log('   • OAuth 2.0 installation flow with CSRF protection');
        console.log('   • Role-based access control (RBAC)');
        console.log('   • Fine-grained permission system');
        console.log('   • Secure token management');
        console.log('   • Access logging and audit trail');
        console.log('   • Workspace installation management');
        console.log('   • User permission administration');

        console.log('\n👥 Available Roles:');
        const roles = authManager.getAvailableRoles();
        roles.forEach(role => {
            console.log(`   • ${role.name}: ${role.description}`);
            console.log(`     Permissions: ${role.permissions.join(', ')}`);
        });

        console.log('\n🔑 Available Permissions:');
        const permissions = authManager.getAvailablePermissions();
        permissions.slice(0, 6).forEach(perm => {
            console.log(`   • ${perm.name}: ${perm.description}`);
        });
        console.log(`   ... and ${permissions.length - 6} more`);

        // Demo OAuth URL generation
        const installUrl = authManager.generateInstallUrl();
        console.log('\n🔗 OAuth Installation:');
        console.log(`   Install URL generated with CSRF protection`);
        console.log(`   Scopes: ${authManager.config.scopes.join(', ')}`);

        // Demo user management
        await authManager.createOrUpdateUser(
            'U123456789', 
            'T123456789', 
            'demo-user', 
            'user@example.com', 
            'developer'
        );

        const hasPermission = await authManager.hasPermission(
            'U123456789', 
            'T123456789', 
            'workflow.start'
        );

        console.log('\n🧪 Permission Check Demo:');
        console.log(`   User 'demo-user' can start workflows: ${hasPermission ? '✅' : '❌'}`);

        await authManager.cleanupExpiredStates();
        console.log('\n✅ Demo completed - Slack OAuth system ready!');

    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

module.exports = {
    SlackAuthManager
};

// Run demo if called directly
if (require.main === module) {
    demonstrateSlackAuth().catch(console.error);
}