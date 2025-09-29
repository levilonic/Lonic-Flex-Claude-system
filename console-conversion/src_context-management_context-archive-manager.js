#!/usr/bin/env node
/**
 * Context Archive Manager - Enhanced storage and retrieval system
 * Provides indexing, compression, and advanced archive management
 */

const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

class ContextArchiveManager {
    constructor(options = {}) {
        this.archiveDir = options.archiveDir || path.join(__dirname, '.claude', 'context-archive');
        this.indexFile = path.join(this.archiveDir, 'archive-index.json');
        this.enableCompression = options.compression !== false;
        this.maxArchiveAge = options.maxArchiveAge || 30 * 24 * 60 * 60 * 1000; // 30 days
        this.maxArchiveSize = options.maxArchiveSize || 100; // Max 100 archives
        
        this.index = new Map();
        this.initialized = false;
        
        console.log('✅ ContextArchiveManager initialized');
    }
    
    /**
     * Initialize the archive system
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            // Create archive directory
            await fs.mkdir(this.archiveDir, { recursive: true });
            
            // Load existing index
            await this.loadIndex();
            
            // Cleanup old archives
            await this.cleanupOldArchives();
            
            this.initialized = true;
            console.log(`📦 Archive system initialized: ${this.index.size} archives indexed`);
            
        } catch (error) {
            console.error('❌ Failed to initialize archive system:', error.message);
            throw error;
        }
    }
    
    /**
     * Load the archive index
     */
    async loadIndex() {
        try {
            const indexData = await fs.readFile(this.indexFile, 'utf8');
            const indexArray = JSON.parse(indexData);
            
            // Convert array to Map for faster lookups
            this.index.clear();
            for (const entry of indexArray) {
                this.index.set(entry.archiveId, entry);
            }
            
        } catch (error) {
            // Create empty index if file doesn't exist
            this.index.clear();
            await this.saveIndex();
        }
    }
    
    /**
     * Save the archive index
     */
    async saveIndex() {
        try {
            const indexArray = Array.from(this.index.values());
            await fs.writeFile(this.indexFile, JSON.stringify(indexArray, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ Failed to save index:', error.message);
        }
    }
    
    /**
     * Archive context with enhanced metadata and compression
     */
    async archiveContext(contextContent, reason, metadata = {}) {
        if (!this.initialized) await this.initialize();
        
        const archiveId = `archive_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const timestamp = new Date().toISOString();
        
        try {
            // Prepare content
            let processedContent = contextContent;
            let isCompressed = false;
            let compressionRatio = 1.0;
            
            if (this.enableCompression && contextContent.length > 1000) {
                const compressed = await gzip(Buffer.from(contextContent, 'utf8'));
                processedContent = compressed.toString('base64');
                isCompressed = true;
                compressionRatio = compressed.length / contextContent.length;
            }
            
            // Create enhanced metadata
            const archiveMetadata = {
                archiveId,
                timestamp,
                reason,
                originalSize: contextContent.length,
                processedSize: processedContent.length,
                isCompressed,
                compressionRatio: Math.round(compressionRatio * 1000) / 1000,
                checksum: this.calculateChecksum(contextContent),
                contentType: this.detectContentType(contextContent),
                tags: this.extractTags(contextContent),
                ...metadata
            };
            
            // Save content file
            const contentFile = path.join(this.archiveDir, `${archiveId}.dat`);
            await fs.writeFile(contentFile, processedContent, isCompressed ? 'utf8' : 'utf8');
            
            // Update index
            this.index.set(archiveId, archiveMetadata);
            await this.saveIndex();
            
            console.log(`📦 Archived: ${archiveId} (${(contextContent.length/1024).toFixed(1)}KB → ${(processedContent.length/1024).toFixed(1)}KB, ${(compressionRatio*100).toFixed(1)}% ratio)`);
            
            // Cleanup if we have too many archives
            await this.enforceMaxArchives();
            
            return archiveId;
            
        } catch (error) {
            console.error(`❌ Failed to archive context:`, error.message);
            throw error;
        }
    }
    
    /**
     * Retrieve archived content by ID
     */
    async retrieveArchive(archiveId) {
        if (!this.initialized) await this.initialize();
        
        const metadata = this.index.get(archiveId);
        if (!metadata) {
            throw new Error(`Archive not found: ${archiveId}`);
        }
        
        try {
            const contentFile = path.join(this.archiveDir, `${archiveId}.dat`);
            let processedContent = await fs.readFile(contentFile, 'utf8');
            
            // Decompress if needed
            if (metadata.isCompressed) {
                const compressed = Buffer.from(processedContent, 'base64');
                const decompressed = await gunzip(compressed);
                processedContent = decompressed.toString('utf8');
            }
            
            // Verify integrity
            const checksum = this.calculateChecksum(processedContent);
            if (checksum !== metadata.checksum) {
                console.warn(`⚠️ Checksum mismatch for archive ${archiveId}`);
            }
            
            return {
                content: processedContent,
                metadata: { ...metadata }
            };
            
        } catch (error) {
            console.error(`❌ Failed to retrieve archive ${archiveId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Search archives by criteria
     */
    async searchArchives(criteria = {}) {
        if (!this.initialized) await this.initialize();
        
        let results = Array.from(this.index.values());
        
        // Filter by reason
        if (criteria.reason) {
            results = results.filter(a => a.reason.includes(criteria.reason));
        }
        
        // Filter by date range
        if (criteria.since) {
            const since = new Date(criteria.since);
            results = results.filter(a => new Date(a.timestamp) >= since);
        }
        
        if (criteria.until) {
            const until = new Date(criteria.until);
            results = results.filter(a => new Date(a.timestamp) <= until);
        }
        
        // Filter by tags
        if (criteria.tags && criteria.tags.length > 0) {
            results = results.filter(a => 
                criteria.tags.some(tag => a.tags && a.tags.includes(tag))
            );
        }
        
        // Filter by content type
        if (criteria.contentType) {
            results = results.filter(a => a.contentType === criteria.contentType);
        }
        
        // Filter by size range
        if (criteria.minSize) {
            results = results.filter(a => a.originalSize >= criteria.minSize);
        }
        
        if (criteria.maxSize) {
            results = results.filter(a => a.originalSize <= criteria.maxSize);
        }
        
        // Sort results
        const sortBy = criteria.sortBy || 'timestamp';
        const sortOrder = criteria.sortOrder || 'desc';
        
        results.sort((a, b) => {
            let comparison = 0;
            
            if (sortBy === 'timestamp') {
                comparison = new Date(a.timestamp) - new Date(b.timestamp);
            } else if (sortBy === 'size') {
                comparison = a.originalSize - b.originalSize;
            } else if (sortBy === 'reason') {
                comparison = a.reason.localeCompare(b.reason);
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });
        
        return results;
    }
    
    /**
     * Delete archive by ID
     */
    async deleteArchive(archiveId) {
        if (!this.initialized) await this.initialize();
        
        if (!this.index.has(archiveId)) {
            throw new Error(`Archive not found: ${archiveId}`);
        }
        
        try {
            const contentFile = path.join(this.archiveDir, `${archiveId}.dat`);
            await fs.unlink(contentFile);
            this.index.delete(archiveId);
            await this.saveIndex();
            
            console.log(`🗑️ Deleted archive: ${archiveId}`);
            return true;
            
        } catch (error) {
            console.error(`❌ Failed to delete archive ${archiveId}:`, error.message);
            throw error;
        }
    }
    
    /**
     * Cleanup old archives beyond retention period
     */
    async cleanupOldArchives() {
        const cutoffDate = new Date(Date.now() - this.maxArchiveAge);
        const oldArchives = Array.from(this.index.values())
            .filter(a => new Date(a.timestamp) < cutoffDate);
        
        console.log(`🧹 Cleaning up ${oldArchives.length} old archives (older than ${Math.floor(this.maxArchiveAge / (24*60*60*1000))} days)`);
        
        for (const archive of oldArchives) {
            try {
                await this.deleteArchive(archive.archiveId);
            } catch (error) {
                console.error(`❌ Failed to cleanup archive ${archive.archiveId}:`, error.message);
            }
        }
    }
    
    /**
     * Enforce maximum number of archives
     */
    async enforceMaxArchives() {
        if (this.index.size <= this.maxArchiveSize) return;
        
        const archives = Array.from(this.index.values())
            .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        
        const toDelete = archives.slice(0, this.index.size - this.maxArchiveSize);
        
        console.log(`🧹 Enforcing max archives: deleting ${toDelete.length} oldest archives`);
        
        for (const archive of toDelete) {
            try {
                await this.deleteArchive(archive.archiveId);
            } catch (error) {
                console.error(`❌ Failed to delete archive ${archive.archiveId}:`, error.message);
            }
        }
    }
    
    /**
     * Get archive statistics
     */
    getStats() {
        const archives = Array.from(this.index.values());
        
        return {
            totalArchives: archives.length,
            totalSize: archives.reduce((sum, a) => sum + a.originalSize, 0),
            compressedSize: archives.reduce((sum, a) => sum + a.processedSize, 0),
            averageCompressionRatio: archives
                .filter(a => a.isCompressed)
                .reduce((sum, a, _, arr) => sum + a.compressionRatio / arr.length, 0),
            oldestArchive: archives.length > 0 ? 
                archives.reduce((oldest, a) => 
                    new Date(a.timestamp) < new Date(oldest.timestamp) ? a : oldest
                ).timestamp : null,
            newestArchive: archives.length > 0 ? 
                archives.reduce((newest, a) => 
                    new Date(a.timestamp) > new Date(newest.timestamp) ? a : newest
                ).timestamp : null,
            contentTypes: this.getContentTypeDistribution(archives),
            reasonDistribution: this.getReasonDistribution(archives)
        };
    }
    
    /**
     * Calculate simple checksum for content integrity
     */
    calculateChecksum(content) {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    /**
     * Detect content type from content
     */
    detectContentType(content) {
        if (content.includes('<workflow_context>')) return 'workflow_xml';
        if (content.includes('<session_context>')) return 'session_xml';
        if (content.includes('```')) return 'markdown_code';
        if (content.includes('function ') || content.includes('const ')) return 'javascript';
        if (content.includes('def ') || content.includes('import ')) return 'python';
        return 'text';
    }
    
    /**
     * Extract tags from content for better searchability
     */
    extractTags(content) {
        const tags = [];
        
        // Extract XML tags
        const xmlTags = content.match(/<(\w+)>/g);
        if (xmlTags) {
            tags.push(...xmlTags.map(tag => tag.replace(/[<>]/g, '')));
        }
        
        // Extract common keywords
        if (content.includes('error')) tags.push('error');
        if (content.includes('success')) tags.push('success');
        if (content.includes('warning')) tags.push('warning');
        if (content.includes('github')) tags.push('github');
        if (content.includes('deploy')) tags.push('deployment');
        if (content.includes('test')) tags.push('testing');
        
        // Remove duplicates and limit to 10 tags
        return [...new Set(tags)].slice(0, 10);
    }
    
    /**
     * Get content type distribution
     */
    getContentTypeDistribution(archives) {
        const distribution = {};
        for (const archive of archives) {
            distribution[archive.contentType] = (distribution[archive.contentType] || 0) + 1;
        }
        return distribution;
    }
    
    /**
     * Get reason distribution
     */
    getReasonDistribution(archives) {
        const distribution = {};
        for (const archive of archives) {
            distribution[archive.reason] = (distribution[archive.reason] || 0) + 1;
        }
        return distribution;
    }
}

// CLI interface
async function runCLI() {
    const args = process.argv.slice(2);
    const manager = new ContextArchiveManager();
    
    try {
        await manager.initialize();
        
        const command = args[0];
        
        switch (command) {
            case 'list':
            case 'ls':
                const archives = await manager.searchArchives();
                console.log(`📦 Found ${archives.length} archives:\n`);
                for (const archive of archives.slice(0, 10)) {
                    console.log(`${archive.archiveId}`);
                    console.log(`  📅 ${archive.timestamp}`);
                    console.log(`  📄 ${(archive.originalSize/1024).toFixed(1)}KB (${archive.contentType})`);
                    console.log(`  🏷️  ${archive.reason}`);
                    console.log('');
                }
                if (archives.length > 10) {
                    console.log(`... and ${archives.length - 10} more`);
                }
                break;
                
            case 'stats':
                const stats = manager.getStats();
                console.log('📊 Archive Statistics:');
                console.log(JSON.stringify(stats, null, 2));
                break;
                
            case 'get':
            case 'retrieve':
                const archiveId = args[1];
                if (!archiveId) {
                    console.error('Usage: get <archive_id>');
                    process.exit(1);
                }
                const archive = await manager.retrieveArchive(archiveId);
                console.log('📄 Archive Content:');
                console.log(archive.content);
                break;
                
            case 'delete':
            case 'rm':
                const deleteId = args[1];
                if (!deleteId) {
                    console.error('Usage: delete <archive_id>');
                    process.exit(1);
                }
                await manager.deleteArchive(deleteId);
                break;
                
            case 'search':
                const criteria = {};
                if (args[1]) criteria.reason = args[1];
                const results = await manager.searchArchives(criteria);
                console.log(`🔍 Search Results (${results.length} found):`);
                for (const result of results) {
                    console.log(`${result.archiveId} - ${result.reason} (${result.timestamp})`);
                }
                break;
                
            case 'cleanup':
                await manager.cleanupOldArchives();
                break;
                
            default:
                console.log(`
Context Archive Manager - Enhanced storage and retrieval

Commands:
  list, ls              List all archives
  stats                 Show archive statistics
  get <id>              Retrieve archive content
  delete <id>           Delete an archive
  search [reason]       Search archives
  cleanup               Remove old archives

Examples:
  node context-archive-manager.js list
  node context-archive-manager.js get archive_1234567_abc123
  node context-archive-manager.js search "pre-cleanup"
  node context-archive-manager.js stats
                `);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

if (require.main === module) {
    runCLI().catch(console.error);
}

module.exports = { ContextArchiveManager };