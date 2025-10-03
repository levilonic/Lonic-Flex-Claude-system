/**
 * ServiceBase - Base class for all LonicFLex services
 *
 * Provides common functionality for service classes including:
 * - Evidence-based validation
 * - Standard service patterns
 * - Extensible validation logic
 *
 * All LonicFLex services should extend this class to ensure consistent
 * behavior and validation patterns.
 */

class ServiceBase {
    /**
     * Validate success of operation with evidence collection
     *
     * This method provides basic success validation for service operations.
     * Services can override this method to implement custom validation logic
     * based on their specific requirements.
     *
     * @param {Object} options - Validation options
     * @param {Object} options.evidence - Evidence object to validate
     * @param {string} options.operation - Operation name for logging
     * @param {Object} options.criteria - Validation criteria
     * @returns {boolean} True if operation succeeded, false otherwise
     *
     * @example
     * const validation = { success: this.validateSuccess() };
     * return {
     *     success: validation.success,
     *     data: result
     * };
     */
    validateSuccess(options = {}) {
        const {
            evidence = {},
            operation = 'unknown',
            criteria = {}
        } = options;

        // Default validation: if no error was thrown, operation succeeded
        // Services can override this method for custom validation logic

        // Basic evidence-based validation
        if (Object.keys(criteria).length > 0) {
            // If criteria provided, validate against evidence
            for (const [key, expectedValue] of Object.entries(criteria)) {
                if (evidence[key] !== expectedValue) {
                    return false;
                }
            }
        }

        // Default: operation succeeded if we got here without errors
        return true;
    }

    /**
     * Get service health status
     * Services can override to provide specific health checks
     *
     * @returns {Object} Health status object
     */
    getHealthStatus() {
        return {
            healthy: this.isInitialized || false,
            service: this.config?.serviceName || 'unknown',
            uptime: this.startTime ? Date.now() - this.startTime.getTime() : 0,
            initialized: this.isInitialized || false
        };
    }

    /**
     * Validate service configuration
     * Services can override to implement specific config validation
     *
     * @param {Object} config - Service configuration
     * @returns {boolean} True if configuration is valid
     */
    validateConfig(config = {}) {
        // Basic validation - services should override for specific checks
        return config !== null && typeof config === 'object';
    }
}

module.exports = { ServiceBase };
