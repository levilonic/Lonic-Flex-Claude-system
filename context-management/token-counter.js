/**
 * TokenCounter - Accurate token counting for context window management
 * Prevents auto-compact by monitoring actual token usage vs character estimates
 */

class TokenCounter {
    constructor(options = {}) {
        this.anthropicClient = null;
        this.model = options.model || 'claude-3-5-sonnet-20241022';
        this.fallbackRatio = options.fallbackRatio || 4; // chars per token estimate
        this.cache = new Map();
        this.cacheMaxSize = options.cacheMaxSize || 1000;
        
        // Context window limits by model
        this.contextLimits = {
            'claude-3-5-sonnet-20241022': 200000,
            'claude-3-5-haiku-20241022': 200000,
            'claude-3-opus-20240229': 200000,
            'claude-3-sonnet-20240229': 200000,
            'claude-3-haiku-20240307': 200000,
            'default': 200000
        };
        
        this.initializeAnthropicClient();
    }

    /**
     * Initialize Anthropic client for token counting API
     */
    initializeAnthropicClient() {
        try {
            // Try to load Anthropic SDK if available
            const Anthropic = require('@anthropic-ai/sdk');
            this.anthropicClient = new Anthropic({
                apiKey: process.env.ANTHROPIC_API_KEY || 'sk-placeholder'
            });
            console.log('✅ TokenCounter: Anthropic SDK initialized');
        } catch (error) {
            console.log('⚠️ TokenCounter: Anthropic SDK not available, using fallback estimation');
            this.anthropicClient = null;
        }
    }

    /**
     * Get context window limit for current model
     */
    getContextLimit(model = this.model) {
        return this.contextLimits[model] || this.contextLimits.default;
    }

    /**
     * Count tokens in messages using Anthropic API (most accurate)
     */
    async countTokensAPI(messages) {
        if (!this.anthropicClient) {
            throw new Error('Anthropic client not available');
        }

        try {
            const response = await this.anthropicClient.messages.countTokens({
                model: this.model,
                messages: Array.isArray(messages) ? messages : [messages]
            });
            
            return {
                input_tokens: response.input_tokens,
                total_tokens: response.input_tokens,
                source: 'api'
            };
        } catch (error) {
            console.warn('TokenCounter API error:', error.message);
            throw error;
        }
    }

    /**
     * Estimate tokens using character-based fallback
     */
    estimateTokensFallback(content) {
        const text = typeof content === 'string' ? content : JSON.stringify(content);
        const estimatedTokens = Math.ceil(text.length / this.fallbackRatio);
        
        return {
            input_tokens: estimatedTokens,
            total_tokens: estimatedTokens,
            source: 'estimate'
        };
    }

    /**
     * Get cached token count or calculate new one
     */
    getCachedCount(content) {
        const contentHash = this.hashContent(content);
        return this.cache.get(contentHash);
    }

    /**
     * Cache token count with LRU eviction
     */
    setCachedCount(content, tokenData) {
        if (this.cache.size >= this.cacheMaxSize) {
            // Remove oldest entry (first key)
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        const contentHash = this.hashContent(content);
        this.cache.set(contentHash, {
            ...tokenData,
            cachedAt: Date.now()
        });
    }

    /**
     * Generate simple hash for content caching
     */
    hashContent(content) {
        const str = typeof content === 'string' ? content : JSON.stringify(content);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    /**
     * Count tokens with fallback strategy
     */
    async countTokens(content, options = {}) {
        const useCache = options.cache !== false;
        const forceAPI = options.forceAPI === true;
        const forceEstimate = options.forceEstimate === true;
        
        // Check cache first
        if (useCache) {
            const cached = this.getCachedCount(content);
            if (cached) {
                return {
                    ...cached,
                    fromCache: true
                };
            }
        }

        let tokenData;

        try {
            if (forceEstimate) {
                // Force estimation mode
                tokenData = this.estimateTokensFallback(content);
            } else if (this.anthropicClient && !forceAPI) {
                // Try API first, fallback to estimation
                try {
                    tokenData = await this.countTokensAPI(content);
                } catch (error) {
                    console.log('TokenCounter: API failed, using fallback estimation');
                    tokenData = this.estimateTokensFallback(content);
                }
            } else {
                // Use estimation directly
                tokenData = this.estimateTokensFallback(content);
            }
        } catch (error) {
            // Final fallback
            tokenData = this.estimateTokensFallback(content);
        }

        // Cache result
        if (useCache) {
            this.setCachedCount(content, tokenData);
        }

        return {
            ...tokenData,
            fromCache: false
        };
    }

    /**
     * Count tokens in Factor 3 XML context format
     */
    async countContextTokens(contextXml) {
        return await this.countTokens(contextXml, { cache: true });
    }

    /**
     * Count tokens in standard message format
     */
    async countMessagesTokens(messages) {
        if (!Array.isArray(messages)) {
            messages = [messages];
        }

        try {
            if (this.anthropicClient) {
                return await this.countTokensAPI(messages);
            } else {
                // Estimate based on combined message content
                const combinedContent = messages.map(msg => 
                    typeof msg === 'string' ? msg : 
                    msg.content || JSON.stringify(msg)
                ).join('\n');
                
                return await this.countTokens(combinedContent, { cache: true });
            }
        } catch (error) {
            console.warn('Message token counting failed:', error.message);
            return this.estimateTokensFallback(JSON.stringify(messages));
        }
    }

    /**
     * Calculate percentage until auto-compact
     * Returns percentage remaining before hitting limit (100% = at limit, 0% = empty)
     */
    calculatePercentageUntilCompact(currentTokens, model = this.model) {
        const limit = this.getContextLimit(model);
        const usedPercentage = (currentTokens / limit) * 100;
        const remainingPercentage = Math.max(0, 100 - usedPercentage);
        
        return {
            usedPercentage: Math.min(100, usedPercentage),
            remainingPercentage,
            currentTokens,
            limitTokens: limit,
            isNearLimit: usedPercentage > 60, // Warning at 60%
            isCritical: usedPercentage > 90,  // Critical at 90%
            shouldCompact: usedPercentage > 95 // Emergency compact at 95%
        };
    }

    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            maxSize: this.cacheMaxSize,
            hitRate: this.cacheHits / Math.max(1, this.cacheHits + this.cacheMisses),
            entries: Array.from(this.cache.entries()).map(([hash, data]) => ({
                hash,
                tokens: data.total_tokens,
                source: data.source,
                age: Date.now() - data.cachedAt
            }))
        };
    }

    /**
     * Clear token cache
     */
    clearCache() {
        this.cache.clear();
        console.log('TokenCounter: Cache cleared');
    }

    /**
     * Demo function showing token counting capabilities
     */
    async demo() {
        console.log('🔢 TokenCounter Demo - Accurate Context Monitoring\n');
        
        const testContent = `
        <workflow_context>
            <slack_message>
                timestamp: "2024-03-15T10:00:00Z"
                From: @alex
                Channel: #deployments  
                Text: Can you deploy the backend?
                Thread: []
            </slack_message>
            
            <github_action>
                timestamp: "2024-03-15T10:00:15Z"
                action: list_git_tags
                repository: backend-service
                tags: [
                    { name: "v1.2.3", commit: "abc123", date: "2024-03-15T10:00:00Z" },
                    { name: "v1.2.2", commit: "def456", date: "2024-03-14T15:30:00Z" }
                ]
            </github_action>
        </workflow_context>
        `;

        console.log('📄 Test Context (Factor 3 XML format):');
        console.log(testContent.substring(0, 200) + '...\n');

        // Count tokens different ways
        console.log('🔍 Token Counting Methods:');
        
        // Estimation method
        const estimated = await this.countTokens(testContent, { forceEstimate: true });
        console.log(`📊 Estimation (${this.fallbackRatio} chars/token): ${estimated.total_tokens} tokens`);
        
        // API method (if available)
        if (this.anthropicClient) {
            try {
                const apiResult = await this.countTokens(testContent, { forceAPI: true });
                console.log(`🎯 API Count: ${apiResult.total_tokens} tokens`);
                
                const accuracy = (1 - Math.abs(estimated.total_tokens - apiResult.total_tokens) / apiResult.total_tokens) * 100;
                console.log(`📈 Estimation Accuracy: ${accuracy.toFixed(1)}%`);
            } catch (error) {
                console.log(`❌ API Count: Failed (${error.message})`);
            }
        } else {
            console.log('⚠️ API Count: Not available (no Anthropic SDK)');
        }

        // Context percentage analysis
        console.log('\n📊 Context Window Analysis:');
        const tokenCount = estimated.total_tokens;
        const percentage = this.calculatePercentageUntilCompact(tokenCount);
        
        console.log(`Current usage: ${tokenCount}/${percentage.limitTokens} tokens (${percentage.usedPercentage.toFixed(1)}%)`);
        console.log(`Remaining until auto-compact: ${percentage.remainingPercentage.toFixed(1)}%`);
        console.log(`Status: ${percentage.isCritical ? '🔴 CRITICAL' : percentage.isNearLimit ? '🟡 WARNING' : '🟢 SAFE'}`);
        
        // Cache statistics
        console.log('\n💾 Cache Performance:');
        const cacheStats = this.getCacheStats();
        console.log(`Cache size: ${cacheStats.size}/${cacheStats.maxSize} entries`);
        
        console.log('\n✅ TokenCounter demo completed!');
    }
}

module.exports = { TokenCounter };

// Run demo if called directly
if (require.main === module) {
    const counter = new TokenCounter();
    counter.demo().catch(console.error);
}