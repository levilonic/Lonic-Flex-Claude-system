const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const winston = require('winston');
const archiver = require('archiver');
const { createReadStream, createWriteStream } = require('fs');

class BackupRecoverySystem {
    constructor() {
        this.config = {
            enabled: true,
            backupPath: './backups',
            schedule: {
                enabled: true,
                frequency: 'daily', // daily, weekly, hourly
                time: '03:00',
                retention: 30 // days
            },
            compression: true,
            encryption: false,
            targets: [
                'database',
                'configuration',
                'logs',
                'uploads'
            ],
            excludePatterns: [
                'node_modules',
                '.git',
                'temp',
                '.cache'
            ]
        };
        
        this.backupHistory = new Map();
        this.setupLogger();
    }

    setupLogger() {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'logs/backup.log' }),
                new winston.transports.Console()
            ]
        });
    }

    async initialize() {
        try {
            await this.createDirectories();
            await this.loadConfiguration();
            await this.loadBackupHistory();
            
            if (this.config.schedule.enabled) {
                this.scheduleBackups();
            }
            
            this.logger.info('Backup and recovery system initialized');
            return true;
        } catch (error) {
            this.logger.error('Failed to initialize backup system:', error);
            throw error;
        }
    }

    async createDirectories() {
        const dirs = [
            this.config.backupPath,
            path.join(this.config.backupPath, 'database'),
            path.join(this.config.backupPath, 'configuration'),
            path.join(this.config.backupPath, 'logs'),
            path.join(this.config.backupPath, 'full'),
            path.join(this.config.backupPath, 'incremental')
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }
    }

    async createBackup(type = 'full', options = {}) {
        const backupId = this.generateBackupId();
        const timestamp = Date.now();
        
        const backup = {
            id: backupId,
            type,
            timestamp,
            status: 'in_progress',
            targets: options.targets || this.config.targets,
            size: 0,
            files: [],
            metadata: {
                version: '1.0.0',
                nodeVersion: process.version,
                platform: process.platform
            }
        };

        this.backupHistory.set(backupId, backup);
        this.logger.info(`Starting ${type} backup: ${backupId}`);

        try {
            for (const target of backup.targets) {
                await this.backupTarget(target, backupId);
            }

            if (type === 'full' && this.config.compression) {
                await this.compressBackup(backupId);
            }

            if (this.config.encryption) {
                await this.encryptBackup(backupId);
            }

            backup.status = 'completed';
            backup.completedAt = Date.now();
            backup.duration = backup.completedAt - timestamp;
            
            await this.saveBackupManifest(backup);
            await this.cleanupOldBackups();
            
            this.logger.info(`Backup completed: ${backupId} (${this.formatSize(backup.size)})`);
            
            return backup;
        } catch (error) {
            backup.status = 'failed';
            backup.error = error.message;
            this.logger.error(`Backup failed: ${backupId}`, error);
            throw error;
        }
    }

    async backupTarget(target, backupId) {
        const backupDir = path.join(this.config.backupPath, target);
        
        switch (target) {
            case 'database':
                await this.backupDatabase(backupDir, backupId);
                break;
            case 'configuration':
                await this.backupConfiguration(backupDir, backupId);
                break;
            case 'logs':
                await this.backupLogs(backupDir, backupId);
                break;
            case 'uploads':
                await this.backupUploads(backupDir, backupId);
                break;
            default:
                throw new Error(`Unknown backup target: ${target}`);
        }
    }

    async backupDatabase(backupDir, backupId) {
        const dbPath = './database/agents.db';
        const backupFile = path.join(backupDir, `agents_${backupId}.db`);
        
        try {
            // Check if database exists
            await fs.access(dbPath);
            
            // Create backup using SQLite backup command
            const backup = this.backupHistory.get(backupId);
            
            // Copy database file
            await fs.copyFile(dbPath, backupFile);
            
            // Get file size
            const stats = await fs.stat(backupFile);
            backup.size += stats.size;
            backup.files.push({
                type: 'database',
                source: dbPath,
                backup: backupFile,
                size: stats.size
            });
            
            this.logger.info(`Database backed up: ${this.formatSize(stats.size)}`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                this.logger.warn('Database file not found, skipping database backup');
            } else {
                throw error;
            }
        }
    }

    async backupConfiguration(backupDir, backupId) {
        const configSources = [
            'config/',
            '.env*',
            'package.json',
            'docker-compose.yml',
            'Dockerfile'
        ];
        
        const backup = this.backupHistory.get(backupId);
        
        for (const source of configSources) {
            try {
                const files = await this.findFiles(source);
                
                for (const file of files) {
                    const relativePath = path.relative('.', file);
                    const backupFile = path.join(backupDir, `${backupId}_${relativePath.replace(/[/\\]/g, '_')}`);
                    
                    await fs.copyFile(file, backupFile);
                    
                    const stats = await fs.stat(backupFile);
                    backup.size += stats.size;
                    backup.files.push({
                        type: 'configuration',
                        source: file,
                        backup: backupFile,
                        size: stats.size
                    });
                }
            } catch (error) {
                // Source not found, continue
            }
        }
        
        this.logger.info(`Configuration backed up: ${backup.files.filter(f => f.type === 'configuration').length} files`);
    }

    async backupLogs(backupDir, backupId) {
        const logsDir = './logs';
        const backup = this.backupHistory.get(backupId);
        
        try {
            const logFiles = await this.findFiles(path.join(logsDir, '*.log'));
            
            // Only backup recent log files (last 7 days)
            const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
            
            for (const logFile of logFiles) {
                try {
                    const stats = await fs.stat(logFile);
                    if (stats.mtime.getTime() > weekAgo) {
                        const backupFile = path.join(backupDir, `${backupId}_${path.basename(logFile)}`);
                        await fs.copyFile(logFile, backupFile);
                        
                        backup.size += stats.size;
                        backup.files.push({
                            type: 'logs',
                            source: logFile,
                            backup: backupFile,
                            size: stats.size
                        });
                    }
                } catch (error) {
                    // File access error, skip
                }
            }
            
            this.logger.info(`Logs backed up: ${backup.files.filter(f => f.type === 'logs').length} files`);
        } catch (error) {
            this.logger.warn('Logs directory not found, skipping logs backup');
        }
    }

    async backupUploads(backupDir, backupId) {
        const uploadsDir = './uploads';
        const backup = this.backupHistory.get(backupId);
        
        try {
            const uploadFiles = await this.findFiles(path.join(uploadsDir, '**/*'));
            
            for (const file of uploadFiles) {
                try {
                    const stats = await fs.stat(file);
                    if (stats.isFile()) {
                        const relativePath = path.relative(uploadsDir, file);
                        const backupFile = path.join(backupDir, `${backupId}_${relativePath.replace(/[/\\]/g, '_')}`);
                        
                        await fs.copyFile(file, backupFile);
                        
                        backup.size += stats.size;
                        backup.files.push({
                            type: 'uploads',
                            source: file,
                            backup: backupFile,
                            size: stats.size
                        });
                    }
                } catch (error) {
                    // File access error, skip
                }
            }
            
            this.logger.info(`Uploads backed up: ${backup.files.filter(f => f.type === 'uploads').length} files`);
        } catch (error) {
            this.logger.warn('Uploads directory not found, skipping uploads backup');
        }
    }

    async compressBackup(backupId) {
        const backup = this.backupHistory.get(backupId);
        const archiveFile = path.join(this.config.backupPath, 'full', `backup_${backupId}.tar.gz`);
        
        return new Promise((resolve, reject) => {
            const archive = archiver('tar', {
                gzip: true,
                gzipOptions: { level: 9 }
            });
            
            const output = createWriteStream(archiveFile);
            
            archive.on('error', reject);
            output.on('close', async () => {
                try {
                    const stats = await fs.stat(archiveFile);
                    backup.compressed = {
                        file: archiveFile,
                        size: stats.size,
                        originalSize: backup.size,
                        ratio: (1 - stats.size / backup.size) * 100
                    };
                    
                    this.logger.info(`Backup compressed: ${this.formatSize(stats.size)} (${backup.compressed.ratio.toFixed(1)}% saved)`);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
            
            archive.pipe(output);
            
            // Add all backup files to archive
            for (const file of backup.files) {
                archive.file(file.backup, { name: path.basename(file.backup) });
            }
            
            archive.finalize();
        });
    }

    async restoreBackup(backupId, options = {}) {
        const backup = this.backupHistory.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        if (backup.status !== 'completed') {
            throw new Error(`Backup is not completed: ${backup.status}`);
        }

        this.logger.info(`Starting restore from backup: ${backupId}`);

        try {
            const targets = options.targets || backup.targets;
            
            for (const target of targets) {
                await this.restoreTarget(target, backup, options);
            }
            
            this.logger.info(`Restore completed from backup: ${backupId}`);
            
            return {
                backupId,
                restoredTargets: targets,
                timestamp: Date.now()
            };
        } catch (error) {
            this.logger.error(`Restore failed from backup: ${backupId}`, error);
            throw error;
        }
    }

    async restoreTarget(target, backup, options) {
        const targetFiles = backup.files.filter(f => f.type === target);
        
        if (targetFiles.length === 0) {
            this.logger.warn(`No files to restore for target: ${target}`);
            return;
        }

        for (const file of targetFiles) {
            try {
                if (options.dryRun) {
                    this.logger.info(`Would restore: ${file.source} from ${file.backup}`);
                    continue;
                }

                // Create directory if needed
                await fs.mkdir(path.dirname(file.source), { recursive: true });
                
                // Restore file
                await fs.copyFile(file.backup, file.source);
                
                this.logger.info(`Restored: ${file.source}`);
            } catch (error) {
                this.logger.error(`Failed to restore ${file.source}:`, error);
                if (!options.continueOnError) {
                    throw error;
                }
            }
        }
        
        this.logger.info(`Target restored: ${target} (${targetFiles.length} files)`);
    }

    async listBackups(filter = {}) {
        const backups = Array.from(this.backupHistory.values());
        
        let filtered = backups;
        
        if (filter.type) {
            filtered = filtered.filter(b => b.type === filter.type);
        }
        
        if (filter.status) {
            filtered = filtered.filter(b => b.status === filter.status);
        }
        
        if (filter.since) {
            filtered = filtered.filter(b => b.timestamp >= filter.since);
        }
        
        return filtered.sort((a, b) => b.timestamp - a.timestamp);
    }

    async deleteBackup(backupId) {
        const backup = this.backupHistory.get(backupId);
        if (!backup) {
            throw new Error(`Backup not found: ${backupId}`);
        }

        this.logger.info(`Deleting backup: ${backupId}`);

        try {
            // Delete backup files
            for (const file of backup.files) {
                try {
                    await fs.unlink(file.backup);
                } catch (error) {
                    // File already deleted or doesn't exist
                }
            }

            // Delete compressed archive if exists
            if (backup.compressed) {
                try {
                    await fs.unlink(backup.compressed.file);
                } catch (error) {
                    // File already deleted or doesn't exist
                }
            }

            // Remove from history
            this.backupHistory.delete(backupId);
            await this.saveBackupHistory();

            this.logger.info(`Backup deleted: ${backupId}`);
        } catch (error) {
            this.logger.error(`Failed to delete backup: ${backupId}`, error);
            throw error;
        }
    }

    async cleanupOldBackups() {
        const retentionTime = this.config.schedule.retention * 24 * 60 * 60 * 1000;
        const cutoffTime = Date.now() - retentionTime;
        
        const oldBackups = Array.from(this.backupHistory.values())
            .filter(backup => backup.timestamp < cutoffTime && backup.status === 'completed');
        
        for (const backup of oldBackups) {
            try {
                await this.deleteBackup(backup.id);
                this.logger.info(`Cleaned up old backup: ${backup.id}`);
            } catch (error) {
                this.logger.error(`Failed to cleanup backup: ${backup.id}`, error);
            }
        }
        
        if (oldBackups.length > 0) {
            this.logger.info(`Cleaned up ${oldBackups.length} old backups`);
        }
    }

    scheduleBackups() {
        const { frequency, time } = this.config.schedule;
        
        // Simple scheduling - in production use a proper scheduler like node-cron
        const scheduleBackup = () => {
            this.createBackup('full', { automated: true })
                .catch(error => this.logger.error('Scheduled backup failed:', error));
        };
        
        switch (frequency) {
            case 'hourly':
                setInterval(scheduleBackup, 60 * 60 * 1000);
                break;
            case 'daily':
                setInterval(scheduleBackup, 24 * 60 * 60 * 1000);
                break;
            case 'weekly':
                setInterval(scheduleBackup, 7 * 24 * 60 * 60 * 1000);
                break;
        }
        
        this.logger.info(`Backup scheduled: ${frequency} at ${time}`);
    }

    async findFiles(pattern) {
        // Simple file finding - in production use a proper glob library
        const files = [];
        
        if (pattern.includes('*')) {
            // Glob pattern
            await this.walkDirectory('.', files, pattern);
        } else {
            // Direct path
            try {
                const stats = await fs.stat(pattern);
                if (stats.isFile()) {
                    files.push(pattern);
                } else if (stats.isDirectory()) {
                    await this.walkDirectory(pattern, files, '**/*');
                }
            } catch (error) {
                // Path doesn't exist
            }
        }
        
        return files;
    }

    async walkDirectory(dir, files, pattern) {
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !this.config.excludePatterns.includes(entry.name)) {
                    await this.walkDirectory(fullPath, files, pattern);
                } else if (entry.isFile()) {
                    if (this.matchesPattern(entry.name, pattern)) {
                        files.push(fullPath);
                    }
                }
            }
        } catch (error) {
            // Directory access error, skip
        }
    }

    matchesPattern(filename, pattern) {
        // Simple pattern matching
        if (pattern === '**/*') return true;
        if (pattern.startsWith('*.')) {
            const ext = pattern.substring(1);
            return filename.endsWith(ext);
        }
        return filename === pattern;
    }

    async saveBackupManifest(backup) {
        const manifestPath = path.join(this.config.backupPath, `manifest_${backup.id}.json`);
        await fs.writeFile(manifestPath, JSON.stringify(backup, null, 2));
    }

    async loadBackupHistory() {
        const historyFile = path.join(this.config.backupPath, 'backup-history.json');
        
        try {
            const history = JSON.parse(await fs.readFile(historyFile, 'utf8'));
            for (const backup of history) {
                this.backupHistory.set(backup.id, backup);
            }
            this.logger.info(`Loaded ${history.length} backup records`);
        } catch (error) {
            this.logger.info('No backup history found, starting fresh');
        }
    }

    async saveBackupHistory() {
        const historyFile = path.join(this.config.backupPath, 'backup-history.json');
        const history = Array.from(this.backupHistory.values());
        await fs.writeFile(historyFile, JSON.stringify(history, null, 2));
    }

    generateBackupId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const random = crypto.randomBytes(4).toString('hex');
        return `${timestamp}_${random}`;
    }

    formatSize(bytes) {
        const sizes = ['B', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 B';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    async loadConfiguration() {
        try {
            const configPath = path.join(__dirname, 'config', 'backup.json');
            const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
            Object.assign(this.config, config);
            
            this.logger.info('Backup configuration loaded');
        } catch (error) {
            this.logger.info('Using default backup configuration');
        }
    }
}

module.exports = { BackupRecoverySystem };

if (require.main === module) {
    const backupSystem = new BackupRecoverySystem();

    async function demo() {
        console.log('💾 Starting Backup & Recovery System Demo...\n');
        
        await backupSystem.initialize();
        
        console.log('📁 Backup configuration:');
        console.log(`  Path: ${backupSystem.config.backupPath}`);
        console.log(`  Schedule: ${backupSystem.config.schedule.frequency}`);
        console.log(`  Targets: ${backupSystem.config.targets.join(', ')}`);
        console.log(`  Compression: ${backupSystem.config.compression ? 'enabled' : 'disabled'}`);
        console.log();
        
        console.log('🚀 Creating full backup...');
        const backup = await backupSystem.createBackup('full');
        
        console.log(`\n✅ Backup created: ${backup.id}`);
        console.log(`  Status: ${backup.status}`);
        console.log(`  Size: ${backupSystem.formatSize(backup.size)}`);
        console.log(`  Files: ${backup.files.length}`);
        console.log(`  Duration: ${backup.duration}ms`);
        
        if (backup.compressed) {
            console.log(`  Compressed: ${backupSystem.formatSize(backup.compressed.size)} (${backup.compressed.ratio.toFixed(1)}% saved)`);
        }
        
        console.log('\n📋 Backup files:');
        for (const file of backup.files.slice(0, 5)) {
            console.log(`  ${file.type}: ${path.basename(file.source)} (${backupSystem.formatSize(file.size)})`);
        }
        
        if (backup.files.length > 5) {
            console.log(`  ... and ${backup.files.length - 5} more files`);
        }
        
        console.log('\n📦 Listing all backups:');
        const backups = await backupSystem.listBackups();
        for (const b of backups) {
            const date = new Date(b.timestamp).toLocaleString();
            console.log(`  ${b.id}: ${b.type} backup, ${b.status}, ${date}`);
        }
        
        console.log('\n✅ Backup & Recovery demo completed');
    }

    demo().catch(console.error);
}