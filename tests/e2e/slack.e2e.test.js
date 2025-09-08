const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const { SlackIntegration } = require('../../claude-slack-integration');

describe('Slack Integration E2E Tests', () => {
    let slackIntegration;

    beforeAll(async () => {
        // Mock Slack environment for testing
        process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
        process.env.SLACK_SIGNING_SECRET = 'test-signing-secret';
        process.env.SLACK_APP_TOKEN = 'xapp-test-token';
        
        slackIntegration = new SlackIntegration();
    });

    afterAll(async () => {
        // Clean up environment
        delete process.env.SLACK_BOT_TOKEN;
        delete process.env.SLACK_SIGNING_SECRET;
        delete process.env.SLACK_APP_TOKEN;
    });

    describe('Workflow Intent Parsing', () => {
        it('should parse deployment intent correctly', () => {
            const message = 'deploy to staging environment';
            const intent = slackIntegration.parseWorkflowIntent(message);
            
            expect(intent).toBe('deployment');
        });

        it('should parse security scan intent', () => {
            const message = 'run security scan on repository';
            const intent = slackIntegration.parseWorkflowIntent(message);
            
            expect(intent).toBe('security_scan');
        });

        it('should return null for unknown intent', () => {
            const message = 'hello world how are you';
            const intent = slackIntegration.parseWorkflowIntent(message);
            
            expect(intent).toBeNull();
        });
    });

    describe('Workflow Approval', () => {
        it('should check approval requirements correctly', () => {
            expect(slackIntegration.workflowRequiresApproval('deployment')).toBe(true);
            expect(slackIntegration.workflowRequiresApproval('security_scan')).toBe(true);
            expect(slackIntegration.workflowRequiresApproval('bug_fix')).toBe(false);
        });
    });
});
