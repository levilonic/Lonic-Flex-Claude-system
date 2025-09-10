/**
 * Test Script for Project Window System
 * Verifies ProjectAgent integration with LonicFLex multi-agent system
 */

const { MultiAgentCore } = require('./claude-multi-agent-core');
const { SQLiteManager } = require('./database/sqlite-manager');
const { ProjectAgent } = require('./agents/project-agent');
const fs = require('fs').promises;
const path = require('path');

class ProjectSystemTest {
    constructor() {
        this.core = new MultiAgentCore();
        this.testResults = [];
        this.sessionId = `test_session_${Date.now()}`;
    }

    async runTests() {
        console.log('🧪 Starting Project Window System Tests...\n');
        
        try {
            // Test 1: Initialize system
            await this.testSystemInitialization();
            
            // Test 2: Create new project
            await this.testProjectCreation();
            
            // Test 3: Load existing project  
            await this.testProjectLoading();
            
            // Test 4: Save project state
            await this.testProjectStateSave();
            
            // Test 5: List projects
            await this.testProjectListing();
            
            // Test 6: Database integration
            await this.testDatabaseIntegration();
            
            // Test 7: File system integration
            await this.testFileSystemIntegration();
            
            console.log('\n📊 Test Results Summary:');
            console.log(`✅ Passed: ${this.testResults.filter(r => r.passed).length}`);
            console.log(`❌ Failed: ${this.testResults.filter(r => !r.passed).length}`);
            
            if (this.testResults.some(r => !r.passed)) {
                console.log('\n❌ Failed Tests:');
                this.testResults.filter(r => !r.passed).forEach(r => {
                    console.log(`   - ${r.test}: ${r.error}`);
                });
            } else {
                console.log('\n🎉 All tests passed! Project Window System is ready.');
            }
            
        } catch (error) {
            console.error('💥 Test suite failed:', error);
        } finally {
            await this.cleanup();
        }
    }

    async testSystemInitialization() {
        try {
            console.log('🔧 Test 1: System Initialization...');
            
            await this.core.initialize();
            
            // Verify ProjectAgent is registered
            const workflow = await this.core.initializeSession(
                this.sessionId, 
                'project_management',
                { action: 'test' }
            );
            
            const agent = this.core.activeAgents.get('project');
            if (!agent) {
                throw new Error('ProjectAgent not found in active agents');
            }
            
            if (!(agent instanceof ProjectAgent)) {
                throw new Error('Agent is not ProjectAgent instance');
            }
            
            this.recordTest('System Initialization', true);
            console.log('   ✅ Multi-agent core initialized');
            console.log('   ✅ ProjectAgent registered and active');
            console.log('   ✅ Database connection established');
            
        } catch (error) {
            this.recordTest('System Initialization', false, error.message);
            console.log('   ❌ System initialization failed:', error.message);
        }
    }

    async testProjectCreation() {
        try {
            console.log('\n🏗️  Test 2: Project Creation...');
            
            const agent = this.core.activeAgents.get('project');
            const result = await agent.execute({
                action: 'create_project',
                projectName: 'test-project',
                goal: 'Test project creation functionality',
                vision: 'Verify project window system works correctly',
                context: 'Integration test for LonicFLex project system'
            });
            
            if (!result.success) {
                throw new Error('Project creation failed');
            }
            
            if (!result.data.project_id) {
                throw new Error('No project ID returned');
            }
            
            this.testProjectId = result.data.project_id;
            this.testProjectName = result.data.project_name;
            
            this.recordTest('Project Creation', true);
            console.log(`   ✅ Project created: ${result.data.project_name}`);
            console.log(`   ✅ Project ID: ${result.data.project_id}`);
            console.log(`   ✅ Project directory: ${result.data.project_dir}`);
            
        } catch (error) {
            this.recordTest('Project Creation', false, error.message);
            console.log('   ❌ Project creation failed:', error.message);
        }
    }

    async testProjectLoading() {
        try {
            console.log('\n📂 Test 3: Project Loading...');
            
            if (!this.testProjectName) {
                throw new Error('No test project available to load');
            }
            
            const agent = this.core.activeAgents.get('project');
            const result = await agent.execute({
                action: 'load_project',
                projectName: this.testProjectName
            });
            
            if (!result.success) {
                throw new Error('Project loading failed');
            }
            
            if (!result.data.project || !result.data.identity) {
                throw new Error('Project data or identity missing');
            }
            
            this.recordTest('Project Loading', true);
            console.log(`   ✅ Project loaded: ${result.data.project.name}`);
            console.log(`   ✅ Identity file loaded: ${result.data.identity.identity_loaded}`);
            console.log(`   ✅ Project goal: ${result.data.project.goal}`);
            
        } catch (error) {
            this.recordTest('Project Loading', false, error.message);
            console.log('   ❌ Project loading failed:', error.message);
        }
    }

    async testProjectStateSave() {
        try {
            console.log('\n💾 Test 4: Project State Save...');
            
            if (!this.testProjectId) {
                throw new Error('No test project available to save');
            }
            
            // First link session to project
            await this.core.dbManager.linkSessionToProject(
                this.testProjectId,
                this.sessionId,
                'testing'
            );
            
            const agent = this.core.activeAgents.get('project');
            const result = await agent.execute({
                action: 'save_project_state',
                projectId: this.testProjectId,
                status: 'test_completed'
            });
            
            if (!result.success) {
                throw new Error('Project state save failed');
            }
            
            this.recordTest('Project State Save', true);
            console.log(`   ✅ Project state saved: ${result.data.project_id}`);
            console.log(`   ✅ Session linked: ${result.data.session_id}`);
            console.log(`   ✅ Context preserved: ${result.data.context_preserved}`);
            
        } catch (error) {
            this.recordTest('Project State Save', false, error.message);
            console.log('   ❌ Project state save failed:', error.message);
        }
    }

    async testProjectListing() {
        try {
            console.log('\n📋 Test 5: Project Listing...');
            
            const agent = this.core.activeAgents.get('project');
            const result = await agent.execute({
                action: 'list_projects',
                limit: 5
            });
            
            if (!result.success) {
                throw new Error('Project listing failed');
            }
            
            if (!Array.isArray(result.data.projects)) {
                throw new Error('Projects list not returned as array');
            }
            
            if (result.data.projects.length === 0) {
                throw new Error('No projects found (should have test project)');
            }
            
            this.recordTest('Project Listing', true);
            console.log(`   ✅ Projects listed: ${result.data.count} projects`);
            console.log(`   ✅ Test project found: ${result.data.projects.some(p => p.name === this.testProjectName)}`);
            
        } catch (error) {
            this.recordTest('Project Listing', false, error.message);
            console.log('   ❌ Project listing failed:', error.message);
        }
    }

    async testDatabaseIntegration() {
        try {
            console.log('\n🗄️  Test 6: Database Integration...');
            
            // Test direct database methods
            const project = await this.core.dbManager.getProject(this.testProjectName);
            if (!project) {
                throw new Error('Project not found in database');
            }
            
            const sessions = await this.core.dbManager.getProjectSessions(this.testProjectId, 5);
            if (sessions.length === 0) {
                throw new Error('No project sessions found');
            }
            
            // Test context addition
            const contextId = await this.core.dbManager.addProjectContext(
                this.testProjectId,
                'test',
                'Test context item',
                { test: true },
                5,
                this.sessionId
            );
            
            if (!contextId) {
                throw new Error('Context addition failed');
            }
            
            this.recordTest('Database Integration', true);
            console.log(`   ✅ Project found in database: ${project.name}`);
            console.log(`   ✅ Project sessions: ${sessions.length} sessions`);
            console.log(`   ✅ Context added: ID ${contextId}`);
            
        } catch (error) {
            this.recordTest('Database Integration', false, error.message);
            console.log('   ❌ Database integration failed:', error.message);
        }
    }

    async testFileSystemIntegration() {
        try {
            console.log('\n📁 Test 7: File System Integration...');
            
            // Check if PROJECT.md was created
            const projectsDir = './projects';
            const projectDir = path.join(projectsDir, this.testProjectName);
            const projectMdPath = path.join(projectDir, 'PROJECT.md');
            
            try {
                await fs.access(projectDir);
            } catch {
                throw new Error(`Project directory not found: ${projectDir}`);
            }
            
            try {
                const projectMd = await fs.readFile(projectMdPath, 'utf8');
                if (!projectMd.includes('Test project creation functionality')) {
                    throw new Error('PROJECT.md does not contain expected goal');
                }
            } catch (error) {
                throw new Error(`PROJECT.md not found or invalid: ${error.message}`);
            }
            
            this.recordTest('File System Integration', true);
            console.log(`   ✅ Project directory created: ${projectDir}`);
            console.log(`   ✅ PROJECT.md created with correct content`);
            console.log(`   ✅ File system integration working`);
            
        } catch (error) {
            this.recordTest('File System Integration', false, error.message);
            console.log('   ❌ File system integration failed:', error.message);
        }
    }

    recordTest(testName, passed, error = null) {
        this.testResults.push({
            test: testName,
            passed,
            error: error || null,
            timestamp: Date.now()
        });
    }

    async cleanup() {
        try {
            console.log('\n🧹 Cleaning up test data...');
            
            // Clean up test project directory
            if (this.testProjectName) {
                const projectDir = path.join('./projects', this.testProjectName);
                try {
                    await fs.rm(projectDir, { recursive: true, force: true });
                    console.log('   ✅ Test project directory removed');
                } catch (error) {
                    console.log('   ⚠️ Could not remove test project directory:', error.message);
                }
            }
            
            // Close database connection
            await this.core.dbManager.close();
            console.log('   ✅ Database connection closed');
            
        } catch (error) {
            console.log('   ⚠️ Cleanup error:', error.message);
        }
    }
}

// Run tests if called directly
if (require.main === module) {
    const test = new ProjectSystemTest();
    test.runTests().catch(console.error);
}

module.exports = { ProjectSystemTest };