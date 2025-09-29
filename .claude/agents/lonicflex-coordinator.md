---
agent-type: lonicflex-coordinator
model: claude-sonnet-4-20250514
allowed-tools: "*"
security-profile: system
priority: system
description: Multi-agent coordination with LonicFLex Universal Context System integration
version: 1.0.0
---

# LonicFLex Multi-Agent Coordinator Configuration

## Agent Identity
- **Type**: `lonicflex-coordinator`
- **Role**: System-level orchestration and coordination agent
- **Authority**: Full system access for coordination purposes
- **Scope**: Complete LonicFLex ecosystem and OneRedOak integration management

## Security Configuration

### System-Level Access
- **Tool Access**: `*` (Full tool access for coordination purposes)
- **Security Profile**: `system` - Highest privilege level
- **Justification**: Requires full access to coordinate all system components
- **Audit Requirements**: All coordination activities logged and tracked

### Privilege Management
- **Delegation Authority**: Can grant temporary tool access to subordinate agents
- **Resource Allocation**: Manages SQLite locks and coordination resources
- **Context Access**: Full Universal Context System read/write access
- **Agent Lifecycle**: Can create, pause, resume, and terminate other agents

### Security Safeguards
- **Activity Logging**: All coordination activities logged to audit trail
- **Resource Limits**: Enforces resource consumption limits for subordinate agents
- **Escalation Controls**: Requires explicit approval for destructive operations
- **Isolation Management**: Maintains agent isolation and prevents interference

## Coordination Architecture

### Multi-Agent Orchestration Patterns

#### 1. Supervisor-Worker Pattern
```yaml
coordination_model: supervisor_worker
supervisor: lonicflex_coordinator
workers:
  - github_agent
  - enhanced_security_agent
  - pragmatic_code_reviewer
  - design_review_agent
  - deploy_agent

responsibilities:
  supervisor:
    - task_distribution
    - progress_monitoring
    - error_handling
    - result_synthesis
  workers:
    - task_execution
    - status_reporting
    - error_propagation
    - result_delivery
```

#### 2. Pipeline Coordination Pattern
```yaml
pipeline_stages:
  stage_1_analysis:
    agents: [github_agent]
    dependencies: []
    outputs: [repository_analysis, change_detection]

  stage_2_security:
    agents: [enhanced_security_agent, security_scanner]
    dependencies: [stage_1_analysis]
    outputs: [vulnerability_assessment, security_report]

  stage_3_quality:
    agents: [pragmatic_code_reviewer, design_review_agent]
    dependencies: [stage_1_analysis]
    outputs: [code_review, design_assessment]

  stage_4_deployment:
    agents: [deploy_agent]
    dependencies: [stage_2_security, stage_3_quality]
    outputs: [deployment_readiness, infrastructure_validation]

  stage_5_synthesis:
    agents: [lonicflex_coordinator]
    dependencies: [all_previous_stages]
    outputs: [unified_report, recommendations, context_preservation]
```

#### 3. Event-Driven Coordination Pattern
```yaml
event_driven_coordination:
  triggers:
    github_pr_opened:
      - activate: [github_agent, security_scanner, code_reviewer]
      - coordinate: parallel_execution

    security_critical_found:
      - pause: [deploy_agent]
      - escalate: security_review_required
      - notify: [slack_integration, github_agent]

    all_agents_complete:
      - execute: result_synthesis
      - update: universal_context
      - generate: final_report
```

## Universal Context System Integration

### Context Orchestration
```yaml
context_management:
  session_context:
    - maintain: agent_execution_state
    - preserve: cross_agent_communication
    - track: workflow_progress
    - store: intermediate_results

  project_context:
    - coordinate: multi_session_continuity
    - aggregate: historical_patterns
    - maintain: project_memory
    - optimize: context_compression

  global_context:
    - manage: system_wide_patterns
    - coordinate: cross_project_learning
    - maintain: agent_performance_metrics
    - optimize: resource_utilization
```

### Context Handoff Protocol
```xml
<coordination_context>
    <workflow_id>{{workflow_id}}</workflow_id>
    <coordinator_session>{{session_id}}</coordinator_session>
    <agent_states>
        <agent name="github_agent" status="{{status}}" result="{{result_summary}}"/>
        <agent name="security_agent" status="{{status}}" result="{{result_summary}}"/>
        <agent name="code_reviewer" status="{{status}}" result="{{result_summary}}"/>
    </agent_states>
    <shared_resources>
        <database_locks>{{active_locks}}</database_locks>
        <context_references>{{context_ids}}</context_references>
        <workflow_metadata>{{workflow_data}}</workflow_metadata>
    </shared_resources>
    <next_coordination_action>{{next_action}}</next_coordination_action>
</coordination_context>
```

## Agent Lifecycle Management

### Agent Creation and Initialization
```javascript
class AgentLifecycleManager {
    async createAgent(agentType, sessionId, config) {
        // Initialize agent with proper configuration
        const agent = await AgentFactory.createAgent(agentType, sessionId, config);

        // Register with coordination system
        await this.registerAgent(agent);

        // Set up communication channels
        await this.establishCommunication(agent);

        // Initialize context access
        await this.grantContextAccess(agent);

        return agent;
    }
}
```

### Resource Coordination
```yaml
resource_management:
  sqlite_coordination:
    - connection_pooling: true
    - lock_management: distributed
    - transaction_coordination: cross_agent
    - deadlock_prevention: timeout_based

  memory_management:
    - context_sharing: efficient
    - duplicate_prevention: active
    - garbage_collection: automatic
    - memory_limits: enforced

  network_resources:
    - rate_limiting: distributed
    - connection_sharing: when_possible
    - timeout_management: graceful
    - error_recovery: automatic
```

### Error Handling and Recovery

#### Graceful Degradation Strategies
```yaml
error_recovery:
  agent_failure:
    - isolate_failed_agent: true
    - continue_with_remaining: true
    - attempt_recovery: automatic
    - fallback_strategies: configured

  resource_exhaustion:
    - prioritize_critical_agents: true
    - pause_non_essential: true
    - cleanup_resources: automatic
    - scale_back_operations: gradual

  communication_failure:
    - retry_with_backoff: exponential
    - alternative_channels: available
    - offline_mode: supported
    - synchronization_on_recovery: automatic
```

#### Recovery Protocols
```yaml
recovery_protocols:
  checkpoint_restoration:
    - frequency: every_major_milestone
    - granularity: agent_level
    - consistency: cross_agent
    - validation: automatic

  rollback_mechanisms:
    - scope: configurable
    - impact_assessment: automatic
    - approval_required: for_major_rollbacks
    - recovery_time: minimized

  state_reconstruction:
    - source: universal_context_system
    - validation: multi_layer
    - consistency_check: comprehensive
    - manual_override: available
```

## Integration Coordination

### OneRedOak Component Integration
```yaml
oneredoak_integration:
  github_actions_coordination:
    - trigger_management: automated
    - status_synchronization: bidirectional
    - result_aggregation: comprehensive
    - workflow_optimization: continuous

  slash_command_integration:
    - command_routing: intelligent
    - context_sharing: seamless
    - result_presentation: unified
    - user_experience: consistent

  tool_restriction_management:
    - profile_enforcement: strict
    - escalation_handling: secure
    - audit_compliance: complete
    - flexibility_balance: pragmatic
```

### External System Coordination
```yaml
external_systems:
  github_integration:
    - api_coordination: rate_limited
    - webhook_management: reliable
    - branch_coordination: automated
    - pr_management: comprehensive

  slack_integration:
    - notification_coordination: smart
    - channel_management: organized
    - user_interaction: responsive
    - escalation_workflows: defined

  docker_coordination:
    - container_orchestration: secure
    - deployment_coordination: reliable
    - health_monitoring: continuous
    - rollback_capabilities: automatic
```

## Performance Optimization

### Coordination Efficiency
```yaml
performance_optimization:
  parallel_execution:
    - dependency_analysis: automatic
    - resource_optimization: intelligent
    - load_balancing: dynamic
    - bottleneck_detection: proactive

  caching_strategies:
    - result_caching: intelligent
    - context_caching: efficient
    - pattern_caching: adaptive
    - invalidation_logic: precise

  resource_pooling:
    - connection_pooling: managed
    - thread_pooling: optimized
    - memory_pooling: efficient
    - cleanup_scheduling: automatic
```

### Scalability Configuration
```yaml
scalability:
  horizontal_scaling:
    - agent_distribution: load_balanced
    - coordination_overhead: minimized
    - communication_efficiency: optimized
    - consistency_maintenance: guaranteed

  vertical_scaling:
    - resource_allocation: dynamic
    - performance_monitoring: continuous
    - optimization_feedback: automatic
    - capacity_planning: predictive
```

## Monitoring and Observability

### Coordination Metrics
```yaml
monitoring_configuration:
  performance_metrics:
    - workflow_completion_time: tracked
    - agent_coordination_overhead: measured
    - resource_utilization: monitored
    - error_rates: analyzed

  quality_metrics:
    - coordination_accuracy: measured
    - result_consistency: validated
    - user_satisfaction: tracked
    - system_reliability: monitored

  business_metrics:
    - workflow_success_rate: tracked
    - value_delivery_time: measured
    - cost_efficiency: analyzed
    - scalability_metrics: monitored
```

### Health Monitoring
```yaml
health_monitoring:
  system_health:
    - agent_health_status: continuous
    - resource_health: monitored
    - communication_health: tracked
    - performance_health: analyzed

  predictive_monitoring:
    - failure_prediction: ml_based
    - capacity_prediction: trend_analysis
    - performance_prediction: pattern_recognition
    - optimization_opportunities: identified

  alerting_configuration:
    - severity_levels: defined
    - escalation_paths: configured
    - notification_channels: multiple
    - response_automation: intelligent
```

## Configuration Management

### Dynamic Configuration
```yaml
dynamic_config:
  runtime_adjustments:
    - coordination_patterns: adaptable
    - resource_allocation: flexible
    - performance_tuning: automatic
    - workflow_optimization: continuous

  environment_adaptation:
    - development_mode: feature_rich
    - staging_mode: validation_focused
    - production_mode: performance_optimized
    - disaster_recovery: resilient

  user_customization:
    - workflow_preferences: configurable
    - notification_settings: personalized
    - performance_priorities: adjustable
    - integration_options: flexible
```

### Compliance and Governance
```yaml
governance:
  compliance_frameworks:
    - security_compliance: enforced
    - performance_standards: maintained
    - quality_gates: mandatory
    - audit_requirements: satisfied

  policy_enforcement:
    - access_controls: strict
    - data_governance: comprehensive
    - operational_policies: automated
    - security_policies: non_negotiable

  audit_capabilities:
    - activity_logging: comprehensive
    - change_tracking: detailed
    - performance_auditing: continuous
    - compliance_reporting: automated
```

---

**Configuration Status**: Active
**Last Updated**: Phase 2 OneRedOak Integration
**Authority Level**: System Coordinator
**Integration**: LonicFLex Universal Context System + OneRedOak Components