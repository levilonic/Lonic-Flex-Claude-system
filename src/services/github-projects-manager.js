const { graphql } = require('@octokit/graphql');
const { Octokit } = require('@octokit/rest');
const { getAuthManager } = require('../auth/auth-manager');
const { SQLiteManager } = require('../database/sqlite-manager');
require('dotenv').config();

/**
 * GitHub Projects Manager - Phase 5.1
 * Manages GitHub Projects v2 API integration for task orchestration
 * Uses GraphQL API as Projects v2 is only accessible via GraphQL
 */
class GitHubProjectsManager {
    constructor(options = {}) {
        this.dbManager = options.dbManager || new SQLiteManager();
        this.authManager = getAuthManager();
        this.graphqlWithAuth = null;
        this.octokit = null;
        this.githubConfig = {};
        
        // Projects data cache
        this.projectsCache = new Map();
        this.milestonesCache = new Map();
        this.issuesCache = new Map();
        
        this.initialized = false;
    }

    /**
     * Initialize with GitHub authentication and setup GraphQL client
     */
    async initialize() {
        if (this.initialized) return;

        // Initialize auth manager
        await this.authManager.initialize();
        this.githubConfig = this.authManager.getGitHubConfig();
        
        if (!this.githubConfig.token) {
            throw new Error('GitHub token required for Projects API operations');
        }

        // Initialize GraphQL client with authentication
        this.graphqlWithAuth = graphql.defaults({
            headers: {
                authorization: `token ${this.githubConfig.token}`,
            },
        });

        // Initialize REST API client for additional operations
        this.octokit = new Octokit({
            auth: this.githubConfig.token,
            userAgent: 'LonicFLex-ProjectsManager/1.0'
        });

        // Test authentication
        const { data: user } = await this.octokit.rest.users.getAuthenticated();
        console.log(`✅ GitHub Projects Manager authenticated as: ${user.login}`);

        // Initialize database
        if (!this.dbManager.isInitialized) {
            await this.dbManager.initialize();
        }

        // Create projects tracking tables
        await this.createProjectsDatabase();

        this.initialized = true;
    }

    /**
     * Create database tables for Projects v2 tracking
     */
    async createProjectsDatabase() {
        const createProjectsTableSQL = `
            CREATE TABLE IF NOT EXISTS github_projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_node_id TEXT UNIQUE NOT NULL,
                project_number INTEGER,
                project_title TEXT NOT NULL,
                project_url TEXT,
                owner_type TEXT NOT NULL,
                owner_login TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT
            )
        `;

        const createProjectItemsTableSQL = `
            CREATE TABLE IF NOT EXISTS github_project_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_node_id TEXT UNIQUE NOT NULL,
                project_node_id TEXT NOT NULL,
                content_type TEXT NOT NULL,
                content_node_id TEXT,
                issue_number INTEGER,
                pr_number INTEGER,
                title TEXT,
                status_field_value TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,
                FOREIGN KEY (project_node_id) REFERENCES github_projects (project_node_id)
            )
        `;

        const createProjectMilestonesSQL = `
            CREATE TABLE IF NOT EXISTS github_project_milestones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                milestone_node_id TEXT UNIQUE NOT NULL,
                project_node_id TEXT NOT NULL,
                milestone_number INTEGER,
                milestone_title TEXT NOT NULL,
                milestone_description TEXT,
                due_date DATETIME,
                state TEXT DEFAULT 'open',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_node_id) REFERENCES github_projects (project_node_id)
            )
        `;

        await this.dbManager.db.exec(createProjectsTableSQL);
        await this.dbManager.db.exec(createProjectItemsTableSQL);
        await this.dbManager.db.exec(createProjectMilestonesSQL);
    }

    /**
     * Get organization or user projects using GraphQL
     */
    async getProjects(ownerLogin, ownerType = 'organization') {
        const query = ownerType === 'organization' 
            ? `
                query($login: String!, $first: Int!) {
                    organization(login: $login) {
                        projectsV2(first: $first) {
                            nodes {
                                id
                                number
                                title
                                url
                                shortDescription
                                public
                                closed
                                createdAt
                                updatedAt
                                fields(first: 20) {
                                    nodes {
                                        ... on ProjectV2Field {
                                            id
                                            name
                                            dataType
                                        }
                                        ... on ProjectV2IterationField {
                                            id
                                            name
                                            dataType
                                        }
                                        ... on ProjectV2SingleSelectField {
                                            id
                                            name
                                            dataType
                                            options {
                                                id
                                                name
                                                color
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `
            : `
                query($login: String!, $first: Int!) {
                    user(login: $login) {
                        projectsV2(first: $first) {
                            nodes {
                                id
                                number
                                title
                                url
                                shortDescription
                                public
                                closed
                                createdAt
                                updatedAt
                                fields(first: 20) {
                                    nodes {
                                        ... on ProjectV2Field {
                                            id
                                            name
                                            dataType
                                        }
                                        ... on ProjectV2IterationField {
                                            id
                                            name
                                            dataType
                                        }
                                        ... on ProjectV2SingleSelectField {
                                            id
                                            name
                                            dataType
                                            options {
                                                id
                                                name
                                                color
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;

        const response = await this.graphqlWithAuth(query, {
            login: ownerLogin,
            first: 50
        });

        const projects = ownerType === 'organization' 
            ? response.organization.projectsV2.nodes 
            : response.user.projectsV2.nodes;

        // Cache projects and store in database
        for (const project of projects) {
            this.projectsCache.set(project.id, project);
            await this.storeProjectInDatabase(project, ownerType, ownerLogin);
        }

        return projects;
    }

    /**
     * Create a new GitHub Project v2
     */
    async createProject(ownerNodeId, title, description = '') {
        const mutation = `
            mutation($input: CreateProjectV2Input!) {
                createProjectV2(input: $input) {
                    projectV2 {
                        id
                        number
                        title
                        url
                        shortDescription
                        public
                        closed
                        createdAt
                        updatedAt
                    }
                }
            }
        `;

        const response = await this.graphqlWithAuth(mutation, {
            input: {
                ownerId: ownerNodeId,
                title: title,
                ...(description && { shortDescription: description })
            }
        });

        const project = response.createProjectV2.projectV2;
        this.projectsCache.set(project.id, project);

        return project;
    }

    /**
     * Add issue to project
     */
    async addIssueToProject(projectId, issueNodeId) {
        const mutation = `
            mutation($input: AddProjectV2ItemByIdInput!) {
                addProjectV2ItemById(input: $input) {
                    item {
                        id
                        content {
                            ... on Issue {
                                id
                                number
                                title
                                state
                            }
                        }
                        project {
                            id
                            title
                        }
                    }
                }
            }
        `;

        const response = await this.graphqlWithAuth(mutation, {
            input: {
                projectId: projectId,
                contentId: issueNodeId
            }
        });

        return response.addProjectV2ItemById.item;
    }

    /**
     * Update project item field value (e.g., status)
     */
    async updateProjectItemField(projectId, itemId, fieldId, value) {
        // For single select fields (like status)
        const mutation = `
            mutation($input: UpdateProjectV2ItemFieldValueInput!) {
                updateProjectV2ItemFieldValue(input: $input) {
                    projectV2Item {
                        id
                        fieldValues(first: 10) {
                            nodes {
                                ... on ProjectV2ItemFieldSingleSelectValue {
                                    field {
                                        ... on ProjectV2SingleSelectField {
                                            name
                                        }
                                    }
                                    name
                                }
                            }
                        }
                    }
                }
            }
        `;

        const response = await this.graphqlWithAuth(mutation, {
            input: {
                projectId: projectId,
                itemId: itemId,
                fieldId: fieldId,
                value: {
                    singleSelectOptionId: value
                }
            }
        });

        return response.updateProjectV2ItemFieldValue.projectV2Item;
    }

    /**
     * Create issue with automatic project assignment
     */
    async createIssueWithProject(owner, repo, title, body, projectId, labels = []) {
        // Create issue via REST API
        const { data: issue } = await this.octokit.rest.issues.create({
            owner,
            repo,
            title,
            body,
            labels
        });

        // Add to project if projectId provided
        if (projectId) {
            await this.addIssueToProject(projectId, issue.node_id);
        }

        return issue;
    }

    /**
     * Get project items (issues, PRs) with their status
     */
    async getProjectItems(projectId) {
        const query = `
            query($projectId: ID!, $first: Int!) {
                node(id: $projectId) {
                    ... on ProjectV2 {
                        items(first: $first) {
                            nodes {
                                id
                                content {
                                    ... on Issue {
                                        id
                                        number
                                        title
                                        state
                                        assignees(first: 10) {
                                            nodes {
                                                login
                                            }
                                        }
                                    }
                                    ... on PullRequest {
                                        id
                                        number
                                        title
                                        state
                                        assignees(first: 10) {
                                            nodes {
                                                login
                                            }
                                        }
                                    }
                                }
                                fieldValues(first: 8) {
                                    nodes {
                                        ... on ProjectV2ItemFieldTextValue {
                                            text
                                            field {
                                                ... on ProjectV2FieldCommon {
                                                    name
                                                }
                                            }
                                        }
                                        ... on ProjectV2ItemFieldSingleSelectValue {
                                            name
                                            field {
                                                ... on ProjectV2SingleSelectField {
                                                    name
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        `;

        const response = await this.graphqlWithAuth(query, {
            projectId,
            first: 100
        });

        return response.node.items.nodes;
    }

    /**
     * Store project information in database
     */
    async storeProjectInDatabase(project, ownerType, ownerLogin) {
        const stmt = await this.dbManager.db.prepare(`
            INSERT OR REPLACE INTO github_projects 
            (project_node_id, project_number, project_title, project_url, owner_type, owner_login, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        await stmt.run([
            project.id,
            project.number,
            project.title,
            project.url,
            ownerType,
            ownerLogin,
            JSON.stringify(project)
        ]);

        await stmt.finalize();
    }

    /**
     * Get organization or user node ID for creating projects
     */
    async getOwnerNodeId(ownerLogin, ownerType = 'organization') {
        const query = ownerType === 'organization'
            ? `
                query($login: String!) {
                    organization(login: $login) {
                        id
                    }
                }
            `
            : `
                query($login: String!) {
                    user(login: $login) {
                        id
                    }
                }
            `;

        const response = await this.graphqlWithAuth(query, { login: ownerLogin });
        return ownerType === 'organization' ? response.organization.id : response.user.id;
    }

    /**
     * Integration with branch-aware workflows
     */
    async createWorkflowProject(branchName, sessionId, agentTypes) {
        const projectTitle = `LonicFLex Workflow: ${branchName}`;
        const projectDescription = `Multi-agent workflow for branch: ${branchName}. Session: ${sessionId}. Agents: ${agentTypes.join(', ')}`;

        // Get owner node ID (assuming user for now)
        const ownerNodeId = await this.getOwnerNodeId(this.githubConfig.owner || 'levilonic', 'user');

        // Create project
        const project = await this.createProject(ownerNodeId, projectTitle, projectDescription);

        // Create issues for each agent task
        for (const agentType of agentTypes) {
            const issueTitle = `Agent Task: ${agentType}`;
            const issueBody = `
## Agent Task: ${agentType}

**Branch**: ${branchName}
**Session**: ${sessionId}
**Status**: In Progress

This issue tracks the progress of the ${agentType} agent in the multi-agent workflow.

### Tasks:
- [ ] Initialize agent
- [ ] Execute workflow
- [ ] Validate results
- [ ] Generate report

### Workflow Context:
- **Project**: ${project.title}
- **Created**: ${new Date().toISOString()}
            `;

            const issue = await this.createIssueWithProject(
                this.githubConfig.owner || 'levilonic',
                this.githubConfig.repo || 'LonicFLex',
                issueTitle,
                issueBody,
                project.id,
                [`agent:${agentType}`, `workflow:${sessionId}`, `branch:${branchName}`]
            );

            console.log(`✅ Created issue #${issue.number} for ${agentType} agent`);
        }

        console.log(`✅ Created workflow project: ${project.title}`);
        return project;
    }

    /**
     * Update agent progress in project
     */
    async updateAgentProgress(projectId, agentType, status, results = {}) {
        // Find the issue for this agent
        const items = await this.getProjectItems(projectId);
        const agentItem = items.find(item => 
            item.content.title && item.content.title.includes(`Agent Task: ${agentType}`)
        );

        if (agentItem) {
            // Update issue with progress comment
            const comment = `
## Agent Progress Update

**Agent**: ${agentType}
**Status**: ${status}
**Updated**: ${new Date().toISOString()}

### Results:
\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`

### Next Steps:
- ${status === 'completed' ? 'Task completed successfully' : 'Continue processing...'}
            `;

            await this.octokit.rest.issues.createComment({
                owner: this.githubConfig.owner || 'levilonic',
                repo: this.githubConfig.repo || 'LonicFLex',
                issue_number: agentItem.content.number,
                body: comment
            });
        }
    }
}

// Export for use in multi-agent system
module.exports = { GitHubProjectsManager };

// Demo/testing function
async function demoGitHubProjects() {
    console.log('🎯 GitHub Projects Manager Demo');
    
    const projectsManager = new GitHubProjectsManager();
    
    try {
        await projectsManager.initialize();
        
        // Get existing projects
        const projects = await projectsManager.getProjects('levilonic', 'user');
        console.log(`✅ Found ${projects.length} projects`);
        
        if (projects.length > 0) {
            const project = projects[0];
            console.log(`📋 Project: ${project.title} (${project.url})`);
            
            // Get project items
            const items = await projectsManager.getProjectItems(project.id);
            console.log(`📝 Project has ${items.length} items`);
        }
        
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
    }
}

// Run demo if called directly
if (require.main === module) {
    demoGitHubProjects();
}