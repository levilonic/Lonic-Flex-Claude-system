#!/usr/bin/env node

const AnthropicDocsManager = require('./anthropic-docs-manager');
const fs = require('fs');
const path = require('path');

class DocumentationSearchTool {
    constructor() {
        this.docsManager = new AnthropicDocsManager();
        this.searchHistory = [];
        this.maxHistorySize = 20;
    }

    // Main search interface - context-efficient
    async search(query, options = {}) {
        const {
            category = null,
            limit = 5,
            format = 'summary', // 'summary', 'detailed', 'links-only'
            includeContext = false
        } = options;

        // Record search history
        this.addToHistory(query, category);

        try {
            const results = await this.docsManager.searchDocs(query, category, limit);
            
            return this.formatResults(results, format, includeContext);
        } catch (error) {
            return {
                error: true,
                message: `Search failed: ${error.message}`,
                query,
                timestamp: new Date().toISOString()
            };
        }
    }

    // Quick capabilities check - no context abuse
    getCapabilities() {
        const capabilities = this.docsManager.getCapabilities();
        
        return {
            available_categories: capabilities.categories,
            quick_access_keys: capabilities.quickAccess,
            total_sources: capabilities.sources.length,
            total_documentation_chunks: capabilities.totalChunks,
            search_commands: [
                'search <query>',
                'search <query> --category=api_reference',
                'quick <key>',
                'capabilities',
                'snippet <topic>'
            ]
        };
    }

    // Get context snippet without abuse - perfect for injecting specific knowledge
    getContextSnippet(topic) {
        const snippet = this.docsManager.getContextSnippet(topic, 300);
        
        if (!snippet) {
            return {
                error: true,
                message: `No documentation found for topic: ${topic}`
            };
        }

        return {
            topic: snippet.topic,
            content: snippet.content,
            source: snippet.source,
            link: snippet.link,
            usage: 'inject-context', // Marker for context injection
            token_efficient: true
        };
    }

    // Quick access to common docs
    quickAccess(key) {
        const result = this.docsManager.getQuickAccess(key);
        
        if (!result) {
            const availableKeys = this.docsManager.getCapabilities().quickAccess;
            return {
                error: true,
                message: `Key '${key}' not found`,
                available_keys: availableKeys
            };
        }

        return {
            key,
            type: result.type,
            path: result.path,
            preview: result.type === 'file' ? result.content : `Directory with ${result.items.length} items`,
            items: result.items || null
        };
    }

    // Smart category search
    searchByCategory(query, category) {
        const capabilities = this.docsManager.getCapabilities();
        
        if (!capabilities.categories.includes(category)) {
            return {
                error: true,
                message: `Category '${category}' not found`,
                available_categories: capabilities.categories
            };
        }

        return this.search(query, { category, limit: 7 });
    }

    // Format results based on requested format
    formatResults(results, format, includeContext) {
        if (results.length === 0) {
            return {
                results: [],
                message: 'No documentation found for your query',
                suggestions: this.getSuggestions()
            };
        }

        const formatted = {
            count: results.length,
            format,
            timestamp: new Date().toISOString()
        };

        switch (format) {
            case 'summary':
                formatted.results = results.map(r => ({
                    heading: r.heading,
                    content: r.content.slice(0, 150) + '...',
                    source: r.source,
                    relevance: r.relevance
                }));
                break;

            case 'detailed':
                formatted.results = results;
                break;

            case 'links-only':
                formatted.results = results.map(r => ({
                    heading: r.heading,
                    link: r.link,
                    source: r.source
                }));
                break;

            default:
                formatted.results = results;
        }

        if (includeContext && results.length > 0) {
            formatted.context_snippet = {
                content: results[0].content.slice(0, 200),
                usage: 'This snippet can be injected into context for immediate use'
            };
        }

        return formatted;
    }

    // Get search suggestions
    getSuggestions() {
        return [
            'Try searching for: "api authentication", "tool use", "agent patterns"',
            'Use categories: api_reference, code_examples, agent_development',
            'Quick access keys: getting_started, api_reference, code_examples'
        ];
    }

    // Add to search history
    addToHistory(query, category) {
        this.searchHistory.unshift({
            query,
            category,
            timestamp: new Date().toISOString()
        });

        if (this.searchHistory.length > this.maxHistorySize) {
            this.searchHistory.pop();
        }
    }

    // Get recent searches
    getHistory(limit = 10) {
        return this.searchHistory.slice(0, limit);
    }

    // Memory management
    clearCache() {
        this.docsManager.clearCache();
        return { message: 'Documentation cache cleared' };
    }

    getMemoryStats() {
        return {
            cache: this.docsManager.getMemoryStats(),
            history: {
                entries: this.searchHistory.length,
                maxSize: this.maxHistorySize
            }
        };
    }
}

// CLI Interface
if (require.main === module) {
    const args = process.argv.slice(2);
    const searchTool = new DocumentationSearchTool();

    if (args.length === 0) {
        console.log('Usage: node doc-search.js <command> [options]');
        console.log('Commands:');
        console.log('  search <query>');
        console.log('  capabilities');
        console.log('  quick <key>');
        console.log('  snippet <topic>');
        console.log('  category <category> <query>');
        console.log('  history');
        console.log('  clear-cache');
        console.log('  memory-stats');
        process.exit(1);
    }

    const command = args[0];
    const query = args.slice(1).join(' ');

    (async () => {
        let result;

        switch (command) {
            case 'search':
                result = await searchTool.search(query);
                break;
            case 'capabilities':
                result = searchTool.getCapabilities();
                break;
            case 'quick':
                result = searchTool.quickAccess(query);
                break;
            case 'snippet':
                result = searchTool.getContextSnippet(query);
                break;
            case 'category':
                const [category, ...queryParts] = args.slice(1);
                result = await searchTool.searchByCategory(queryParts.join(' '), category);
                break;
            case 'history':
                result = searchTool.getHistory();
                break;
            case 'clear-cache':
                result = searchTool.clearCache();
                break;
            case 'memory-stats':
                result = searchTool.getMemoryStats();
                break;
            default:
                result = { error: true, message: `Unknown command: ${command}` };
        }

        console.log(JSON.stringify(result, null, 2));
    })().catch(error => {
        console.error('Error:', error.message);
        process.exit(1);
    });
}

module.exports = DocumentationSearchTool;