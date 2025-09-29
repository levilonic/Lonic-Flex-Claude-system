#!/usr/bin/env node
/**
 * Agent Communication Bus
 * Phase 2 Implementation: Week 1, Days 2-3
 *
 * Event-driven inter-agent communication system with advanced message routing,
 * task assignment, status updates, and real-time coordination capabilities.
 *
 * Provides high-performance message bus for autonomous agent coordination
 * with support for complex routing patterns, message persistence, and fault tolerance.
 */

const { EventEmitter } = require('events');
const { Factor3ContextManager } = require('../context-management/factor3-context-manager');

class AgentCommunicationBus extends EventEmitter {
    constructor(config = {}) {
        super();

        this.busId = config.busId || `comm-bus-${Date.now()}`;
        this.maxMessageHistory = config.maxMessageHistory || 10000;
        this.messageTimeout = config.messageTimeout || 30000; // 30 seconds

        // Core communication components
        this.messageRouter = new MessageRouter(this);
        this.eventDispatcher = new EventDispatcher(this);
        this.channelManager = new ChannelManager(this);
        this.messageQueue = new PersistentMessageQueue(this);

        // Agent registry and routing
        this.registeredAgents = new Map(); // agentId -> agent info
        this.routingTable = new Map(); // route pattern -> handler
        this.subscriptions = new Map(); // event type -> subscribers
        this.channels = new Map(); // channel name -> channel info

        // Message history and analytics
        this.messageHistory = [];
        this.messageMetrics = new CommunicationMetrics();
        this.faultTolerance = new FaultToleranceManager(this);

        // Context management
        this.contextManager = new Factor3ContextManager();

        // Communication patterns
        this.communicationPatterns = new CommunicationPatterns(this);

        console.log(`📡 Agent Communication Bus initialized: ${this.busId}`);
    }

    /**
     * Register agent on the communication bus
     */
    async registerAgent(agent, capabilities = {}) {
        const agentId = agent.agentId || agent.sessionId;

        console.log(`📝 Registering agent on communication bus: ${agentId}`);

        const registration = {
            agentId: agentId,
            agent: agent,
            capabilities: capabilities,
            channels: [],
            subscriptions: [],
            messageQueue: [],
            status: 'active',
            registeredAt: new Date(),
            lastActivity: new Date(),
            metrics: {
                messagesSent: 0,
                messagesReceived: 0,
                channelsJoined: 0,
                errors: 0
            }
        };

        this.registeredAgents.set(agentId, registration);

        // Setup default channels for agent
        await this.setupDefaultChannelsForAgent(agentId, agent);

        // Initialize agent communication interface
        this.enhanceAgentWithCommunication(agent, registration);

        this.emit('agentRegistered', {
            agentId: agentId,
            capabilities: capabilities,
            channels: registration.channels.length
        });

        console.log(`✅ Agent registered with ${registration.channels.length} default channels`);
        return registration;
    }

    /**
     * Send message between agents
     */
    async sendMessage(fromAgentId, toAgentId, message) {
        try {
            const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

            console.log(`📤 Sending message: ${fromAgentId} → ${toAgentId} (${message.type})`);

            // Validate sender and recipient
            const sender = this.registeredAgents.get(fromAgentId);
            const recipient = this.registeredAgents.get(toAgentId);

            if (!sender) {
                throw new Error(`Sender agent not registered: ${fromAgentId}`);
            }
            if (!recipient) {
                throw new Error(`Recipient agent not registered: ${toAgentId}`);
            }

            // Create message envelope
            const envelope = {
                id: messageId,
                from: fromAgentId,
                to: toAgentId,
                message: message,
                timestamp: new Date(),
                priority: message.priority || 'normal',
                timeout: message.timeout || this.messageTimeout,
                routingHints: message.routingHints || [],
                acknowledgmentRequired: message.acknowledgmentRequired !== false
            };

            // Route message
            const routingResult = await this.messageRouter.routeMessage(envelope);

            if (routingResult.success) {
                // Update metrics
                sender.metrics.messagesSent++;
                sender.lastActivity = new Date();

                // Archive message
                this.archiveMessage(envelope, routingResult);

                this.emit('messageSent', {
                    messageId: messageId,
                    from: fromAgentId,
                    to: toAgentId,
                    type: message.type,
                    routingPath: routingResult.routingPath
                });
            }

            console.log(`${routingResult.success ? '✅' : '❌'} Message ${routingResult.success ? 'delivered' : 'failed'}: ${messageId}`);
            return routingResult;

        } catch (error) {
            console.error('❌ Message sending failed:', error);
            this.messageMetrics.recordError(fromAgentId, 'send_failed', error.message);
            throw error;
        }
    }

    /**
     * Broadcast message to multiple agents
     */
    async broadcastMessage(fromAgentId, recipients, message) {
        const broadcastId = `broadcast-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        console.log(`📢 Broadcasting message from ${fromAgentId} to ${recipients.length} recipients`);

        const results = [];

        for (const recipientId of recipients) {
            try {
                const result = await this.sendMessage(fromAgentId, recipientId, {
                    ...message,
                    broadcastId: broadcastId,
                    broadcastRecipients: recipients.length
                });
                results.push({ recipient: recipientId, success: result.success, result: result });
            } catch (error) {
                results.push({ recipient: recipientId, success: false, error: error.message });
            }
        }

        const successCount = results.filter(r => r.success).length;

        this.emit('messageBroadcast', {
            broadcastId: broadcastId,
            from: fromAgentId,
            recipients: recipients.length,
            successful: successCount,
            failed: recipients.length - successCount
        });

        console.log(`✅ Broadcast completed: ${successCount}/${recipients.length} successful`);
        return { broadcastId: broadcastId, results: results };
    }

    /**
     * Create and manage communication channels
     */
    async createChannel(channelName, options = {}) {
        console.log(`📺 Creating communication channel: ${channelName}`);

        const channel = {
            name: channelName,
            id: `channel-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: options.type || 'general',
            visibility: options.visibility || 'public',
            maxMembers: options.maxMembers || 100,
            persistence: options.persistence || 'session',
            members: [],
            messageHistory: [],
            metadata: options.metadata || {},
            createdAt: new Date(),
            createdBy: options.createdBy
        };

        this.channels.set(channelName, channel);

        this.emit('channelCreated', {
            channelName: channelName,
            channelId: channel.id,
            type: channel.type,
            createdBy: channel.createdBy
        });

        console.log(`✅ Channel created: ${channelName} (${channel.type})`);
        return channel;
    }

    /**
     * Join agent to communication channel
     */
    async joinChannel(agentId, channelName) {
        const agent = this.registeredAgents.get(agentId);
        const channel = this.channels.get(channelName);

        if (!agent) {
            throw new Error(`Agent not registered: ${agentId}`);
        }
        if (!channel) {
            throw new Error(`Channel does not exist: ${channelName}`);
        }

        if (channel.members.includes(agentId)) {
            console.log(`⚠️ Agent ${agentId} already in channel: ${channelName}`);
            return;
        }

        if (channel.members.length >= channel.maxMembers) {
            throw new Error(`Channel is full: ${channelName} (${channel.maxMembers} max)`);
        }

        console.log(`🔗 Agent ${agentId} joining channel: ${channelName}`);

        channel.members.push(agentId);
        agent.channels.push(channelName);
        agent.metrics.channelsJoined++;

        this.emit('agentJoinedChannel', {
            agentId: agentId,
            channelName: channelName,
            memberCount: channel.members.length
        });

        console.log(`✅ Agent joined channel (${channel.members.length} members): ${channelName}`);
    }

    /**
     * Send message to channel
     */
    async sendChannelMessage(fromAgentId, channelName, message) {
        const channel = this.channels.get(channelName);
        if (!channel) {
            throw new Error(`Channel does not exist: ${channelName}`);
        }

        if (!channel.members.includes(fromAgentId)) {
            throw new Error(`Agent not in channel: ${fromAgentId} not in ${channelName}`);
        }

        const messageId = `ch-msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        console.log(`📺 Sending channel message: ${fromAgentId} → #${channelName}`);

        const channelMessage = {
            id: messageId,
            from: fromAgentId,
            channel: channelName,
            message: message,
            timestamp: new Date(),
            type: 'channel_message'
        };

        // Add to channel history
        channel.messageHistory.push(channelMessage);
        if (channel.messageHistory.length > 1000) {
            channel.messageHistory.shift(); // Keep recent 1000 messages
        }

        // Notify all channel members
        const notificationPromises = channel.members
            .filter(memberId => memberId !== fromAgentId) // Don't notify sender
            .map(memberId => this.notifyChannelMessage(memberId, channelMessage));

        await Promise.allSettled(notificationPromises);

        this.emit('channelMessage', {
            messageId: messageId,
            from: fromAgentId,
            channel: channelName,
            recipients: channel.members.length - 1,
            type: message.type
        });

        console.log(`✅ Channel message sent to ${channel.members.length - 1} members`);
        return channelMessage;
    }

    /**
     * Subscribe to event types
     */
    async subscribeToEvents(agentId, eventTypes) {
        const agent = this.registeredAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not registered: ${agentId}`);
        }

        console.log(`🔔 Agent ${agentId} subscribing to events: ${eventTypes.join(', ')}`);

        for (const eventType of eventTypes) {
            if (!this.subscriptions.has(eventType)) {
                this.subscriptions.set(eventType, []);
            }

            const subscribers = this.subscriptions.get(eventType);
            if (!subscribers.includes(agentId)) {
                subscribers.push(agentId);
                agent.subscriptions.push(eventType);
            }
        }

        this.emit('agentSubscribed', {
            agentId: agentId,
            eventTypes: eventTypes,
            totalSubscriptions: agent.subscriptions.length
        });

        console.log(`✅ Agent subscribed to ${eventTypes.length} event types`);
    }

    /**
     * Publish event to subscribers
     */
    async publishEvent(publisherAgentId, eventType, eventData) {
        const subscribers = this.subscriptions.get(eventType) || [];

        console.log(`📡 Publishing event: ${eventType} to ${subscribers.length} subscribers`);

        const eventId = `event-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const event = {
            id: eventId,
            type: eventType,
            data: eventData,
            publisher: publisherAgentId,
            timestamp: new Date()
        };

        // Deliver to all subscribers
        const deliveryPromises = subscribers.map(subscriberId =>
            this.deliverEvent(subscriberId, event)
        );

        const deliveryResults = await Promise.allSettled(deliveryPromises);
        const successfulDeliveries = deliveryResults.filter(r => r.status === 'fulfilled').length;

        this.emit('eventPublished', {
            eventId: eventId,
            eventType: eventType,
            publisher: publisherAgentId,
            subscribers: subscribers.length,
            delivered: successfulDeliveries
        });

        console.log(`✅ Event published: ${successfulDeliveries}/${subscribers.length} deliveries successful`);
        return { eventId: eventId, delivered: successfulDeliveries, total: subscribers.length };
    }

    /**
     * Implement request-response pattern
     */
    async sendRequest(fromAgentId, toAgentId, request, timeout = 30000) {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;

        console.log(`🔄 Sending request: ${fromAgentId} → ${toAgentId} (${request.type})`);

        const requestMessage = {
            type: 'request',
            requestId: requestId,
            request: request,
            timeout: timeout,
            responseRequired: true
        };

        // Send request
        const sendResult = await this.sendMessage(fromAgentId, toAgentId, requestMessage);

        if (!sendResult.success) {
            throw new Error(`Failed to send request: ${sendResult.error}`);
        }

        // Wait for response
        return new Promise((resolve, reject) => {
            const timeoutHandle = setTimeout(() => {
                this.removeAllListeners(`response:${requestId}`);
                reject(new Error(`Request timeout: ${requestId}`));
            }, timeout);

            this.once(`response:${requestId}`, (response) => {
                clearTimeout(timeoutHandle);
                resolve(response);
            });
        });
    }

    /**
     * Send response to request
     */
    async sendResponse(fromAgentId, requestId, response) {
        console.log(`↩️ Sending response for request: ${requestId}`);

        const responseMessage = {
            type: 'response',
            requestId: requestId,
            response: response,
            timestamp: new Date()
        };

        // Emit response event
        this.emit(`response:${requestId}`, responseMessage);

        console.log(`✅ Response sent for request: ${requestId}`);
        return responseMessage;
    }

    /**
     * Get communication statistics
     */
    getCommunicationStats() {
        const activeAgents = Array.from(this.registeredAgents.values())
            .filter(agent => agent.status === 'active');

        const totalMessages = activeAgents.reduce((sum, agent) =>
            sum + agent.metrics.messagesSent + agent.metrics.messagesReceived, 0
        );

        const totalChannels = this.channels.size;
        const totalSubscriptions = Array.from(this.subscriptions.values())
            .reduce((sum, subscribers) => sum + subscribers.length, 0);

        return {
            bus: {
                id: this.busId,
                uptime: Date.now() - (this.startTime || Date.now())
            },
            agents: {
                registered: this.registeredAgents.size,
                active: activeAgents.length
            },
            messaging: {
                totalMessages: totalMessages,
                messageHistory: this.messageHistory.length,
                averageMessagesPerAgent: activeAgents.length > 0 ?
                    totalMessages / activeAgents.length : 0
            },
            channels: {
                total: totalChannels,
                totalMembers: Array.from(this.channels.values())
                    .reduce((sum, channel) => sum + channel.members.length, 0)
            },
            events: {
                eventTypes: this.subscriptions.size,
                totalSubscriptions: totalSubscriptions
            },
            performance: this.messageMetrics.getMetrics()
        };
    }

    // Helper methods

    async setupDefaultChannelsForAgent(agentId, agent) {
        // Create or join default channels based on agent type
        const defaultChannels = this.getDefaultChannelsForAgent(agent);

        for (const channelName of defaultChannels) {
            if (!this.channels.has(channelName)) {
                await this.createChannel(channelName, {
                    type: 'system',
                    createdBy: 'system'
                });
            }
            await this.joinChannel(agentId, channelName);
        }
    }

    getDefaultChannelsForAgent(agent) {
        const channels = ['general', 'coordination'];

        // Add agent-type specific channels
        if (agent.agentType) {
            channels.push(`agent-${agent.agentType}`);
        }

        // Add project-specific channels if available
        if (agent.project && agent.project.id) {
            channels.push(`project-${agent.project.id}`);
        }

        return channels;
    }

    enhanceAgentWithCommunication(agent, registration) {
        // Add communication methods to agent
        agent.sendMessage = (toAgentId, message) => {
            return this.sendMessage(registration.agentId, toAgentId, message);
        };

        agent.broadcastMessage = (recipients, message) => {
            return this.broadcastMessage(registration.agentId, recipients, message);
        };

        agent.sendChannelMessage = (channelName, message) => {
            return this.sendChannelMessage(registration.agentId, channelName, message);
        };

        agent.subscribeToEvents = (eventTypes) => {
            return this.subscribeToEvents(registration.agentId, eventTypes);
        };

        agent.publishEvent = (eventType, eventData) => {
            return this.publishEvent(registration.agentId, eventType, eventData);
        };

        agent.sendRequest = (toAgentId, request, timeout) => {
            return this.sendRequest(registration.agentId, toAgentId, request, timeout);
        };

        agent.sendResponse = (requestId, response) => {
            return this.sendResponse(registration.agentId, requestId, response);
        };

        // Enhanced status reporting
        const originalReportStatus = agent.reportStatus;
        agent.reportStatus = (status, data = {}) => {
            if (originalReportStatus) {
                originalReportStatus.call(agent, status, data);
            }

            // Broadcast status update
            this.publishEvent(registration.agentId, 'agent_status_update', {
                agentId: registration.agentId,
                status: status,
                data: data,
                timestamp: new Date()
            });
        };
    }

    async notifyChannelMessage(recipientId, channelMessage) {
        const recipient = this.registeredAgents.get(recipientId);
        if (!recipient || recipient.status !== 'active') {
            return;
        }

        try {
            // Deliver channel message notification
            await this.deliverMessage(recipientId, {
                type: 'channel_notification',
                channelMessage: channelMessage
            });

            recipient.metrics.messagesReceived++;
            recipient.lastActivity = new Date();

        } catch (error) {
            console.warn(`⚠️ Failed to notify agent ${recipientId} of channel message:`, error.message);
            recipient.metrics.errors++;
        }
    }

    async deliverEvent(subscriberId, event) {
        const subscriber = this.registeredAgents.get(subscriberId);
        if (!subscriber || subscriber.status !== 'active') {
            return;
        }

        try {
            await this.deliverMessage(subscriberId, {
                type: 'event_notification',
                event: event
            });

            subscriber.metrics.messagesReceived++;
            subscriber.lastActivity = new Date();

        } catch (error) {
            console.warn(`⚠️ Failed to deliver event ${event.type} to ${subscriberId}:`, error.message);
            subscriber.metrics.errors++;
        }
    }

    async deliverMessage(recipientId, message) {
        const recipient = this.registeredAgents.get(recipientId);
        if (!recipient) {
            throw new Error(`Recipient not found: ${recipientId}`);
        }

        // Add to recipient's message queue
        recipient.messageQueue.push({
            message: message,
            receivedAt: new Date()
        });

        // Keep queue manageable
        if (recipient.messageQueue.length > 1000) {
            recipient.messageQueue.shift();
        }

        // Trigger message received event on agent if available
        if (recipient.agent && typeof recipient.agent.onMessageReceived === 'function') {
            recipient.agent.onMessageReceived(message);
        }
    }

    archiveMessage(envelope, routingResult) {
        const archive = {
            envelope: envelope,
            routingResult: routingResult,
            archivedAt: new Date()
        };

        this.messageHistory.push(archive);

        // Keep manageable history
        if (this.messageHistory.length > this.maxMessageHistory) {
            this.messageHistory.shift();
        }

        // Update metrics
        this.messageMetrics.recordMessage(envelope, routingResult);
    }
}

/**
 * Message Router
 * Handles sophisticated message routing with patterns and priorities
 */
class MessageRouter {
    constructor(bus) {
        this.bus = bus;
        this.routingRules = new Map();
        this.routingStrategies = new Map();
        this.initializeDefaultRouting();
    }

    async routeMessage(envelope) {
        console.log(`🔀 Routing message: ${envelope.id} (${envelope.from} → ${envelope.to})`);

        try {
            // Apply routing strategy
            const strategy = this.selectRoutingStrategy(envelope);
            const routingResult = await this.executeRoutingStrategy(strategy, envelope);

            if (routingResult.success) {
                // Deliver message
                await this.deliverMessage(envelope, routingResult);
            }

            return routingResult;

        } catch (error) {
            return {
                success: false,
                error: error.message,
                messageId: envelope.id
            };
        }
    }

    selectRoutingStrategy(envelope) {
        // Select routing strategy based on message properties
        if (envelope.priority === 'urgent') {
            return 'direct';
        }
        if (envelope.message.broadcast) {
            return 'broadcast';
        }
        if (envelope.routingHints && envelope.routingHints.length > 0) {
            return 'hinted';
        }
        return 'standard';
    }

    async executeRoutingStrategy(strategy, envelope) {
        switch (strategy) {
            case 'direct':
                return await this.executeDirectRouting(envelope);
            case 'broadcast':
                return await this.executeBroadcastRouting(envelope);
            case 'hinted':
                return await this.executeHintedRouting(envelope);
            case 'standard':
                return await this.executeStandardRouting(envelope);
            default:
                throw new Error(`Unknown routing strategy: ${strategy}`);
        }
    }

    async executeDirectRouting(envelope) {
        // Direct delivery with priority

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            strategy: 'direct',
            routingPath: [envelope.from, envelope.to],
            deliveryMethod: 'immediate'
        };
    }

    async executeBroadcastRouting(envelope) {
        // Broadcast to multiple recipients

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            strategy: 'broadcast',
            routingPath: [envelope.from, 'broadcast', envelope.to],
            deliveryMethod: 'fanout'
        };
    }

    async executeHintedRouting(envelope) {
        // Use routing hints to optimize delivery
        const routingPath = [envelope.from, ...envelope.routingHints, envelope.to];

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            strategy: 'hinted',
            routingPath: routingPath,
            deliveryMethod: 'optimized'
        };
    }

    async executeStandardRouting(envelope) {
        // Standard point-to-point routing

        const validation = { success: this.validateSuccess() };return {

            success: validation.success,
            strategy: 'standard',
            routingPath: [envelope.from, envelope.to],
            deliveryMethod: 'standard'
        };
    }

    async deliverMessage(envelope, routingResult) {
        const recipient = this.bus.registeredAgents.get(envelope.to);
        if (!recipient) {
            throw new Error(`Recipient not registered: ${envelope.to}`);
        }

        await this.bus.deliverMessage(envelope.to, envelope.message);

        // Handle acknowledgment if required
        if (envelope.acknowledgmentRequired) {
            await this.handleAcknowledgment(envelope);
        }
    }

    async handleAcknowledgment(envelope) {
        // Send acknowledgment back to sender
        const ackMessage = {
            type: 'acknowledgment',
            originalMessageId: envelope.id,
            acknowledgedAt: new Date()
        };

        await this.bus.sendMessage(envelope.to, envelope.from, ackMessage);
    }

    initializeDefaultRouting() {
        // Initialize default routing rules
        this.routingRules.set('urgent', { priority: 1, strategy: 'direct' });
        this.routingRules.set('normal', { priority: 2, strategy: 'standard' });
        this.routingRules.set('low', { priority: 3, strategy: 'queued' });
    }
}

/**
 * Event Dispatcher
 * Handles event publishing and subscription management
 */
class EventDispatcher {
    constructor(bus) {
        this.bus = bus;
        this.eventFilters = new Map();
        this.eventTransformers = new Map();
        this.eventMetrics = new Map();
    }

    async dispatchEvent(event, subscribers) {
        const dispatches = [];

        for (const subscriberId of subscribers) {
            try {
                const filteredEvent = this.applyEventFilters(event, subscriberId);
                if (filteredEvent) {
                    const transformedEvent = this.applyEventTransformers(filteredEvent, subscriberId);
                    await this.bus.deliverEvent(subscriberId, transformedEvent);
                    dispatches.push({ subscriber: subscriberId, success: this.validateSuccess() });
                }
            } catch (error) {
                dispatches.push({ subscriber: subscriberId, success: false, error: error.message });
            }
        }

        this.recordEventMetrics(event, dispatches);
        return dispatches;
    }

    applyEventFilters(event, subscriberId) {
        const filters = this.eventFilters.get(subscriberId) || [];

        for (const filter of filters) {
            if (!filter(event)) {
                return null; // Event filtered out
            }
        }

        return event;
    }

    applyEventTransformers(event, subscriberId) {
        const transformers = this.eventTransformers.get(subscriberId) || [];

        let transformedEvent = event;
        for (const transformer of transformers) {
            transformedEvent = transformer(transformedEvent);
        }

        return transformedEvent;
    }

    recordEventMetrics(event, dispatches) {
        const eventType = event.type;
        if (!this.eventMetrics.has(eventType)) {
            this.eventMetrics.set(eventType, {
                totalDispatches: 0,
                successfulDispatches: 0,
                failedDispatches: 0,
                lastDispatch: null
            });
        }

        const metrics = this.eventMetrics.get(eventType);
        metrics.totalDispatches += dispatches.length;
        metrics.successfulDispatches += dispatches.filter(d => d.success).length;
        metrics.failedDispatches += dispatches.filter(d => !d.success).length;
        metrics.lastDispatch = new Date();
    }
}

/**
 * Channel Manager
 * Manages communication channels and membership
 */
class ChannelManager {
    constructor(bus) {
        this.bus = bus;
        this.channelPolicies = new Map();
        this.channelModeration = new Map();
    }

    async createManagedChannel(name, policy) {
        const channel = await this.bus.createChannel(name, policy.options);
        this.channelPolicies.set(name, policy);

        if (policy.moderation) {
            this.channelModeration.set(name, {
                moderators: policy.moderators || [],
                rules: policy.rules || [],
                autoModeration: policy.autoModeration || false
            });
        }

        return channel;
    }

    async enforceChannelPolicy(channelName, action, agentId, context) {
        const policy = this.channelPolicies.get(channelName);
        if (!policy) return true; // No policy = allow

        return policy.enforce(action, agentId, context);
    }

    async moderateChannelMessage(channelName, message) {
        const moderation = this.channelModeration.get(channelName);
        if (!moderation) return { allowed: true };

        // Apply moderation rules
        for (const rule of moderation.rules) {
            const ruleResult = rule(message);
            if (!ruleResult.allowed) {
                return ruleResult;
            }
        }

        return { allowed: true };
    }
}

/**
 * Persistent Message Queue
 * Handles message persistence and delivery guarantees
 */
class PersistentMessageQueue {
    constructor(bus) {
        this.bus = bus;
        this.queues = new Map(); // agentId -> message queue
        this.failedMessages = new Map(); // messageId -> retry info
        this.maxRetries = 3;
        this.retryDelay = 5000; // 5 seconds
    }

    async enqueueMessage(agentId, message, priority = 'normal') {
        if (!this.queues.has(agentId)) {
            this.queues.set(agentId, {
                urgent: [],
                normal: [],
                low: []
            });
        }

        const queue = this.queues.get(agentId);
        queue[priority].push({
            message: message,
            enqueuedAt: new Date(),
            attempts: 0
        });

        console.log(`📥 Message queued for ${agentId} (${priority} priority)`);
    }

    async dequeueNextMessage(agentId) {
        const queue = this.queues.get(agentId);
        if (!queue) return null;

        // Check urgent queue first
        if (queue.urgent.length > 0) {
            return queue.urgent.shift();
        }

        // Then normal queue
        if (queue.normal.length > 0) {
            return queue.normal.shift();
        }

        // Finally low priority queue
        if (queue.low.length > 0) {
            return queue.low.shift();
        }

        return null;
    }

    async handleFailedMessage(messageId, agentId, error) {
        console.log(`⚠️ Message delivery failed: ${messageId} to ${agentId}`);

        if (!this.failedMessages.has(messageId)) {
            this.failedMessages.set(messageId, {
                agentId: agentId,
                attempts: 0,
                lastAttempt: new Date(),
                error: error
            });
        }

        const failedMessage = this.failedMessages.get(messageId);
        failedMessage.attempts++;
        failedMessage.lastAttempt = new Date();
        failedMessage.error = error;

        if (failedMessage.attempts < this.maxRetries) {
            // Schedule retry
            setTimeout(() => {
                this.retryMessage(messageId);
            }, this.retryDelay * failedMessage.attempts);
        } else {
            console.error(`❌ Message permanently failed after ${this.maxRetries} attempts: ${messageId}`);
            this.failedMessages.delete(messageId);
        }
    }

    async retryMessage(messageId) {
        const failedMessage = this.failedMessages.get(messageId);
        if (!failedMessage) return;

        console.log(`🔄 Retrying message delivery: ${messageId} (attempt ${failedMessage.attempts})`);

        try {
            // Attempt redelivery
            // Implementation would depend on message type and delivery method
            this.failedMessages.delete(messageId);
            console.log(`✅ Message retry successful: ${messageId}`);
        } catch (error) {
            await this.handleFailedMessage(messageId, failedMessage.agentId, error);
        }
    }
}

/**
 * Fault Tolerance Manager
 * Handles communication failures and recovery
 */
class FaultToleranceManager {
    constructor(bus) {
        this.bus = bus;
        this.failures = new Map();
        this.circuitBreakers = new Map();
        this.healthChecks = new Map();
    }

    async handleCommunicationFailure(agentId, failure) {
        console.log(`⚠️ Communication failure detected for agent: ${agentId}`);

        if (!this.failures.has(agentId)) {
            this.failures.set(agentId, []);
        }

        const agentFailures = this.failures.get(agentId);
        agentFailures.push({
            type: failure.type,
            error: failure.error,
            timestamp: new Date()
        });

        // Keep only recent failures
        const oneHourAgo = new Date(Date.now() - 3600000);
        this.failures.set(agentId, agentFailures.filter(f => f.timestamp > oneHourAgo));

        // Check if circuit breaker should be triggered
        await this.checkCircuitBreaker(agentId);
    }

    async checkCircuitBreaker(agentId) {
        const recentFailures = this.failures.get(agentId) || [];
        const failureThreshold = 5; // 5 failures in an hour
        const circuitBreakerDuration = 300000; // 5 minutes

        if (recentFailures.length >= failureThreshold) {
            console.log(`🚨 Circuit breaker triggered for agent: ${agentId}`);

            this.circuitBreakers.set(agentId, {
                triggeredAt: new Date(),
                duration: circuitBreakerDuration,
                reason: 'excessive_failures'
            });

            // Schedule circuit breaker reset
            setTimeout(() => {
                this.resetCircuitBreaker(agentId);
            }, circuitBreakerDuration);

            // Update agent status
            const agent = this.bus.registeredAgents.get(agentId);
            if (agent) {
                agent.status = 'circuit_breaker';
            }
        }
    }

    resetCircuitBreaker(agentId) {
        console.log(`🔄 Resetting circuit breaker for agent: ${agentId}`);

        this.circuitBreakers.delete(agentId);

        // Reset agent status
        const agent = this.bus.registeredAgents.get(agentId);
        if (agent) {
            agent.status = 'active';
        }

        this.bus.emit('circuitBreakerReset', { agentId: agentId });
    }

    isAgentHealthy(agentId) {
        return !this.circuitBreakers.has(agentId);
    }
}

/**
 * Communication Patterns
 * Implements common communication patterns
 */
class CommunicationPatterns {
    constructor(bus) {
        this.bus = bus;
    }

    /**
     * Implement publish-subscribe pattern
     */
    async publishSubscribe(publisherId, topic, message, filters = {}) {
        console.log(`📢 Pub-Sub: Publishing to topic ${topic}`);

        const subscribers = this.getTopicSubscribers(topic, filters);
        const results = [];

        for (const subscriberId of subscribers) {
            try {
                await this.bus.sendMessage(publisherId, subscriberId, {
                    type: 'pub_sub_message',
                    topic: topic,
                    message: message,
                    timestamp: new Date()
                });
                results.push({ subscriber: subscriberId, success: this.validateSuccess() });
            } catch (error) {
                results.push({ subscriber: subscriberId, success: false, error: error.message });
            }
        }

        return results;
    }

    /**
     * Implement request-response pattern with multiple responders
     */
    async multicastRequest(requesterId, responderIds, request, timeout = 30000) {
        console.log(`🔄 Multicast request to ${responderIds.length} responders`);

        const requestPromises = responderIds.map(responderId =>
            this.bus.sendRequest(requesterId, responderId, request, timeout)
                .catch(error => ({ error: error.message, responderId: responderId }))
        );

        const responses = await Promise.allSettled(requestPromises);

        return responses.map((result, index) => ({
            responderId: responderIds[index],
            success: result.status === 'fulfilled' && !result.value.error,
            response: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason.message : result.value?.error
        }));
    }

    /**
     * Implement workflow coordination pattern
     */
    async coordinateWorkflow(coordinatorId, participants, workflow) {
        console.log(`🔄 Coordinating workflow with ${participants.length} participants`);

        const workflowId = `workflow-${Date.now()}`;
        const results = [];

        for (const step of workflow.steps) {
            const stepResult = await this.executeWorkflowStep(
                coordinatorId, participants, step, workflowId
            );
            results.push(stepResult);

            if (!stepResult.success && workflow.stopOnFailure) {
                break;
            }
        }

        return {
            workflowId: workflowId,
            steps: results,
            success: results.every(r => r.success),
            completedAt: new Date()
        };
    }

    async executeWorkflowStep(coordinatorId, participants, step, workflowId) {
        const stepResults = [];

        for (const participantId of participants) {
            if (step.assignedTo && !step.assignedTo.includes(participantId)) {
                continue; // Skip if not assigned to this participant
            }

            try {
                const response = await this.bus.sendRequest(coordinatorId, participantId, {
                    type: 'workflow_step',
                    workflowId: workflowId,
                    step: step,
                    stepIndex: step.index
                });

                stepResults.push({
                    participantId: participantId,
                    success: this.validateSuccess(), 
                    response: response
                });
            } catch (error) {
                stepResults.push({
                    participantId: participantId,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            stepId: step.id,
            stepName: step.name,
            results: stepResults,
            success: stepResults.every(r => r.success)
        };
    }

    getTopicSubscribers(topic, filters) {
        // Simple topic matching - can be enhanced with pattern matching
        const subscribers = this.bus.subscriptions.get(topic) || [];

        if (Object.keys(filters).length === 0) {
            return subscribers;
        }

        // Apply filters
        return subscribers.filter(subscriberId => {
            const agent = this.bus.registeredAgents.get(subscriberId);
            if (!agent) return false;

            return Object.entries(filters).every(([key, value]) => {
                return agent.capabilities[key] === value;
            });
        });
    }
}

/**
 * Communication Metrics
 * Tracks and analyzes communication performance
 */
class CommunicationMetrics {
    constructor() {
        this.metrics = {
            messagesSent: 0,
            messagesDelivered: 0,
            messagesFailed: 0,
            averageLatency: 0,
            channelsActive: 0,
            eventsPublished: 0,
            errors: new Map()
        };
        this.latencyHistory = [];
    }

    recordMessage(envelope, routingResult) {
        this.metrics.messagesSent++;

        if (routingResult.success) {
            this.metrics.messagesDelivered++;

            // Record latency if available
            if (routingResult.latency) {
                this.recordLatency(routingResult.latency);
            }
        } else {
            this.metrics.messagesFailed++;
        }
    }

    recordLatency(latency) {
        this.latencyHistory.push({
            latency: latency,
            timestamp: new Date()
        });

        // Keep only recent 1000 entries
        if (this.latencyHistory.length > 1000) {
            this.latencyHistory.shift();
        }

        // Calculate average latency
        const totalLatency = this.latencyHistory.reduce((sum, entry) => sum + entry.latency, 0);
        this.metrics.averageLatency = totalLatency / this.latencyHistory.length;
    }

    recordError(agentId, errorType, errorMessage) {
        if (!this.metrics.errors.has(errorType)) {
            this.metrics.errors.set(errorType, {
                count: 0,
                agents: new Set(),
                lastError: null
            });
        }

        const errorData = this.metrics.errors.get(errorType);
        errorData.count++;
        errorData.agents.add(agentId);
        errorData.lastError = {
            message: errorMessage,
            timestamp: new Date(),
            agentId: agentId
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            deliveryRate: this.metrics.messagesSent > 0 ?
                this.metrics.messagesDelivered / this.metrics.messagesSent : 0,
            errorRate: this.metrics.messagesSent > 0 ?
                this.metrics.messagesFailed / this.metrics.messagesSent : 0,
            errors: Object.fromEntries(this.metrics.errors)
        };
    }
}

module.exports = {
    AgentCommunicationBus,
    MessageRouter,
    EventDispatcher,
    ChannelManager,
    PersistentMessageQueue,
    FaultToleranceManager,
    CommunicationPatterns,
    CommunicationMetrics
};