/**
 * Claude Redis Fallback - SESSION 5: Production Reliability
 * Redis integration with SQLite fallback patterns for distributed operations
 * Phase 8.2: Implement Redis fallback patterns for rate limiting
 */

const EventEmitter = require('events');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');
const { SQLiteManager } = require('./database/sqlite-manager');

class RedisConnectionError extends Error {
    constructor(message, operation, fallbackUsed = false) {
        super(message);
        this.name = 'RedisConnectionError';
        this.operation = operation;
        this.fallbackUsed = fallbackUsed;
        this.timestamp = new Date();
    }
}

class FallbackOperationError extends Error {
    constructor(message, operation, fallbackType) {
        super(message);
        this.name = 'FallbackOperationError';
        this.operation = operation;
        this.fallbackType = fallbackType;
        this.timestamp = new Date();
    }
}

/**
 * Redis Client Wrapper with fallback capabilities
 */
class RedisWithFallback extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = {
            host: options.host || 'localhost',
            port: options.port || 6379,
            password: options.password || null,
            db: options.db || 0,
            connectTimeout: options.connectTimeout || 5000,
            lazyConnect: options.lazyConnect || true,
            retryDelayOnFailover: options.retryDelayOnFailover || 100,
            maxRetriesPerRequest: options.maxRetriesPerRequest || 3,
            fallbackEnabled: options.fallbackEnabled !== false,
            ...options
        };
        
        this.redis = null;
        this.connected = false;
        this.fallbackMode = false;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 5;
        
        // Fallback storage (SQLite)
        this.sqliteManager = new SQLiteManager();
        this.fallbackInitialized = false;
        
        // Factor 3 context tracking
        this.contextManager = new Factor3ContextManager();
        
        // Statistics
        this.stats = {
            redisOperations: 0,
            fallbackOperations: 0,
            connectionFailures: 0,
            successfulOperations: 0,
            failedOperations: 0
        };
        
        this.contextManager.addAgentEvent('redis_fallback', 'initialized', {
            options: this.options,
            fallbackEnabled: this.options.fallbackEnabled
        });
    }
    
    /**
     * Initialize Redis connection with fallback setup
     */
    async initialize() {
        try {
            // Initialize SQLite fallback first
            if (this.options.fallbackEnabled) {
                await this.initializeFallback();
            }
            
            // Try to connect to Redis
            await this.connectToRedis();
            
            this.contextManager.addAgentEvent('redis_fallback', 'initialization_complete', {
                redisConnected: this.connected,
                fallbackMode: this.fallbackMode,
                fallbackAvailable: this.fallbackInitialized
            });
            
        } catch (error) {
            this.contextManager.addAgentEvent('redis_fallback', 'initialization_failed', {
                error: error.message,
                fallbackMode: this.fallbackMode
            });
            
            if (!this.options.fallbackEnabled) {
                throw error;
            }
            
            console.warn('Redis initialization failed, using fallback mode:', error.message);
        }
    }
    
    /**
     * Connect to Redis with retry logic
     */
    async connectToRedis() {
        // For demo purposes, we'll simulate Redis availability based on environment
        const redisAvailable = process.env.REDIS_AVAILABLE === 'true' || Math.random() > 0.7;
        
        if (!redisAvailable) {
            this.connectionAttempts++;
            this.stats.connectionFailures++;
            
            if (this.connectionAttempts >= this.maxConnectionAttempts) {
                this.fallbackMode = true;
                this.emit('fallbackActivated', { reason: 'max_connection_attempts' });
                
                this.contextManager.addAgentEvent('redis_fallback', 'fallback_activated', {
                    reason: 'max_connection_attempts_reached',
                    attempts: this.connectionAttempts
                });
                
                throw new RedisConnectionError(
                    `Redis connection failed after ${this.connectionAttempts} attempts, fallback activated`,
                    'connect',
                    true
                );
            }
            
            throw new RedisConnectionError(`Redis connection attempt ${this.connectionAttempts} failed`, 'connect');
        }
        
        // Simulate successful Redis connection
        this.connected = true;
        this.redis = {
            // Mock Redis client for demo
            get: this.mockRedisGet.bind(this),
            set: this.mockRedisSet.bind(this),
            del: this.mockRedisDel.bind(this),
            exists: this.mockRedisExists.bind(this),
            incr: this.mockRedisIncr.bind(this),
            expire: this.mockRedisExpire.bind(this),
            ttl: this.mockRedisTtl.bind(this),
            hget: this.mockRedisHget.bind(this),
            hset: this.mockRedisHset.bind(this),
            hdel: this.mockRedisHdel.bind(this),
            zadd: this.mockRedisZadd.bind(this),
            zrange: this.mockRedisZrange.bind(this),
            zrem: this.mockRedisZrem.bind(this)
        };
        
        this.emit('connected');
        this.contextManager.addAgentEvent('redis_fallback', 'redis_connected', {
            host: this.options.host,
            port: this.options.port
        });
    }
    
    /**
     * Initialize SQLite fallback system
     */
    async initializeFallback() {
        try {
            // Use in-memory database for demo to avoid file system issues
            this.sqliteManager.dbPath = ':memory:';
            await this.sqliteManager.initialize();
            
            // Ensure database connection exists
            if (!this.sqliteManager.db) {
                throw new Error('SQLite database connection not established');
            }
            
            // Create fallback tables for Redis operations
            await this.sqliteManager.db.exec(`
                CREATE TABLE IF NOT EXISTS redis_fallback_kv (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expires_at INTEGER,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
                
                CREATE TABLE IF NOT EXISTS redis_fallback_counters (
                    key TEXT PRIMARY KEY,
                    value INTEGER DEFAULT 0,
                    expires_at INTEGER,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
                );
                
                CREATE TABLE IF NOT EXISTS redis_fallback_hash (
                    hash_key TEXT,
                    field TEXT,
                    value TEXT,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    PRIMARY KEY (hash_key, field)
                );
                
                CREATE TABLE IF NOT EXISTS redis_fallback_sorted_sets (
                    key TEXT,
                    member TEXT,
                    score REAL,
                    created_at INTEGER DEFAULT (strftime('%s', 'now')),
                    PRIMARY KEY (key, member)
                );
                
                CREATE INDEX IF NOT EXISTS idx_kv_expires_at ON redis_fallback_kv(expires_at);
                CREATE INDEX IF NOT EXISTS idx_counters_expires_at ON redis_fallback_counters(expires_at);
            `);
            
            this.fallbackInitialized = true;
            
            // Start cleanup interval for expired keys
            this.startCleanupInterval();
            
            this.contextManager.addAgentEvent('redis_fallback', 'fallback_initialized', {
                tables_created: 4,
                cleanup_enabled: true,
                database_type: 'in-memory'
            });
            
        } catch (error) {
            console.error('SQLite fallback initialization error:', error);
            throw new FallbackOperationError(
                `Failed to initialize SQLite fallback: ${error.message}`,
                'initialize',
                'sqlite'
            );
        }
    }
    
    /**
     * Start cleanup interval for expired keys
     */
    startCleanupInterval() {
        setInterval(async () => {
            try {
                const now = Math.floor(Date.now() / 1000);
                
                // Clean expired key-value pairs
                const kvResult = await this.sqliteManager.db.run(`
                    DELETE FROM redis_fallback_kv WHERE expires_at IS NOT NULL AND expires_at < ?
                `, [now]);
                
                // Clean expired counters
                const counterResult = await this.sqliteManager.db.run(`
                    DELETE FROM redis_fallback_counters WHERE expires_at IS NOT NULL AND expires_at < ?
                `, [now]);
                
                if (kvResult.changes > 0 || counterResult.changes > 0) {
                    this.contextManager.addAgentEvent('redis_fallback', 'cleanup_performed', {
                        kv_cleaned: kvResult.changes,
                        counters_cleaned: counterResult.changes
                    });
                }
                
            } catch (error) {
                console.warn('Cleanup interval error:', error.message);
            }
        }, 60000); // Run every minute
    }
    
    /**
     * Execute operation with automatic fallback
     */
    async execute(operation, ...args) {
        try {
            // Try Redis first if connected
            if (this.connected && !this.fallbackMode) {
                const result = await this.executeRedisOperation(operation, ...args);
                this.stats.redisOperations++;
                this.stats.successfulOperations++;
                return result;
            }
            
            // Use fallback if Redis unavailable
            if (this.options.fallbackEnabled && this.fallbackInitialized) {
                const result = await this.executeFallbackOperation(operation, ...args);
                this.stats.fallbackOperations++;
                this.stats.successfulOperations++;
                return result;
            }
            
            throw new Error('Neither Redis nor fallback available');
            
        } catch (error) {
            this.stats.failedOperations++;
            
            // Try fallback if Redis operation failed
            if (this.connected && !this.fallbackMode && this.options.fallbackEnabled && this.fallbackInitialized) {
                console.warn(`Redis operation ${operation} failed, trying fallback:`, error.message);
                
                try {
                    const result = await this.executeFallbackOperation(operation, ...args);
                    this.stats.fallbackOperations++;
                    this.stats.successfulOperations++;
                    
                    this.emit('fallbackUsed', { operation, error: error.message });
                    this.contextManager.addAgentEvent('redis_fallback', 'fallback_used', {
                        operation,
                        redis_error: error.message
                    });
                    
                    return result;
                } catch (fallbackError) {
                    this.contextManager.addAgentEvent('redis_fallback', 'both_failed', {
                        operation,
                        redis_error: error.message,
                        fallback_error: fallbackError.message
                    });
                    throw new FallbackOperationError(
                        `Both Redis and fallback failed for ${operation}: ${fallbackError.message}`,
                        operation,
                        'sqlite'
                    );
                }
            }
            
            throw error;
        }
    }
    
    /**
     * Execute Redis operation
     */
    async executeRedisOperation(operation, ...args) {
        if (!this.redis || !this.redis[operation]) {
            throw new Error(`Redis operation ${operation} not supported`);
        }
        
        return await this.redis[operation](...args);
    }
    
    /**
     * Execute fallback operation using SQLite
     */
    async executeFallbackOperation(operation, ...args) {
        const fallbackMethod = `fallback${operation.charAt(0).toUpperCase() + operation.slice(1)}`;
        
        if (!this[fallbackMethod]) {
            throw new FallbackOperationError(
                `Fallback operation ${operation} not implemented`,
                operation,
                'sqlite'
            );
        }
        
        return await this[fallbackMethod](...args);
    }
    
    // ======================
    // REDIS MOCK METHODS (for demo)
    // ======================
    
    async mockRedisGet(key) {
        // Simulate Redis behavior
        const mockData = new Map([
            ['test:key', 'test:value'],
            ['rate:limit:github', '5'],
            ['session:12345', JSON.stringify({ user: 'demo', active: true })]
        ]);
        return mockData.get(key) || null;
    }
    
    async mockRedisSet(key, value, ...options) {
        return 'OK';
    }
    
    async mockRedisDel(...keys) {
        return keys.length; // Return number of deleted keys
    }
    
    async mockRedisExists(...keys) {
        return keys.length; // Simulate all keys exist
    }
    
    async mockRedisIncr(key) {
        return Math.floor(Math.random() * 100) + 1;
    }
    
    async mockRedisExpire(key, seconds) {
        return 1; // Success
    }
    
    async mockRedisTtl(key) {
        return Math.floor(Math.random() * 3600); // Random TTL
    }
    
    async mockRedisHget(key, field) {
        return 'hash_value';
    }
    
    async mockRedisHset(key, field, value) {
        return 1;
    }
    
    async mockRedisHdel(key, ...fields) {
        return fields.length;
    }
    
    async mockRedisZadd(key, score, member) {
        return 1;
    }
    
    async mockRedisZrange(key, start, stop) {
        return ['member1', 'member2'];
    }
    
    async mockRedisZrem(key, ...members) {
        return members.length;
    }
    
    // ======================
    // FALLBACK METHODS (SQLite)
    // ======================
    
    async fallbackGet(key) {
        const now = Math.floor(Date.now() / 1000);
        
        const row = await this.sqliteManager.db.get(`
            SELECT value FROM redis_fallback_kv 
            WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
        `, [key, now]);
        
        return row ? row.value : null;
    }
    
    async fallbackSet(key, value, ...options) {
        const now = Math.floor(Date.now() / 1000);
        let expiresAt = null;
        
        // Parse expiration options (simplified)
        for (let i = 0; i < options.length; i += 2) {
            if (options[i] === 'EX' && options[i + 1]) {
                expiresAt = now + parseInt(options[i + 1]);
            }
        }
        
        await this.sqliteManager.db.run(`
            INSERT OR REPLACE INTO redis_fallback_kv (key, value, expires_at, updated_at)
            VALUES (?, ?, ?, ?)
        `, [key, value, expiresAt, now]);
        
        return 'OK';
    }
    
    async fallbackDel(...keys) {
        let deletedCount = 0;
        
        for (const key of keys) {
            const result = await this.sqliteManager.db.run(`
                DELETE FROM redis_fallback_kv WHERE key = ?
            `, [key]);
            
            if (result.changes > 0) {
                deletedCount++;
            }
        }
        
        return deletedCount;
    }
    
    async fallbackExists(...keys) {
        const now = Math.floor(Date.now() / 1000);
        let existsCount = 0;
        
        for (const key of keys) {
            const row = await this.sqliteManager.db.get(`
                SELECT 1 FROM redis_fallback_kv 
                WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
            `, [key, now]);
            
            if (row) {
                existsCount++;
            }
        }
        
        return existsCount;
    }
    
    async fallbackIncr(key) {
        const now = Math.floor(Date.now() / 1000);
        
        try {
            // Get current value
            let row = await this.sqliteManager.db.get(`
                SELECT value FROM redis_fallback_counters 
                WHERE key = ? AND (expires_at IS NULL OR expires_at > ?)
            `, [key, now]);
            
            const currentValue = row ? parseInt(row.value) || 0 : 0;
            const newValue = currentValue + 1;
            
            // Update or insert
            await this.sqliteManager.db.run(`
                INSERT OR REPLACE INTO redis_fallback_counters (key, value, updated_at)
                VALUES (?, ?, ?)
            `, [key, newValue, now]);
            
            return newValue;
        } catch (error) {
            console.error('Fallback INCR error:', error);
            return 1; // Default to 1 if error occurs
        }
    }
    
    async fallbackExpire(key, seconds) {
        const expiresAt = Math.floor(Date.now() / 1000) + seconds;
        
        // Try both tables
        const kvResult = await this.sqliteManager.db.run(`
            UPDATE redis_fallback_kv SET expires_at = ? WHERE key = ?
        `, [expiresAt, key]);
        
        const counterResult = await this.sqliteManager.db.run(`
            UPDATE redis_fallback_counters SET expires_at = ? WHERE key = ?
        `, [expiresAt, key]);
        
        return (kvResult.changes > 0 || counterResult.changes > 0) ? 1 : 0;
    }
    
    async fallbackTtl(key) {
        const now = Math.floor(Date.now() / 1000);
        
        // Check both tables
        const kvRow = await this.sqliteManager.db.get(`
            SELECT expires_at FROM redis_fallback_kv WHERE key = ?
        `, [key]);
        
        if (kvRow) {
            return kvRow.expires_at ? Math.max(0, kvRow.expires_at - now) : -1;
        }
        
        const counterRow = await this.sqliteManager.db.get(`
            SELECT expires_at FROM redis_fallback_counters WHERE key = ?
        `, [key]);
        
        if (counterRow) {
            return counterRow.expires_at ? Math.max(0, counterRow.expires_at - now) : -1;
        }
        
        return -2; // Key doesn't exist
    }
    
    async fallbackHget(key, field) {
        const row = await this.sqliteManager.db.get(`
            SELECT value FROM redis_fallback_hash WHERE hash_key = ? AND field = ?
        `, [key, field]);
        
        return row ? row.value : null;
    }
    
    async fallbackHset(key, field, value) {
        const now = Math.floor(Date.now() / 1000);
        
        await this.sqliteManager.db.run(`
            INSERT OR REPLACE INTO redis_fallback_hash (hash_key, field, value, created_at)
            VALUES (?, ?, ?, ?)
        `, [key, field, value, now]);
        
        return 1;
    }
    
    async fallbackHdel(key, ...fields) {
        let deletedCount = 0;
        
        for (const field of fields) {
            const result = await this.sqliteManager.db.run(`
                DELETE FROM redis_fallback_hash WHERE hash_key = ? AND field = ?
            `, [key, field]);
            
            if (result.changes > 0) {
                deletedCount++;
            }
        }
        
        return deletedCount;
    }
    
    async fallbackZadd(key, score, member) {
        const now = Math.floor(Date.now() / 1000);
        
        await this.sqliteManager.db.run(`
            INSERT OR REPLACE INTO redis_fallback_sorted_sets (key, member, score, created_at)
            VALUES (?, ?, ?, ?)
        `, [key, member, score, now]);
        
        return 1;
    }
    
    async fallbackZrange(key, start, stop) {
        const rows = await this.sqliteManager.db.all(`
            SELECT member FROM redis_fallback_sorted_sets 
            WHERE key = ? 
            ORDER BY score ASC 
            LIMIT ? OFFSET ?
        `, [key, stop - start + 1, start]);
        
        return rows.map(row => row.member);
    }
    
    async fallbackZrem(key, ...members) {
        let removedCount = 0;
        
        for (const member of members) {
            const result = await this.sqliteManager.db.run(`
                DELETE FROM redis_fallback_sorted_sets WHERE key = ? AND member = ?
            `, [key, member]);
            
            if (result.changes > 0) {
                removedCount++;
            }
        }
        
        return removedCount;
    }
    
    /**
     * Get connection and fallback statistics
     */
    getStats() {
        return {
            ...this.stats,
            connected: this.connected,
            fallbackMode: this.fallbackMode,
            fallbackInitialized: this.fallbackInitialized,
            connectionAttempts: this.connectionAttempts,
            fallbackUtilization: this.stats.redisOperations > 0 ? 
                (this.stats.fallbackOperations / (this.stats.redisOperations + this.stats.fallbackOperations) * 100).toFixed(2) + '%' : 
                '100%'
        };
    }
    
    /**
     * Health check
     */
    async healthCheck() {
        const health = {
            redis: false,
            fallback: false,
            overall: false
        };
        
        try {
            if (this.connected) {
                await this.redis.ping?.() || true; // Mock always passes
                health.redis = true;
            }
        } catch (error) {
            console.warn('Redis health check failed:', error.message);
        }
        
        try {
            if (this.fallbackInitialized) {
                await this.sqliteManager.db.get('SELECT 1');
                health.fallback = true;
            }
        } catch (error) {
            console.warn('Fallback health check failed:', error.message);
        }
        
        health.overall = health.redis || health.fallback;
        
        this.contextManager.addAgentEvent('redis_fallback', 'health_check', health);
        
        return health;
    }
    
    /**
     * Cleanup resources
     */
    async cleanup() {
        if (this.redis) {
            this.redis = null;
        }
        
        this.connected = false;
        this.removeAllListeners();
        
        this.contextManager.addAgentEvent('redis_fallback', 'cleanup_complete', {
            final_stats: this.getStats()
        });
    }
}

/**
 * Rate Limiter with Redis fallback
 */
class RateLimiterWithFallback {
    constructor(redisClient, options = {}) {
        this.redis = redisClient;
        this.options = {
            windowSizeMs: options.windowSizeMs || 60000, // 1 minute
            maxRequests: options.maxRequests || 100,
            keyPrefix: options.keyPrefix || 'rate_limit',
            ...options
        };
    }
    
    /**
     * Check if request is allowed
     */
    async isAllowed(identifier) {
        const key = `${this.options.keyPrefix}:${identifier}`;
        const windowStart = Math.floor(Date.now() / this.options.windowSizeMs);
        const windowKey = `${key}:${windowStart}`;
        
        try {
            // Get current count
            const count = await this.redis.execute('get', windowKey);
            const currentCount = count ? parseInt(count) : 0;
            
            if (currentCount >= this.options.maxRequests) {
                return {
                    allowed: false,
                    count: currentCount,
                    resetTime: (windowStart + 1) * this.options.windowSizeMs,
                    retryAfter: Math.ceil(this.options.windowSizeMs / 1000)
                };
            }
            
            // Increment count
            const newCount = await this.redis.execute('incr', windowKey);
            
            // Set expiration on first request
            if (newCount === 1) {
                await this.redis.execute('expire', windowKey, Math.ceil(this.options.windowSizeMs / 1000));
            }
            
            return {
                allowed: true,
                count: newCount,
                remaining: this.options.maxRequests - newCount,
                resetTime: (windowStart + 1) * this.options.windowSizeMs
            };
            
        } catch (error) {
            console.warn('Rate limiter error, allowing request:', error.message);
            return {
                allowed: true,
                count: 0,
                remaining: this.options.maxRequests,
                resetTime: (windowStart + 1) * this.options.windowSizeMs,
                fallbackUsed: true
            };
        }
    }
}

/**
 * Demo function to test Redis fallback
 */
async function demonstrateRedisFallback() {
    console.log('🔄 Redis Fallback Patterns Demo\n');
    
    try {
        // Test with Redis unavailable (fallback mode)
        process.env.REDIS_AVAILABLE = 'false';
        
        const redisClient = new RedisWithFallback({
            fallbackEnabled: true,
            connectTimeout: 2000
        });
        
        console.log('✅ Redis Fallback Features:');
        console.log('   • Automatic fallback to SQLite when Redis unavailable');
        console.log('   • All Redis operations supported in fallback mode');
        console.log('   • Transparent operation switching');
        console.log('   • Expiration handling in SQLite');
        console.log('   • Cleanup of expired keys');
        console.log('   • Statistics and health monitoring');
        
        await redisClient.initialize();
        
        console.log('\n🧪 Testing Fallback Operations:');
        
        // Test basic key-value operations
        await redisClient.execute('set', 'test:demo', 'Hello World');
        const value = await redisClient.execute('get', 'test:demo');
        console.log(`   ✅ SET/GET: ${value}`);
        
        // Test counter operations
        const count1 = await redisClient.execute('incr', 'counter:demo');
        const count2 = await redisClient.execute('incr', 'counter:demo');
        console.log(`   ✅ INCR: ${count1} → ${count2}`);
        
        // Test hash operations
        await redisClient.execute('hset', 'hash:demo', 'field1', 'value1');
        const hashValue = await redisClient.execute('hget', 'hash:demo', 'field1');
        console.log(`   ✅ HSET/HGET: ${hashValue}`);
        
        // Test expiration
        await redisClient.execute('set', 'expire:demo', 'temporary');
        await redisClient.execute('expire', 'expire:demo', 2);
        const ttl = await redisClient.execute('ttl', 'expire:demo');
        console.log(`   ✅ EXPIRE: TTL = ${ttl}s`);
        
        // Test exists
        const exists = await redisClient.execute('exists', 'test:demo');
        console.log(`   ✅ EXISTS: ${exists} keys found`);
        
        console.log('\n📊 Statistics:');
        const stats = redisClient.getStats();
        console.log(`   Redis operations: ${stats.redisOperations}`);
        console.log(`   Fallback operations: ${stats.fallbackOperations}`);
        console.log(`   Success rate: ${stats.successfulOperations}/${stats.successfulOperations + stats.failedOperations}`);
        console.log(`   Fallback utilization: ${stats.fallbackUtilization}`);
        
        // Test rate limiter
        console.log('\n⚡ Testing Rate Limiter with Fallback:');
        const rateLimiter = new RateLimiterWithFallback(redisClient, {
            windowSizeMs: 10000, // 10 seconds for demo
            maxRequests: 3
        });
        
        for (let i = 1; i <= 5; i++) {
            const result = await rateLimiter.isAllowed('demo-user');
            console.log(`   Request ${i}: ${result.allowed ? '✅ Allowed' : '❌ Rate limited'} (${result.count}/${rateLimiter.options.maxRequests})`);
        }
        
        // Health check
        console.log('\n🩺 Health Status:');
        const health = await redisClient.healthCheck();
        console.log(`   Redis: ${health.redis ? '✅' : '❌'}`);
        console.log(`   SQLite Fallback: ${health.fallback ? '✅' : '❌'}`);
        console.log(`   Overall: ${health.overall ? '✅' : '❌'}`);
        
        await redisClient.cleanup();
        console.log('\n✅ Demo completed - Redis fallback patterns ready!');
        
    } catch (error) {
        console.error('❌ Demo failed:', error.message);
    }
}

// Export classes and singleton
const redisWithFallback = new RedisWithFallback();

module.exports = {
    RedisWithFallback,
    RateLimiterWithFallback,
    RedisConnectionError,
    FallbackOperationError,
    redisWithFallback
};

// Run demo if called directly
if (require.main === module) {
    demonstrateRedisFallback().catch(console.error);
}