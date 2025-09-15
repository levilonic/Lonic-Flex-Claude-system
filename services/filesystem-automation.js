/**
 * File System Automation Service
 * Provides safe file operations with atomic operations and rollback capability
 * Part of Phase 2 Task 2.2: File System Automation Layer
 */

const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { createHash } = require('crypto');

class FileSystemAutomation {
    constructor(config = {}) {
        this.config = {
            backupDir: config.backupDir || path.join(process.cwd(), '.lonicflex-backups'),
            enableBackups: config.enableBackups !== false,
            verifyWrites: config.verifyWrites !== false,
            maxBackupAge: config.maxBackupAge || 7 * 24 * 60 * 60 * 1000, // 7 days
            ...config
        };
        
        // Operation tracking
        this.operations = new Map();
        this.rollbackLog = [];
        
        // Initialize backup directory
        this.initializeBackupDirectory();
    }
    
    /**
     * Initialize backup directory structure
     */
    async initializeBackupDirectory() {
        try {
            await fs.mkdir(this.config.backupDir, { recursive: true });
            console.log(`📁 Backup directory initialized: ${this.config.backupDir}`);
        } catch (error) {
            console.error('❌ Failed to initialize backup directory:', error.message);
            throw error;
        }
    }
    
    /**
     * Write file with atomic operations and backup
     */
    async writeFile(filePath, content, options = {}) {
        const operationId = uuidv4();
        const operation = {
            id: operationId,
            type: 'writeFile',
            filePath: filePath,
            timestamp: Date.now(),
            backupPath: null,
            tempPath: null,
            originalExists: false
        };
        
        try {
            console.log(`📝 Starting atomic write: ${filePath} (${operationId})`);
            
            // Step 1: Check if original file exists
            operation.originalExists = await this.fileExists(filePath);
            
            // Step 2: Create backup if original exists
            if (operation.originalExists && this.config.enableBackups) {
                operation.backupPath = await this.createBackup(filePath, operationId);
                console.log(`💾 Backup created: ${operation.backupPath}`);
            }
            
            // Step 3: Write to temporary file first (atomic operation)
            const dir = path.dirname(filePath);
            await fs.mkdir(dir, { recursive: true });
            
            operation.tempPath = `${filePath}.tmp.${operationId}`;
            await fs.writeFile(operation.tempPath, content, options.encoding || 'utf8');
            
            // Step 4: Verify write if enabled
            if (this.config.verifyWrites) {
                await this.verifyFileWrite(operation.tempPath, content);
            }
            
            // Step 5: Atomic rename (this is the critical atomic operation)
            await fs.rename(operation.tempPath, filePath);
            operation.tempPath = null; // Clear temp path since it no longer exists
            
            // Step 6: Log successful operation
            this.operations.set(operationId, operation);
            console.log(`✅ Atomic write completed: ${filePath}`);
            
            return {
                success: true,
                operationId: operationId,
                filePath: filePath,
                backupPath: operation.backupPath,
                bytesWritten: Buffer.byteLength(content, options.encoding || 'utf8')
            };
            
        } catch (error) {
            // Cleanup on failure
            await this.cleanupFailedOperation(operation);
            
            console.error(`❌ Atomic write failed for ${filePath}:`, error.message);
            throw new Error(`File write operation failed: ${error.message}`);
        }
    }
    
    /**
     * Read file with error handling
     */
    async readFile(filePath, options = {}) {
        try {
            const content = await fs.readFile(filePath, options.encoding || 'utf8');
            return {
                success: true,
                filePath: filePath,
                content: content,
                size: Buffer.byteLength(content, options.encoding || 'utf8')
            };
        } catch (error) {
            if (error.code === 'ENOENT') {
                return {
                    success: false,
                    error: 'File not found',
                    filePath: filePath
                };
            }
            throw error;
        }
    }
    
    /**
     * Create directory structure with parents
     */
    async createDirectory(dirPath, options = {}) {
        const operationId = uuidv4();
        
        try {
            await fs.mkdir(dirPath, { recursive: true, ...options });
            
            console.log(`📁 Directory created: ${dirPath}`);
            return {
                success: true,
                operationId: operationId,
                dirPath: dirPath
            };
            
        } catch (error) {
            console.error(`❌ Directory creation failed: ${dirPath}`, error.message);
            throw error;
        }
    }
    
    /**
     * Copy file with atomic operations
     */
    async copyFile(sourcePath, destPath, options = {}) {
        const operationId = uuidv4();
        
        try {
            console.log(`📋 Copying file: ${sourcePath} -> ${destPath}`);
            
            // Read source file
            const sourceContent = await fs.readFile(sourcePath);
            
            // Write to destination using atomic write
            const writeResult = await this.writeFile(destPath, sourceContent, {
                encoding: null, // Preserve binary content
                ...options
            });
            
            return {
                success: true,
                operationId: operationId,
                sourcePath: sourcePath,
                destPath: destPath,
                writeOperationId: writeResult.operationId,
                bytesWritten: writeResult.bytesWritten
            };
            
        } catch (error) {
            console.error(`❌ File copy failed: ${sourcePath} -> ${destPath}`, error.message);
            throw error;
        }
    }
    
    /**
     * Delete file with backup
     */
    async deleteFile(filePath, options = {}) {
        const operationId = uuidv4();
        const operation = {
            id: operationId,
            type: 'deleteFile',
            filePath: filePath,
            timestamp: Date.now(),
            backupPath: null
        };
        
        try {
            console.log(`🗑️ Deleting file: ${filePath} (${operationId})`);
            
            // Check if file exists
            if (!await this.fileExists(filePath)) {
                return {
                    success: true,
                    message: 'File already does not exist',
                    operationId: operationId,
                    filePath: filePath
                };
            }
            
            // Create backup before deletion
            if (this.config.enableBackups && !options.skipBackup) {
                operation.backupPath = await this.createBackup(filePath, operationId);
                console.log(`💾 Backup before deletion: ${operation.backupPath}`);
            }
            
            // Delete the file
            await fs.unlink(filePath);
            
            // Log operation
            this.operations.set(operationId, operation);
            console.log(`✅ File deleted: ${filePath}`);
            
            return {
                success: true,
                operationId: operationId,
                filePath: filePath,
                backupPath: operation.backupPath
            };
            
        } catch (error) {
            console.error(`❌ File deletion failed: ${filePath}`, error.message);
            throw error;
        }
    }
    
    /**
     * Rollback operation by ID
     */
    async rollback(operationId) {
        const operation = this.operations.get(operationId);
        if (!operation) {
            throw new Error(`Operation ${operationId} not found`);
        }
        
        try {
            console.log(`🔄 Rolling back operation: ${operationId}`);
            
            switch (operation.type) {
                case 'writeFile':
                    await this.rollbackWriteFile(operation);
                    break;
                case 'deleteFile':
                    await this.rollbackDeleteFile(operation);
                    break;
                default:
                    throw new Error(`Rollback not supported for operation type: ${operation.type}`);
            }
            
            // Log rollback
            this.rollbackLog.push({
                operationId: operationId,
                rolledBackAt: Date.now(),
                operation: { ...operation }
            });
            
            // Remove from active operations
            this.operations.delete(operationId);
            
            console.log(`✅ Rollback completed: ${operationId}`);
            return {
                success: true,
                operationId: operationId,
                rolledBackAt: Date.now()
            };
            
        } catch (error) {
            console.error(`❌ Rollback failed for ${operationId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Rollback write file operation
     */
    async rollbackWriteFile(operation) {
        if (operation.originalExists && operation.backupPath) {
            // Restore from backup
            await fs.copyFile(operation.backupPath, operation.filePath);
            console.log(`🔄 File restored from backup: ${operation.filePath}`);
        } else {
            // File didn't exist originally, so delete it
            if (await this.fileExists(operation.filePath)) {
                await fs.unlink(operation.filePath);
                console.log(`🔄 New file deleted: ${operation.filePath}`);
            }
        }
    }
    
    /**
     * Rollback delete file operation
     */
    async rollbackDeleteFile(operation) {
        if (operation.backupPath && await this.fileExists(operation.backupPath)) {
            // Restore from backup
            await fs.copyFile(operation.backupPath, operation.filePath);
            console.log(`🔄 Deleted file restored: ${operation.filePath}`);
        } else {
            throw new Error(`Cannot rollback deletion: no backup found for ${operation.filePath}`);
        }
    }
    
    /**
     * Create project structure from template
     */
    async createProjectStructure(projectPath, template) {
        const operationId = uuidv4();
        const createdItems = [];
        
        try {
            console.log(`🏗️ Creating project structure: ${projectPath} (template: ${template})`);
            
            // Load template configuration
            const templateConfig = await this.loadTemplate(template);
            
            // Create base directory
            await this.createDirectory(projectPath);
            createdItems.push({ type: 'directory', path: projectPath });
            
            // Create directories
            for (const dir of templateConfig.directories || []) {
                const fullPath = path.join(projectPath, dir);
                await this.createDirectory(fullPath);
                createdItems.push({ type: 'directory', path: fullPath });
            }
            
            // Create files
            for (const file of templateConfig.files || []) {
                const fullPath = path.join(projectPath, file.path);
                const content = await this.processTemplate(file.template, templateConfig.variables || {});
                
                const writeResult = await this.writeFile(fullPath, content);
                createdItems.push({ 
                    type: 'file', 
                    path: fullPath, 
                    operationId: writeResult.operationId 
                });
            }
            
            console.log(`✅ Project structure created: ${createdItems.length} items`);
            
            return {
                success: true,
                operationId: operationId,
                projectPath: projectPath,
                template: template,
                createdItems: createdItems
            };
            
        } catch (error) {
            console.error(`❌ Project structure creation failed:`, error.message);
            
            // Cleanup created items on failure
            await this.cleanupProjectStructure(createdItems);
            throw error;
        }
    }
    
    /**
     * Load template configuration
     */
    async loadTemplate(templateName) {
        // For now, return basic templates - this could be enhanced to load from files
        const templates = {
            'basic-node': {
                directories: ['src', 'test', 'config'],
                files: [
                    { 
                        path: 'package.json', 
                        template: '{\n  "name": "{{projectName}}",\n  "version": "1.0.0",\n  "main": "src/index.js"\n}'
                    },
                    {
                        path: 'src/index.js',
                        template: '// {{projectName}} main entry point\nconsole.log("Hello from {{projectName}}");\n'
                    },
                    {
                        path: 'README.md',
                        template: '# {{projectName}}\n\nGenerated by LonicFLex File System Automation\n'
                    }
                ],
                variables: {
                    projectName: 'new-project'
                }
            },
            'autonomous-service': {
                directories: ['services', 'config', 'logs'],
                files: [
                    {
                        path: 'services/autonomous-service.js',
                        template: '// Autonomous service for {{projectName}}\n// Generated by LonicFLex\n'
                    }
                ],
                variables: {
                    projectName: 'autonomous-service'
                }
            }
        };
        
        const template = templates[templateName];
        if (!template) {
            throw new Error(`Template not found: ${templateName}`);
        }
        
        return template;
    }
    
    /**
     * Process template with variable substitution
     */
    async processTemplate(templateContent, variables) {
        let processed = templateContent;
        
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = new RegExp(`{{${key}}}`, 'g');
            processed = processed.replace(placeholder, value);
        }
        
        return processed;
    }
    
    /**
     * Helper methods
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    async createBackup(filePath, operationId) {
        const timestamp = Date.now();
        const filename = path.basename(filePath);
        const backupFilename = `${filename}.backup.${operationId}.${timestamp}`;
        const backupPath = path.join(this.config.backupDir, backupFilename);
        
        await fs.copyFile(filePath, backupPath);
        return backupPath;
    }
    
    async verifyFileWrite(tempPath, expectedContent) {
        const actualContent = await fs.readFile(tempPath, 'utf8');
        if (actualContent !== expectedContent) {
            throw new Error('File write verification failed: content mismatch');
        }
    }
    
    async cleanupFailedOperation(operation) {
        try {
            // Remove temp file if it exists
            if (operation.tempPath && await this.fileExists(operation.tempPath)) {
                await fs.unlink(operation.tempPath);
            }
        } catch (error) {
            console.error('Cleanup error:', error.message);
        }
    }
    
    async cleanupProjectStructure(createdItems) {
        console.log('🧹 Cleaning up failed project structure...');
        
        // Delete in reverse order (files first, then directories)
        const sortedItems = [...createdItems].reverse();
        
        for (const item of sortedItems) {
            try {
                if (item.type === 'file') {
                    if (await this.fileExists(item.path)) {
                        await fs.unlink(item.path);
                    }
                } else if (item.type === 'directory') {
                    try {
                        await fs.rmdir(item.path);
                    } catch (error) {
                        // Directory might not be empty, that's okay
                        if (error.code !== 'ENOTEMPTY') {
                            throw error;
                        }
                    }
                }
            } catch (error) {
                console.error(`Cleanup error for ${item.path}:`, error.message);
            }
        }
    }
    
    /**
     * Get operation status
     */
    getOperationStatus(operationId) {
        const operation = this.operations.get(operationId);
        if (!operation) {
            const rollback = this.rollbackLog.find(r => r.operationId === operationId);
            if (rollback) {
                return { status: 'rolled_back', rollback: rollback };
            }
            return { status: 'not_found' };
        }
        
        return { status: 'completed', operation: operation };
    }
    
    /**
     * List all active operations
     */
    listOperations() {
        return {
            active: Array.from(this.operations.values()),
            rolledBack: this.rollbackLog
        };
    }
    
    /**
     * Cleanup old backups
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.config.backupDir);
            const now = Date.now();
            let cleanedCount = 0;
            
            for (const file of files) {
                if (!file.includes('.backup.')) continue;
                
                const filePath = path.join(this.config.backupDir, file);
                const stats = await fs.stat(filePath);
                
                if (now - stats.mtime.getTime() > this.config.maxBackupAge) {
                    await fs.unlink(filePath);
                    cleanedCount++;
                }
            }
            
            console.log(`🧹 Cleaned up ${cleanedCount} old backup files`);
            return { cleanedCount };
            
        } catch (error) {
            console.error('❌ Backup cleanup failed:', error.message);
            throw error;
        }
    }
}

module.exports = { FileSystemAutomation };

// If run directly, demonstrate the service
if (require.main === module) {
    (async () => {
        console.log('🧪 Testing File System Automation Service...');
        
        const fsService = new FileSystemAutomation({
            backupDir: path.join(__dirname, '..', '.test-backups')
        });
        
        try {
            // Test file write
            const writeResult = await fsService.writeFile(
                path.join(__dirname, '..', 'test-file.txt'),
                'Hello from File System Automation!'
            );
            console.log('Write result:', writeResult);
            
            // Test file read
            const readResult = await fsService.readFile(writeResult.filePath);
            console.log('Read result:', readResult.content);
            
            // Test project structure creation
            const projectResult = await fsService.createProjectStructure(
                path.join(__dirname, '..', 'test-project'),
                'basic-node'
            );
            console.log('Project structure created:', projectResult.createdItems.length, 'items');
            
            console.log('✅ File System Automation Service test completed');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        }
    })();
}