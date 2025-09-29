const { describe, it, expect, beforeEach } = require('@jest/globals');
const { ConfigManager } = require('../../claude-config-manager');
const path = require('path');

describe('Configuration Manager Unit Tests', () => {
    let configManager;

    beforeEach(() => {
        configManager = new ConfigManager({
            configPath: path.join(__dirname, '../fixtures/test-config.json')
        });
    });

    describe('Environment Variable Substitution', () => {
        it('should substitute environment variables in config', () => {
            const testConfig = {
                token: '${TEST_TOKEN}',
                nested: {
                    value: '${NESTED_VALUE}'
                }
            };

            configManager.envVars.set('TEST_TOKEN', 'test-123');
            configManager.envVars.set('NESTED_VALUE', 'nested-456');

            const processed = configManager.processConfiguration(testConfig);
            
            expect(processed.token).toBe('test-123');
            expect(processed.nested.value).toBe('nested-456');
        });

        it('should leave undefined variables unchanged', () => {
            const testConfig = {
                token: '${UNDEFINED_TOKEN}'
            };

            const processed = configManager.processConfiguration(testConfig);
            expect(processed.token).toBe('${UNDEFINED_TOKEN}');
        });
    });

    describe('Configuration Validation', () => {
        it('should validate required sections', async () => {
            const invalidConfig = { agents: {} };
            configManager.config = invalidConfig;

            await expect(configManager.validateConfiguration())
                .rejects.toThrow();
        });
    });
});
