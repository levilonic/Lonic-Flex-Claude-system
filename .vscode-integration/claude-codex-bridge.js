#!/usr/bin/env node
/**
 * Claude Code ↔ Codex Bridge
 * Enables seamless communication between Claude and Codex in split VS Code terminals
 *
 * Usage:
 * - Terminal 1: claude (Claude Code)
 * - Terminal 2: codex (Codex AI)
 * - Shared context via file-based message queue
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class ClaudeCodexBridge extends EventEmitter {
  constructor(projectRoot = process.cwd()) {
    super();
    this.projectRoot = projectRoot;
    this.bridgeDir = path.join(projectRoot, '.vscode-integration', 'bridge');
    this.messagesFile = path.join(this.bridgeDir, 'messages.json');
    this.contextFile = path.join(this.bridgeDir, 'shared-context.json');
    this.stateFile = path.join(this.bridgeDir, 'state.json');

    this.ensureBridgeDirectory();
  }

  ensureBridgeDirectory() {
    if (!fs.existsSync(this.bridgeDir)) {
      fs.mkdirSync(this.bridgeDir, { recursive: true });
    }

    // Initialize files if they don't exist
    if (!fs.existsSync(this.messagesFile)) {
      this.writeJSON(this.messagesFile, []);
    }
    if (!fs.existsSync(this.contextFile)) {
      this.writeJSON(this.contextFile, {
        currentTask: null,
        files: [],
        decisions: [],
        timestamp: Date.now()
      });
    }
    if (!fs.existsSync(this.stateFile)) {
      this.writeJSON(this.stateFile, {
        claudeActive: false,
        codexActive: false,
        lastSync: Date.now()
      });
    }
  }

  writeJSON(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  readJSON(filePath) {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
      console.error(`Error reading ${filePath}:`, err.message);
      return null;
    }
  }

  // Send message from one AI to another
  sendMessage(from, to, message, metadata = {}) {
    const messages = this.readJSON(this.messagesFile) || [];
    messages.push({
      id: Date.now(),
      from,
      to,
      message,
      metadata,
      timestamp: new Date().toISOString(),
      read: false
    });
    this.writeJSON(this.messagesFile, messages);
    this.emit('message', { from, to, message });
  }

  // Get unread messages for specific recipient
  getMessages(recipient) {
    const messages = this.readJSON(this.messagesFile) || [];
    return messages.filter(m => m.to === recipient && !m.read);
  }

  // Mark message as read
  markRead(messageId) {
    const messages = this.readJSON(this.messagesFile) || [];
    const msg = messages.find(m => m.id === messageId);
    if (msg) {
      msg.read = true;
      this.writeJSON(this.messagesFile, messages);
    }
  }

  // Update shared context
  updateContext(updates) {
    const context = this.readJSON(this.contextFile) || {};
    Object.assign(context, updates, { timestamp: Date.now() });
    this.writeJSON(this.contextFile, context);
    this.emit('context-update', context);
  }

  // Get current shared context
  getContext() {
    return this.readJSON(this.contextFile);
  }

  // Register AI as active
  registerActive(aiName) {
    const state = this.readJSON(this.stateFile) || {};
    state[`${aiName.toLowerCase()}Active`] = true;
    state.lastSync = Date.now();
    this.writeJSON(this.stateFile, state);
  }

  // Unregister AI as active
  unregisterActive(aiName) {
    const state = this.readJSON(this.stateFile) || {};
    state[`${aiName.toLowerCase()}Active`] = false;
    state.lastSync = Date.now();
    this.writeJSON(this.stateFile, state);
  }

  // Get system state
  getState() {
    return this.readJSON(this.stateFile);
  }

  // Watch for changes (polling)
  watch(callback, interval = 1000) {
    let lastCheck = Date.now();
    const watcher = setInterval(() => {
      const state = this.getState();
      if (state && state.lastSync > lastCheck) {
        lastCheck = state.lastSync;
        callback(this.getContext());
      }
    }, interval);
    return () => clearInterval(watcher);
  }

  // Clear all messages
  clearMessages() {
    this.writeJSON(this.messagesFile, []);
  }

  // Export context summary for Claude/Codex
  exportContextSummary() {
    const context = this.getContext();
    const state = this.getState();
    const recentMessages = (this.readJSON(this.messagesFile) || []).slice(-10);

    return {
      task: context.currentTask,
      files: context.files,
      decisions: context.decisions,
      recentMessages: recentMessages.map(m => ({
        from: m.from,
        to: m.to,
        message: m.message,
        time: m.timestamp
      })),
      activeAIs: {
        claude: state.claudeActive,
        codex: state.codexActive
      },
      lastSync: new Date(state.lastSync).toISOString()
    };
  }
}

// CLI Interface
if (require.main === module) {
  const bridge = new ClaudeCodexBridge();
  const [,, command, ...args] = process.argv;

  switch (command) {
    case 'send':
      // Usage: node claude-codex-bridge.js send claude codex "message here"
      const [from, to, message] = args;
      bridge.sendMessage(from, to, message);
      console.log(`Message sent from ${from} to ${to}`);
      break;

    case 'read':
      // Usage: node claude-codex-bridge.js read claude
      const recipient = args[0];
      const messages = bridge.getMessages(recipient);
      console.log(JSON.stringify(messages, null, 2));
      break;

    case 'context':
      // Usage: node claude-codex-bridge.js context
      console.log(JSON.stringify(bridge.exportContextSummary(), null, 2));
      break;

    case 'update':
      // Usage: node claude-codex-bridge.js update '{"currentTask":"Build feature X"}'
      const updates = JSON.parse(args[0]);
      bridge.updateContext(updates);
      console.log('Context updated');
      break;

    case 'register':
      // Usage: node claude-codex-bridge.js register claude
      bridge.registerActive(args[0]);
      console.log(`${args[0]} registered as active`);
      break;

    case 'unregister':
      // Usage: node claude-codex-bridge.js unregister claude
      bridge.unregisterActive(args[0]);
      console.log(`${args[0]} unregistered`);
      break;

    case 'clear':
      // Usage: node claude-codex-bridge.js clear
      bridge.clearMessages();
      console.log('Messages cleared');
      break;

    case 'watch':
      // Usage: node claude-codex-bridge.js watch
      console.log('Watching for changes... (Ctrl+C to stop)');
      bridge.watch((context) => {
        console.log('\n[CONTEXT UPDATE]', new Date().toISOString());
        console.log(JSON.stringify(context, null, 2));
      });
      break;

    default:
      console.log(`
Claude Code ↔ Codex Bridge

Commands:
  send <from> <to> <message>     Send message between AIs
  read <recipient>                Read unread messages
  context                         Show current shared context
  update <json>                   Update shared context
  register <ai-name>              Register AI as active
  unregister <ai-name>            Unregister AI
  clear                           Clear all messages
  watch                           Watch for context changes

Examples:
  node claude-codex-bridge.js send claude codex "Starting feature X"
  node claude-codex-bridge.js read codex
  node claude-codex-bridge.js context
  node claude-codex-bridge.js update '{"currentTask":"Build auth"}'
      `);
  }
}

module.exports = ClaudeCodexBridge;
