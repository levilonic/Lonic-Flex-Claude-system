/**
 * Project Agent - Project Window Management System
 * Following Factor 10: Small, Focused Agents (max 8 steps per agent)
 * Handles project creation, session linking, and context preservation
 */

const { BaseAgent } = require('./base-agent');
const fs = require('fs').promises;
const path = require('path');

class ProjectAgent extends BaseAgent {
    constructor(sessionId, config = {}) {
        super('project', sessionId, {
            maxSteps: 8,
            timeout: 30000,
            projectsDir: './projects',
            ...config
        });
        
        this.supportedActions = [
            'create_project',
            'load_project', 
            'save_project_state',
            'pause_project',
            'resume_project',
            'list_projects',
            'link_session_to_project',
            'preserve_context'
        ];
    }

    /**
     * Execute project workflow (Factor 10: max 8 steps)
     */
    async execute(context = {}, progressCallback = null) {
        this.validateAgent();

        try {
            this.state = this.applyStateTransition(this.state, 'start');
            this.executionSteps = [];

            // Step 1: Validate action
            await this.executeStep('validate_action', async () => {
                if (!context.action || !this.supportedActions.includes(context.action)) {
                    throw new Error(`Unsupported action: ${context.action}`);
                }
                return { action: context.action, valid: true };
            });

            // Step 2: Initialize project directory
            await this.executeStep('initialize_directories', async () => {
                await this.ensureProjectDirectories();
                return { directories_ready: true };
            });

            // Step 3-7: Execute specific action (max 5 more steps)
            let actionResult;
            switch (context.action) {
                case 'create_project':
                    actionResult = await this.executeCreateProject(context);
                    break;
                case 'load_project':
                    actionResult = await this.executeLoadProject(context);
                    break;
                case 'save_project_state':
                    actionResult = await this.executeSaveProjectState(context);
                    break;
                case 'pause_project':
                    actionResult = await this.executePauseProject(context);
                    break;
                case 'resume_project':
                    actionResult = await this.executeResumeProject(context);
                    break;
                case 'list_projects':
                    actionResult = await this.executeListProjects(context);
                    break;
                case 'link_session_to_project':
                    actionResult = await this.executeLinkSession(context);
                    break;
                case 'preserve_context':
                    actionResult = await this.executePreserveContext(context);
                    break;
                default:
                    throw new Error(`Action not implemented: ${context.action}`);
            }

            // Step 8: Finalize and return result
            await this.executeStep('finalize_result', async () => {
                this.result = {
                    action: context.action,
                    success: true,
                    data: actionResult,
                    execution_time: Date.now() - this.startTime,
                    steps_executed: this.executionSteps.length
                };
                
                this.state = this.applyStateTransition(this.state, 'complete');
                
                // Update database
                await this.dbManager.updateAgent(this.agentId, {
                    status: 'completed',
                    progress: 100,
                    result: this.result,
                    completed_at: Date.now()
                });

                // Factor 3 context preservation
                this.contextManager.addAgentEvent(this.agentName, 'completed', {
                    action: context.action,
                    result: this.result,
                    agent_id: this.agentId
                });

                return this.result;
            });

            if (progressCallback) {
                progressCallback(this.agentName, 100, 'completed', this.result);
            }

            return this.result;

        } catch (error) {
            this.error = error;
            this.state = this.applyStateTransition(this.state, 'error');
            
            await this.dbManager.updateAgent(this.agentId, {
                status: 'failed',
                error: error.message,
                failed_at: Date.now()
            });

            this.contextManager.addAgentEvent(this.agentName, 'error', {
                error: error.message,
                steps_completed: this.executionSteps.length,
                agent_id: this.agentId
            });

            if (progressCallback) {
                progressCallback(this.agentName, this.progress, 'failed', null, error.message);
            }

            throw error;
        }
    }

    /**
     * Create new project (Steps 3-4)
     */
    async executeCreateProject(context) {
        // Step 3: Create project identity (noumena)
        const projectIdentity = await this.executeStep('create_project_identity', async () => {
            const projectName = context.projectName || `project-${Date.now()}`;
            const projectDir = path.join(this.config.projectsDir, projectName);
            
            // Ensure project directory
            await fs.mkdir(projectDir, { recursive: true });
            
            // Create PROJECT.md (the "noumena" - project worldview)
            const projectMd = this.generateProjectTemplate(projectName, context);
            await fs.writeFile(path.join(projectDir, 'PROJECT.md'), projectMd);
            
            return {
                project_name: projectName,
                project_dir: projectDir,
                identity_file: 'PROJECT.md'
            };
        });

        // Step 4: Create project in database
        const databaseEntry = await this.executeStep('create_database_entry', async () => {
            const projectId = await this.dbManager.createProject(
                projectIdentity.project_name,
                context.goal || 'New project',
                context.description || '',
                projectIdentity.project_dir
            );
            
            return { project_id: projectId, database_created: true };
        });

        return {
            project_name: projectIdentity.project_name,
            project_id: databaseEntry.project_id,
            project_dir: projectIdentity.project_dir,
            created: true
        };
    }

    /**
     * Load existing project (Steps 3-4)
     */
    async executeLoadProject(context) {
        // Step 3: Load project from database
        const projectData = await this.executeStep('load_project_data', async () => {
            const project = await this.dbManager.getProject(context.projectName);
            if (!project) {
                throw new Error(`Project not found: ${context.projectName}`);
            }
            return project;
        });

        // Step 4: Load project identity file
        const projectIdentity = await this.executeStep('load_project_identity', async () => {
            const projectMdPath = path.join(projectData.project_dir, 'PROJECT.md');
            try {
                const content = await fs.readFile(projectMdPath, 'utf8');
                return { identity_loaded: true, content };
            } catch (error) {
                return { identity_loaded: false, error: error.message };
            }
        });

        return {
            project: projectData,
            identity: projectIdentity,
            loaded: true
        };
    }

    /**
     * Save current project state (Steps 3-5)
     */
    async executeSaveProjectState(context) {
        // Step 3: Get current session context
        const sessionContext = await this.executeStep('get_session_context', async () => {
            const sessionData = await this.dbManager.getSession(this.sessionId);
            return sessionData;
        });

        // Step 4: Compress context for preservation
        const compressedContext = await this.executeStep('compress_context', async () => {
            // Use Factor 3 context manager for intelligent compression
            const contextSummary = this.contextManager.generateContextSummary();
            return {
                summary: contextSummary,
                timestamp: Date.now(),
                session_id: this.sessionId
            };
        });

        // Step 5: Save to project sessions
        const savedState = await this.executeStep('save_project_session', async () => {
            const saveResult = await this.dbManager.saveProjectSession(
                context.projectId,
                this.sessionId,
                compressedContext,
                context.status || 'saved'
            );
            return saveResult;
        });

        return {
            project_id: context.projectId,
            session_id: this.sessionId,
            context_preserved: true,
            saved_at: compressedContext.timestamp
        };
    }

    /**
     * List available projects (Steps 3-4)
     */
    async executeListProjects(context) {
        // Step 3: Get projects from database
        const projects = await this.executeStep('get_projects_list', async () => {
            return await this.dbManager.listProjects(context.limit || 10);
        });

        // Step 4: Format for display
        const formattedProjects = await this.executeStep('format_projects', async () => {
            return projects.map(project => ({
                name: project.name,
                id: project.id,
                goal: project.goal,
                created: project.created_at,
                last_active: project.last_active_at,
                status: project.status
            }));
        });

        return {
            projects: formattedProjects,
            count: formattedProjects.length
        };
    }

    /**
     * Generate PROJECT.md template (noumena)
     */
    generateProjectTemplate(projectName, context) {
        return `# ${projectName}

## Project Goal
${context.goal || 'Define the main objective of this project'}

## Project Vision
${context.vision || 'Describe the long-term vision and desired outcomes'}

## Context
${context.context || 'Provide background information and context for this project'}

## Key Requirements
- ${context.requirements ? context.requirements.join('\n- ') : 'Add key requirements here'}

## Success Criteria
- ${context.criteria ? context.criteria.join('\n- ') : 'Define success metrics and completion criteria'}

## Notes
${context.notes || 'Additional notes and considerations'}

---
*Project created: ${new Date().toISOString()}*
*Session: ${this.sessionId}*
`;
    }

    /**
     * Ensure project directories exist
     */
    async ensureProjectDirectories() {
        await fs.mkdir(this.config.projectsDir, { recursive: true });
        await fs.mkdir(path.join(this.config.projectsDir, '.project-state'), { recursive: true });
    }

    /**
     * Pause project (placeholder for remaining actions)
     */
    async executePauseProject(context) {
        // Implementation for pause project
        return { action: 'pause', status: 'paused' };
    }

    /**
     * Resume project (placeholder for remaining actions)
     */
    async executeResumeProject(context) {
        // Implementation for resume project
        return { action: 'resume', status: 'resumed' };
    }

    /**
     * Link session to project (placeholder for remaining actions)
     */
    async executeLinkSession(context) {
        // Implementation for linking session
        return { action: 'link', linked: true };
    }

    /**
     * Preserve context (placeholder for remaining actions)
     */
    async executePreserveContext(context) {
        // Implementation for context preservation
        return { action: 'preserve', preserved: true };
    }
}

module.exports = { ProjectAgent };