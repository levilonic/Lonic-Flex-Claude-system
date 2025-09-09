/**
 * Documentation Service - Lightweight singleton for intelligent documentation access
 * Transforms documentation from lookup service to embedded intelligence
 */

const AnthropicDocsManager = require('../docs/anthropic-docs-manager');
const path = require('path');
const fs = require('fs');

class DocumentationService {
    static instance = null;
    
    constructor() {
        if (DocumentationService.instance) {
            return DocumentationService.instance;
        }
        
        this.docsManager = new AnthropicDocsManager();
        this.contextCache = new Map();
        this.errorPatterns = new Map();
        this.agentSuggestions = new Map();
        this.maxCacheSize = 100;
        this.isInitialized = false;
        
        DocumentationService.instance = this;
    }
    
    static getInstance() {
        if (!DocumentationService.instance) {
            DocumentationService.instance = new DocumentationService();
        }
        return DocumentationService.instance;
    }
    
    /**
     * Lazy initialization - only loads when first accessed
     */
    async initialize() {
        if (this.isInitialized) return;
        
        try {
            // Pre-load critical documentation patterns
            await this.loadErrorPatterns();
            await this.loadAgentSuggestions();
            this.isInitialized = true;
        } catch (error) {
            console.error('DocumentationService initialization failed:', error.message);
        }
    }
    
    /**
     * Lightning-fast documentation search (sub-100ms target)
     */
    async quickSearch(query, maxResults = 3) {
        await this.initialize();
        
        const cacheKey = `search:${query}:${maxResults}`;
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey);
        }
        
        try {
            const results = await this.docsManager.searchDocs(query, null, maxResults);
            const formatted = results.map(r => ({
                heading: r.heading,
                content: r.content.slice(0, 200),
                relevance: r.relevance,
                source: r.source,
                link: r.link
            }));
            
            this.cacheResult(cacheKey, formatted);
            return formatted;
        } catch (error) {
            console.error('Quick search failed:', error.message);
            return [];
        }
    }
    
    /**
     * Context-efficient snippet for immediate injection (< 200 chars)
     */
    getContextSnippet(topic) {
        const cacheKey = `snippet:${topic}`;
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey);
        }
        
        const snippet = this.docsManager.getContextSnippet(topic, 180);
        if (snippet) {
            const formatted = {
                topic: snippet.topic,
                content: snippet.content,
                source: 'Anthropic Docs',
                contextReady: true
            };
            this.cacheResult(cacheKey, formatted);
            return formatted;
        }
        
        return null;
    }
    
    /**
     * Context-aware suggestions based on current agent operation
     */
    async getSuggestionsForContext(agentName, stepName, context = {}) {
        await this.initialize();
        
        const suggestionKey = `${agentName}:${stepName}`;
        
        // Check pre-loaded agent suggestions
        if (this.agentSuggestions.has(suggestionKey)) {
            return this.agentSuggestions.get(suggestionKey);
        }
        
        // Dynamic suggestions based on context
        const suggestions = [];
        
        // Agent-specific suggestions
        switch (agentName.toLowerCase()) {
            case 'github':
            case 'githubagent':
                suggestions.push(await this.quickSearch('github api rate limits', 1));
                suggestions.push(await this.quickSearch('github authentication', 1));
                break;
            case 'deploy':
            case 'deployagent':
                suggestions.push(await this.quickSearch('deployment strategies', 1));
                suggestions.push(await this.quickSearch('docker best practices', 1));
                break;
            case 'security':
            case 'securityagent':
                suggestions.push(await this.quickSearch('security vulnerabilities', 1));
                suggestions.push(await this.quickSearch('security scanning', 1));
                break;
            case 'code':
            case 'codeagent':
                suggestions.push(await this.quickSearch('code generation', 1));
                suggestions.push(await this.quickSearch('tool use patterns', 1));
                break;
        }
        
        // Step-specific suggestions
        if (stepName.includes('auth')) {
            suggestions.push(await this.quickSearch('authentication', 1));
        }
        if (stepName.includes('error') || stepName.includes('fail')) {
            suggestions.push(await this.quickSearch('error handling', 1));
        }
        
        const flattened = suggestions.flat().filter(s => s.length > 0);
        this.cacheResult(suggestionKey, flattened);
        return flattened;
    }
    
    /**
     * Intelligent error documentation suggestions
     */
    async getSuggestionsForError(error, agentContext = {}) {
        await this.initialize();
        
        const errorMessage = error.message || error.toString();
        const cacheKey = `error:${errorMessage.slice(0, 50)}`;
        
        if (this.contextCache.has(cacheKey)) {
            return this.contextCache.get(cacheKey);
        }
        
        const suggestions = [];
        
        // Pattern-based error suggestions
        for (const [pattern, docs] of this.errorPatterns) {
            if (errorMessage.toLowerCase().includes(pattern)) {
                suggestions.push(...docs);
            }
        }
        
        // Fallback to general error handling
        if (suggestions.length === 0) {
            suggestions.push(...(await this.quickSearch('error handling', 2)));
            suggestions.push(...(await this.quickSearch('troubleshooting', 1)));
        }
        
        this.cacheResult(cacheKey, suggestions);
        return suggestions;
    }
    
    /**
     * Get quick capabilities summary
     */
    getCapabilities() {
        return {
            sources: 8,
            categories: ['api_reference', 'code_examples', 'agent_development', 'sdk_integration', 'learning_resources'],
            quickAccess: ['getting_started', 'api_reference', 'code_examples', 'python_sdk', 'typescript_sdk'],
            features: [
                'Sub-100ms searches',
                'Context-aware suggestions', 
                'Error-driven documentation',
                'Agent intelligence enhancement'
            ]
        };
    }
    
    /**
     * Proactive documentation based on agent workflow patterns
     */
    async getProactiveDocumentation(agentName, currentStep, previousSteps = []) {
        const suggestions = [];
        
        // Predict next likely documentation needs
        if (currentStep.includes('init') && !previousSteps.some(s => s.includes('auth'))) {
            suggestions.push(...(await this.quickSearch('authentication setup', 1)));
        }
        
        if (currentStep.includes('deploy') && !previousSteps.some(s => s.includes('build'))) {
            suggestions.push(...(await this.quickSearch('build process', 1)));
        }
        
        return suggestions;
    }
    
    /**
     * Learn from successful agent patterns
     */
    recordSuccessPattern(agentName, stepName, documentation) {
        const key = `${agentName}:${stepName}`;
        this.agentSuggestions.set(key, documentation);
    }
    
    // Private helper methods
    async loadErrorPatterns() {
        // Use direct docsManager to avoid recursion during initialization
        this.errorPatterns.set('authentication', await this.docsManager.searchDocs('authentication', null, 2));
        this.errorPatterns.set('rate limit', await this.docsManager.searchDocs('rate limits', null, 2));
        this.errorPatterns.set('permission', await this.docsManager.searchDocs('permissions', null, 2));
        this.errorPatterns.set('timeout', await this.docsManager.searchDocs('timeouts', null, 2));
        this.errorPatterns.set('connection', await this.docsManager.searchDocs('connection issues', null, 2));
        this.errorPatterns.set('docker', await this.docsManager.searchDocs('docker troubleshooting', null, 2));
    }
    
    async loadAgentSuggestions() {
        // Use direct docsManager to avoid recursion during initialization  
        this.agentSuggestions.set('github:authenticate', await this.docsManager.searchDocs('github authentication', null, 2));
        this.agentSuggestions.set('deploy:build', await this.docsManager.searchDocs('deployment strategies', null, 2));
        this.agentSuggestions.set('security:scan', await this.docsManager.searchDocs('security scanning', null, 2));
        this.agentSuggestions.set('code:generate', await this.docsManager.searchDocs('code generation', null, 2));
    }
    
    cacheResult(key, result) {
        if (this.contextCache.size >= this.maxCacheSize) {
            const firstKey = this.contextCache.keys().next().value;
            this.contextCache.delete(firstKey);
        }
        this.contextCache.set(key, result);
    }
    
    /**
     * Memory management
     */
    clearCache() {
        this.contextCache.clear();
        return { message: 'Documentation service cache cleared', cacheSize: 0 };
    }
    
    getMemoryStats() {
        return {
            initialized: this.isInitialized,
            cacheSize: this.contextCache.size,
            maxCacheSize: this.maxCacheSize,
            errorPatterns: this.errorPatterns.size,
            agentSuggestions: this.agentSuggestions.size
        };
    }
}

module.exports = DocumentationService;