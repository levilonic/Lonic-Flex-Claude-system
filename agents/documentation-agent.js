/**
 * Documentation Agent - Enhanced BaseAgent with documentation capabilities
 * Provides instant access to Anthropic documentation without context abuse
 */

const { BaseAgent } = require('./base-agent');
const AnthropicDocsManager = require('../docs/anthropic-docs-manager');
const DocumentationSearchTool = require('../docs/doc-search');

class DocumentationAgent extends BaseAgent {
    constructor(sessionId, config = {}) {
        super('DocumentationAgent', sessionId, config);
        
        // Initialize documentation tools
        this.docsManager = new AnthropicDocsManager();
        this.searchTool = new DocumentationSearchTool();
        
        // Documentation-specific configuration
        this.docConfig = {
            maxSearchResults: 5,
            maxSnippetLength: 300,
            cacheEnabled: true,
            ...config.documentation
        };
        
        this.executionSteps = [
            'Initialize documentation system',
            'Process documentation request', 
            'Search documentation sources',
            'Format and validate results',
            'Cache results for efficiency',
            'Generate response with citations',
            'Update knowledge base',
            'Return formatted documentation'
        ];
    }

    /**
     * Main documentation workflow
     */
    async executeWorkflow(context, progressCallback) {
        const { query, type = 'search', category = null, format = 'summary' } = context;
        
        let result = {};
        
        // Step 1: Initialize documentation system
        result.initialization = await this.executeStep('Initialize documentation system', async () => {
            const capabilities = this.searchTool.getCapabilities();
            return {
                status: 'initialized',
                totalSources: capabilities.total_sources,
                categories: capabilities.available_categories,
                quickAccessKeys: capabilities.quick_access_keys
            };
        });
        
        // Step 2: Process documentation request
        result.request = await this.executeStep('Process documentation request', async () => {
            return {
                query,
                type,
                category,
                format,
                timestamp: new Date().toISOString()
            };
        });
        
        // Step 3: Search documentation sources
        result.searchResults = await this.executeStep('Search documentation sources', async () => {
            switch (type) {
                case 'search':
                    return await this.searchTool.search(query, {
                        category,
                        limit: this.docConfig.maxSearchResults,
                        format,
                        includeContext: true
                    });
                case 'quick':
                    return this.searchTool.quickAccess(query);
                case 'snippet':
                    return this.searchTool.getContextSnippet(query);
                case 'capabilities':
                    return this.searchTool.getCapabilities();
                default:
                    throw new Error(`Unknown documentation request type: ${type}`);
            }
        });
        
        // Step 4: Format and validate results
        result.formattedResults = await this.executeStep('Format and validate results', async () => {
            const results = result.searchResults;
            
            if (results.error) {
                return {
                    error: true,
                    message: results.message,
                    suggestions: results.suggestions || []
                };
            }
            
            return {
                success: true,
                type: results.type || type,
                count: results.count || (results.results ? results.results.length : 1),
                data: results.results || results,
                context: results.context_snippet || null
            };
        });
        
        // Step 5: Cache results for efficiency
        result.caching = await this.executeStep('Cache results for efficiency', async () => {
            if (this.docConfig.cacheEnabled && !result.formattedResults.error) {
                const cacheKey = `${type}:${query}:${category}`;
                // Results are already cached internally by the search tool
                return {
                    cached: true,
                    key: cacheKey,
                    timestamp: Date.now()
                };
            }
            return { cached: false };
        });
        
        // Step 6: Generate response with citations
        result.response = await this.executeStep('Generate response with citations', async () => {
            if (result.formattedResults.error) {
                return {
                    message: result.formattedResults.message,
                    suggestions: result.formattedResults.suggestions,
                    query,
                    timestamp: new Date().toISOString()
                };
            }
            
            const response = {
                query,
                type,
                category,
                results: result.formattedResults.data,
                metadata: {
                    resultCount: result.formattedResults.count,
                    searchTime: Date.now() - result.request.timestamp,
                    cached: result.caching.cached,
                    format
                }
            };
            
            // Add context snippet if available for immediate use
            if (result.formattedResults.context) {
                response.contextSnippet = result.formattedResults.context;
            }
            
            return response;
        });
        
        // Step 7: Update knowledge base
        result.knowledgeUpdate = await this.executeStep('Update knowledge base', async () => {
            // Record the successful documentation query for future optimization
            await this.memoryManager.recordPattern(
                'documentation_query',
                { query, type, category, resultCount: result.formattedResults.count },
                'documentation_search',
                result.formattedResults.error ? 'failed' : 'successful',
                result.formattedResults.error ? 0.0 : 1.0
            );
            
            return {
                patternRecorded: true,
                query,
                success: !result.formattedResults.error
            };
        });
        
        // Step 8: Return formatted documentation
        result.final = await this.executeStep('Return formatted documentation', async () => {
            return result.response;
        });
        
        return result.final;
    }

    /**
     * Quick search method for common documentation queries
     */
    async quickSearch(query) {
        return await this.execute({ query, type: 'search', format: 'summary' });
    }

    /**
     * Get context-efficient snippet for injection
     */
    async getSnippet(topic) {
        return await this.execute({ query: topic, type: 'snippet' });
    }

    /**
     * Get capabilities for self-discovery
     */
    async getCapabilities() {
        return await this.execute({ type: 'capabilities' });
    }

    /**
     * Search by category for targeted results
     */
    async searchByCategory(query, category) {
        return await this.execute({ query, type: 'search', category, format: 'detailed' });
    }

    /**
     * Get quick access to common documentation
     */
    async quickAccess(key) {
        return await this.execute({ query: key, type: 'quick' });
    }

    /**
     * Get memory statistics for monitoring
     */
    getMemoryStats() {
        return this.searchTool.getMemoryStats();
    }

    /**
     * Clear documentation cache
     */
    clearCache() {
        return this.searchTool.clearCache();
    }
}

/**
 * Documentation mixin for BaseAgent - adds documentation capabilities to any agent
 */
class DocumentationMixin {
    static apply(agentClass) {
        // Add documentation methods to the agent class
        agentClass.prototype.initializeDocumentation = function() {
            if (!this._docsManager) {
                this._docsManager = new AnthropicDocsManager();
                this._searchTool = new DocumentationSearchTool();
            }
        };

        agentClass.prototype.searchDocs = async function(query, options = {}) {
            this.initializeDocumentation();
            return await this._searchTool.search(query, options);
        };

        agentClass.prototype.getDocSnippet = function(topic) {
            this.initializeDocumentation();
            return this._searchTool.getContextSnippet(topic);
        };

        agentClass.prototype.getDocCapabilities = function() {
            this.initializeDocumentation();
            return this._searchTool.getCapabilities();
        };

        agentClass.prototype.quickDocAccess = function(key) {
            this.initializeDocumentation(); 
            return this._searchTool.quickAccess(key);
        };

        return agentClass;
    }
}

module.exports = { DocumentationAgent, DocumentationMixin };