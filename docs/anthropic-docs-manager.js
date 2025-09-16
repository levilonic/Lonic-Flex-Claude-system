const fs = require('fs');
const path = require('path');

class AnthropicDocsManager {
    constructor(basePath = './') {
        this.basePath = basePath;
        this.docsIndex = this.loadDocsIndex();
        this.cache = new Map();
        this.maxCacheSize = 50; // Limit cache to prevent memory abuse
    }

    loadDocsIndex() {
        try {
            const indexPath = path.join(this.basePath, 'docs', 'anthropic-docs-index.json');
            return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        } catch (error) {
            console.error('Failed to load documentation index:', error.message);
            return { sources: {}, search_categories: {}, quick_access: {} };
        }
    }

    // Memory-efficient documentation search
    async searchDocs(query, category = null, limit = 5) {
        const results = [];
        const queryLower = query.toLowerCase();
        
        try {
            // Search in structured chunks first (most efficient)
            const structuredResults = await this.searchStructuredDocs(queryLower, limit);
            results.push(...structuredResults);
            
            // If we need more results and have a specific category, search that category
            if (results.length < limit && category) {
                const categoryResults = await this.searchByCategory(queryLower, category, limit - results.length);
                results.push(...categoryResults);
            }
            
            return results.slice(0, limit);
        } catch (error) {
            console.error('Documentation search failed:', error.message);
            return [];
        }
    }

    // Search pre-indexed documentation chunks (most efficient)
    async searchStructuredDocs(query, limit) {
        const cacheKey = `structured:${query}:${limit}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const results = [];
        
        // Search anthropic_docs.json
        try {
            const docsPath = path.join(this.basePath, this.docsIndex.sources.anthropic_docs.path);
            const docs = JSON.parse(fs.readFileSync(docsPath, 'utf8'));
            
            for (const chunk of docs) {
                if (this.matchesQuery(chunk, query)) {
                    results.push({
                        type: 'api_reference',
                        heading: chunk.chunk_heading,
                        content: chunk.text.slice(0, 500) + '...',
                        link: chunk.chunk_link,
                        source: 'Anthropic API Docs',
                        relevance: this.calculateRelevance(chunk, query)
                    });
                }
                if (results.length >= limit) break;
            }
        } catch (error) {
            console.error('Error searching structured docs:', error.message);
        }

        // Cache results efficiently
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(cacheKey, results);
        
        return results;
    }

    // Search by category using index
    async searchByCategory(query, category, limit) {
        const categoryConfig = this.docsIndex.search_categories[category];
        if (!categoryConfig) {
            return [];
        }

        const results = [];
        
        for (const sourceName of categoryConfig.sources) {
            const source = this.docsIndex.sources[sourceName];
            if (!source) continue;
            
            try {
                const categoryResults = await this.searchSource(query, source, limit - results.length);
                results.push(...categoryResults);
                if (results.length >= limit) break;
            } catch (error) {
                console.error(`Error searching ${sourceName}:`, error.message);
            }
        }
        
        return results;
    }

    // Get quick access to common documentation
    getQuickAccess(key) {
        const accessPath = this.docsIndex.quick_access[key];
        if (!accessPath) {
            return null;
        }
        
        const fullPath = path.join(this.basePath, accessPath);
        
        try {
            if (fs.statSync(fullPath).isDirectory()) {
                return {
                    type: 'directory',
                    path: fullPath,
                    items: this.getDirectoryContents(fullPath)
                };
            } else {
                return {
                    type: 'file', 
                    path: fullPath,
                    content: this.getFilePreview(fullPath)
                };
            }
        } catch (error) {
            console.error(`Quick access failed for ${key}:`, error.message);
            return null;
        }
    }

    // Get documentation capabilities for self-discovery
    getCapabilities() {
        return {
            sources: Object.keys(this.docsIndex.sources),
            categories: Object.keys(this.docsIndex.search_categories),
            quickAccess: Object.keys(this.docsIndex.quick_access),
            totalChunks: this.docsIndex.index.totalChunks,
            lastUpdated: this.docsIndex.index.lastUpdated
        };
    }

    // Get context-efficient documentation snippet
    getContextSnippet(topic, maxLength = 300) {
        const cacheKey = `snippet:${topic}:${maxLength}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        try {
            const results = this.searchStructuredDocs(topic, 1);
            if (results.length === 0) {
                return null;
            }
            
            const snippet = {
                topic,
                content: results[0].content.slice(0, maxLength),
                source: results[0].source,
                link: results[0].link
            };
            
            // Cache efficiently
            if (this.cache.size >= this.maxCacheSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
            this.cache.set(cacheKey, snippet);
            
            return snippet;
        } catch (error) {
            console.error(`Failed to get context snippet for ${topic}:`, error.message);
            return null;
        }
    }

    // Helper methods
    matchesQuery(chunk, query) {
        const text = (chunk.text + ' ' + chunk.chunk_heading).toLowerCase();
        return text.includes(query) || query.split(' ').some(word => text.includes(word));
    }

    calculateRelevance(chunk, query) {
        const text = (chunk.text + ' ' + chunk.chunk_heading).toLowerCase();
        let score = 0;
        
        // Exact phrase match
        if (text.includes(query)) score += 10;
        
        // Word matches
        const words = query.split(' ');
        for (const word of words) {
            if (text.includes(word)) score += 1;
        }
        
        // Heading match bonus
        if (chunk.chunk_heading.toLowerCase().includes(query)) score += 5;
        
        return score;
    }

    getDirectoryContents(dirPath, maxItems = 10) {
        try {
            const items = fs.readdirSync(dirPath);
            return items.slice(0, maxItems).map(item => {
                const itemPath = path.join(dirPath, item);
                const stats = fs.statSync(itemPath);
                return {
                    name: item,
                    type: stats.isDirectory() ? 'directory' : 'file',
                    path: itemPath
                };
            });
        } catch (error) {
            return [];
        }
    }

    getFilePreview(filePath, maxLength = 500) {
        try {
            if (path.extname(filePath) === '.json') {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                return JSON.stringify(content, null, 2).slice(0, maxLength) + '...';
            } else {
                return fs.readFileSync(filePath, 'utf8').slice(0, maxLength) + '...';
            }
        } catch (error) {
            return `Error reading file: ${error.message}`;
        }
    }

    async searchSource(query, source, limit) {
        const results = [];
        const sourcePath = path.join(this.basePath, source.path);
        
        try {
            if (source.type === 'structured_chunks') {
                const docs = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
                for (const chunk of docs) {
                    if (this.matchesQuery(chunk, query)) {
                        results.push({
                            type: source.type,
                            heading: chunk.chunk_heading || 'No heading',
                            content: (chunk.text || chunk.summary || '').slice(0, 300) + '...',
                            link: chunk.chunk_link || sourcePath,
                            source: source.description,
                            relevance: this.calculateRelevance(chunk, query)
                        });
                    }
                    if (results.length >= limit) break;
                }
            }
        } catch (error) {
            console.error(`Error searching source ${source.path}:`, error.message);
        }
        
        return results;
    }

    // Clear cache to free memory
    clearCache() {
        this.cache.clear();
    }

    // Get memory usage statistics
    getMemoryStats() {
        return {
            cacheSize: this.cache.size,
            maxCacheSize: this.maxCacheSize,
            cachedKeys: Array.from(this.cache.keys())
        };
    }
}

module.exports = AnthropicDocsManager;