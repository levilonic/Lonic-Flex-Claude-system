-- Autonomous AI Organization Database Schema Extensions
-- Phase 2 Implementation: Week 1, Day 1
-- Extends existing LonicFLex SQLite database with autonomous organization capabilities

-- ========================================
-- AUTONOMOUS ORGANIZATION CORE TABLES
-- ========================================

-- Autonomous Projects: Core project management
CREATE TABLE IF NOT EXISTS autonomous_projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    original_input TEXT NOT NULL,          -- Natural language input
    project_type TEXT NOT NULL,            -- 'web_application', 'api', 'dashboard', etc.
    status TEXT DEFAULT 'planning',        -- 'planning', 'active', 'completed', 'paused', 'failed'
    complexity TEXT NOT NULL,              -- 'low', 'medium', 'high', 'very_high'
    priority TEXT DEFAULT 'medium',        -- 'low', 'medium', 'high', 'critical'
    estimated_duration INTEGER,            -- Days
    actual_duration INTEGER,               -- Days (when completed)
    estimated_loc INTEGER,                 -- Lines of code estimate
    actual_loc INTEGER,                    -- Actual lines of code

    -- JSON fields for complex data
    requirements JSON,                      -- Parsed requirements
    components JSON,                        -- Project components
    dependencies JSON,                      -- Component dependencies
    timeline JSON,                         -- Phases and milestones
    resource_needs JSON,                   -- Resource requirements
    quality_gates JSON,                    -- Quality checkpoints
    success_criteria JSON,                 -- Success metrics
    technologies JSON,                     -- Required technologies
    platforms JSON,                        -- Target platforms
    integrations JSON,                     -- External integrations needed
    constraints JSON,                      -- Project constraints
    business_goals JSON,                   -- Business objectives
    user_stories JSON,                     -- User requirements

    -- Organization management
    organization_id TEXT,                  -- Parent organization (future use)
    created_by TEXT,                       -- Creator identifier
    assigned_manager TEXT,                 -- OrganizationManager instance

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,

    -- Metadata
    metadata JSON                          -- Additional project metadata
);

-- Project Teams: Agent team compositions
CREATE TABLE IF NOT EXISTS project_teams (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT,                             -- Team name/identifier
    coordination_pattern TEXT NOT NULL,    -- 'direct', 'hierarchical', 'distributed', 'hybrid'
    communication_protocol TEXT DEFAULT 'event-driven',

    -- Team structure
    leader_agent_type TEXT,                -- Primary coordinating agent
    member_count INTEGER DEFAULT 0,
    specialist_count INTEGER DEFAULT 0,

    -- Team configuration
    meeting_schedule JSON,                 -- Scheduled interactions
    reporting_structure JSON,             -- Hierarchy and reporting
    escalation_rules JSON,               -- Problem escalation paths
    handoff_protocols JSON,              -- Task handoff procedures

    -- Status and performance
    status TEXT DEFAULT 'forming',        -- 'forming', 'active', 'completing', 'disbanded'
    performance_score REAL,               -- Team effectiveness score
    collaboration_score REAL,             -- Inter-agent collaboration rating

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_at DATETIME,
    disbanded_at DATETIME,

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE
);

-- Team Members: Individual agents in teams
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,              -- 'github', 'security', 'code', 'deploy', 'comm'
    session_id TEXT,                       -- Agent instance session ID

    -- Role and responsibilities
    role TEXT NOT NULL,                    -- Agent's role in project
    responsibilities JSON,                 -- Specific responsibilities
    capabilities JSON,                     -- Agent capabilities

    -- Status and allocation
    status TEXT DEFAULT 'assigned',       -- 'assigned', 'active', 'idle', 'busy', 'completed'
    allocation_percentage REAL DEFAULT 100.0, -- % time allocated to this project
    current_task TEXT,                     -- Current task assignment

    -- Performance tracking
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    avg_task_duration REAL,              -- Average task completion time
    quality_score REAL,                  -- Work quality rating
    reliability_score REAL,              -- Task completion reliability

    -- Configuration
    agent_config JSON,                   -- Agent-specific configuration

    -- Timestamps
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME,
    completed_at DATETIME,

    FOREIGN KEY (team_id) REFERENCES project_teams (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES sessions (id)
);

-- ========================================
-- EXECUTION AND COORDINATION TABLES
-- ========================================

-- Execution Plans: Detailed project execution roadmaps
CREATE TABLE IF NOT EXISTS execution_plans (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    team_id TEXT NOT NULL,

    -- Plan details
    strategy TEXT NOT NULL,               -- 'autonomous-coordination', 'managed', 'hybrid'
    coordination_pattern TEXT NOT NULL,
    communication_protocol TEXT NOT NULL,

    -- Execution phases
    phases JSON NOT NULL,                 -- Execution phase definitions
    current_phase TEXT,                   -- Currently active phase
    phase_progress REAL DEFAULT 0.0,     -- Progress within current phase (0-1)
    overall_progress REAL DEFAULT 0.0,   -- Overall execution progress (0-1)

    -- Coordination rules
    handoff_protocols JSON,              -- Inter-agent handoff procedures
    escalation_rules JSON,              -- Problem escalation procedures
    quality_gates JSON,                 -- Quality checkpoints

    -- Monitoring and control
    progress_tracking BOOLEAN DEFAULT TRUE,
    performance_metrics BOOLEAN DEFAULT TRUE,
    autonomous_recovery BOOLEAN DEFAULT TRUE,

    -- Status
    status TEXT DEFAULT 'planned',       -- 'planned', 'executing', 'paused', 'completed', 'failed'

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    initiated_at DATETIME,
    completed_at DATETIME,

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES project_teams (id) ON DELETE CASCADE
);

-- Project Tasks: Individual work items with dependencies
CREATE TABLE IF NOT EXISTS project_tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    execution_plan_id TEXT,

    -- Task details
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    task_type TEXT NOT NULL,              -- 'executable', 'decomposed', 'pattern_implementation'

    -- Hierarchy and dependencies
    parent_task_id TEXT,                  -- Parent task (for subtasks)
    phase TEXT,                          -- Execution phase
    priority TEXT NOT NULL,              -- 'low', 'medium', 'high', 'critical'
    sequence_index INTEGER,              -- Order in execution sequence

    -- Assignment and execution
    assigned_agent_type TEXT,            -- Responsible agent type
    assigned_team_member_id TEXT,        -- Specific agent instance

    -- Status and progress
    status TEXT DEFAULT 'pending',       -- 'pending', 'in_progress', 'blocked', 'completed', 'failed'
    progress REAL DEFAULT 0.0,          -- Task progress (0-1)

    -- Estimates and actuals
    estimated_effort INTEGER,            -- Estimated effort (hours)
    actual_effort INTEGER,              -- Actual time spent (hours)
    estimated_loc INTEGER,              -- Estimated lines of code
    actual_loc INTEGER,                  -- Actual lines of code

    -- Dependencies
    dependencies JSON,                   -- Task dependencies
    blockers JSON,                      -- Current blockers

    -- Quality and deliverables
    deliverables JSON,                  -- Expected deliverables
    quality_checks JSON,               -- Quality validation requirements
    acceptance_criteria JSON,          -- Task completion criteria

    -- Results
    result_data JSON,                   -- Task execution results
    artifacts JSON,                     -- Generated artifacts (code, docs, etc.)

    -- Timestamps
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    due_date DATETIME,

    -- Performance metrics
    complexity_score REAL,             -- Task complexity rating
    quality_score REAL,               -- Delivered quality score

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE,
    FOREIGN KEY (execution_plan_id) REFERENCES execution_plans (id),
    FOREIGN KEY (parent_task_id) REFERENCES project_tasks (id),
    FOREIGN KEY (assigned_team_member_id) REFERENCES team_members (id)
);

-- Task Dependencies: Explicit dependency relationships
CREATE TABLE IF NOT EXISTS task_dependencies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_task_id TEXT NOT NULL,           -- Prerequisite task
    to_task_id TEXT NOT NULL,             -- Dependent task
    dependency_type TEXT NOT NULL,        -- 'prerequisite', 'parallel', 'optional', 'blocking'
    reason TEXT,                          -- Why this dependency exists

    -- Status tracking
    satisfied BOOLEAN DEFAULT FALSE,      -- Whether dependency is satisfied
    satisfied_at DATETIME,              -- When dependency was satisfied

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (from_task_id) REFERENCES project_tasks (id) ON DELETE CASCADE,
    FOREIGN KEY (to_task_id) REFERENCES project_tasks (id) ON DELETE CASCADE,

    UNIQUE(from_task_id, to_task_id)
);

-- ========================================
-- RESOURCE AND COORDINATION TABLES
-- ========================================

-- Resource Allocation: Project resource management
CREATE TABLE IF NOT EXISTS resource_allocations (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,

    -- Compute resources
    cpu_allocation TEXT,                  -- 'low', 'medium', 'high', 'very_high'
    memory_allocation TEXT,               -- 'low', 'medium', 'high', 'very_high'
    storage_allocation TEXT,              -- 'low', 'medium', 'high', 'very_high'

    -- Agent resources
    agent_count INTEGER,                  -- Number of allocated agents
    concurrent_tasks INTEGER,            -- Max concurrent task execution
    coordination_overhead TEXT,          -- 'low', 'medium', 'high'

    -- Time resources
    total_estimated_time INTEGER,        -- Total estimated time (hours)
    buffer_percentage REAL DEFAULT 0.2, -- Time buffer (20% default)

    -- Platform resources
    github_allocated BOOLEAN DEFAULT FALSE,
    slack_allocated BOOLEAN DEFAULT FALSE,
    external_services JSON,             -- External service allocations

    -- Quality assurance resources
    automated_qa BOOLEAN DEFAULT TRUE,
    continuous_qa BOOLEAN DEFAULT TRUE,
    quality_gates_count INTEGER,
    review_cycles INTEGER,

    -- Status and utilization
    status TEXT DEFAULT 'allocated',     -- 'allocated', 'active', 'released'
    utilization_percentage REAL,        -- Current resource utilization

    -- Timestamps
    allocated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    released_at DATETIME,

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE
);

-- Infrastructure Setup: External system configurations
CREATE TABLE IF NOT EXISTS infrastructure_setups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    team_id TEXT NOT NULL,

    -- GitHub setup
    github_repository TEXT,              -- Repository name/URL
    github_branch TEXT,                  -- Main working branch
    github_workflows JSON,              -- GitHub Actions workflows
    github_security JSON,               -- Security configurations
    github_environments JSON,           -- Deployment environments

    -- Slack setup
    slack_channel TEXT,                  -- Project Slack channel
    slack_notifications JSON,           -- Notification configurations
    slack_integrations JSON,            -- Slack app integrations

    -- Autonomous features
    auto_deployment BOOLEAN DEFAULT TRUE,
    continuous_integration BOOLEAN DEFAULT TRUE,
    quality_gates BOOLEAN DEFAULT TRUE,
    progress_reporting BOOLEAN DEFAULT TRUE,
    escalation_handling BOOLEAN DEFAULT TRUE,

    -- Monitoring and alerts
    project_health_monitoring BOOLEAN DEFAULT TRUE,
    team_performance_monitoring BOOLEAN DEFAULT TRUE,
    delivery_tracking BOOLEAN DEFAULT TRUE,
    quality_metrics_monitoring BOOLEAN DEFAULT TRUE,

    -- Status
    status TEXT DEFAULT 'active',        -- 'active', 'suspended', 'archived'

    -- Timestamps
    setup_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE,
    FOREIGN KEY (team_id) REFERENCES project_teams (id) ON DELETE CASCADE
);

-- ========================================
-- MONITORING AND ANALYTICS TABLES
-- ========================================

-- Project Metrics: Performance and quality tracking
CREATE TABLE IF NOT EXISTS project_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,
    metric_type TEXT NOT NULL,           -- 'progress', 'quality', 'performance', 'team', 'resource'
    metric_name TEXT NOT NULL,          -- Specific metric name
    metric_value REAL NOT NULL,         -- Metric value
    metric_unit TEXT,                   -- Unit of measurement

    -- Context
    measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    measured_by TEXT,                   -- Agent or system that measured
    measurement_context JSON,          -- Additional context data

    -- Metadata
    baseline_value REAL,               -- Baseline for comparison
    target_value REAL,                 -- Target/goal value
    trend TEXT,                        -- 'improving', 'stable', 'declining'

    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE
);

-- Agent Performance: Individual agent effectiveness tracking
CREATE TABLE IF NOT EXISTS agent_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_member_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    agent_type TEXT NOT NULL,

    -- Performance metrics
    task_completion_rate REAL,          -- Percentage of tasks completed successfully
    average_task_duration REAL,         -- Average time per task (hours)
    quality_score REAL,                -- Average quality rating
    reliability_score REAL,            -- Reliability rating
    efficiency_score REAL,             -- Efficiency rating
    collaboration_score REAL,          -- Team collaboration rating

    -- Task statistics
    tasks_assigned INTEGER DEFAULT 0,
    tasks_completed INTEGER DEFAULT 0,
    tasks_failed INTEGER DEFAULT 0,
    tasks_escalated INTEGER DEFAULT 0,

    -- Communication metrics
    messages_sent INTEGER DEFAULT 0,
    messages_received INTEGER DEFAULT 0,
    handoffs_initiated INTEGER DEFAULT 0,
    handoffs_received INTEGER DEFAULT 0,

    -- Time tracking
    total_active_time INTEGER,          -- Total active time (hours)
    idle_time_percentage REAL,         -- Percentage of time idle

    -- Period tracking
    measurement_period_start DATETIME,
    measurement_period_end DATETIME,
    measured_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (team_member_id) REFERENCES team_members (id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES autonomous_projects (id) ON DELETE CASCADE
);

-- ========================================
-- LEARNING AND OPTIMIZATION TABLES
-- ========================================

-- Pattern Recognition: Identified patterns for reuse and optimization
CREATE TABLE IF NOT EXISTS project_patterns (
    id TEXT PRIMARY KEY,
    pattern_name TEXT NOT NULL,
    pattern_type TEXT NOT NULL,          -- 'architectural', 'workflow', 'coordination', 'technical'

    -- Pattern details
    description TEXT NOT NULL,
    abstraction_level TEXT,             -- 'low', 'medium', 'high'
    reusability_score REAL,            -- How reusable (0-1)
    complexity_reduction REAL,         -- Complexity reduction factor (0-1)

    -- Pattern definition
    pattern_definition JSON NOT NULL,   -- Formal pattern specification
    parameters JSON,                    -- Configurable parameters
    constraints JSON,                   -- Usage constraints

    -- Usage tracking
    usage_count INTEGER DEFAULT 0,
    success_rate REAL,                  -- Success rate when applied
    performance_impact REAL,           -- Performance improvement factor

    -- Examples and applications
    example_projects JSON,              -- Projects where this pattern was used
    variations JSON,                    -- Pattern variations discovered

    -- Discovery and validation
    discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    discovered_by TEXT,                 -- System or process that discovered it
    validated BOOLEAN DEFAULT FALSE,
    validation_score REAL,             -- Validation confidence

    -- Metadata
    tags JSON,                         -- Pattern classification tags
    related_patterns JSON             -- Related/similar patterns
);

-- Organization Learning: System-wide learning and improvement
CREATE TABLE IF NOT EXISTS organization_learning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    learning_type TEXT NOT NULL,        -- 'success_pattern', 'failure_analysis', 'optimization', 'best_practice'

    -- Learning details
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context JSON,                       -- Context where learning occurred

    -- Source information
    source_project_id TEXT,             -- Project that generated this learning
    source_team_id TEXT,               -- Team that generated this learning
    source_agent_type TEXT,            -- Agent type involved

    -- Learning content
    lessons_learned JSON,              -- Specific lessons
    recommendations JSON,              -- Actionable recommendations
    preventive_measures JSON,          -- How to prevent issues
    optimization_opportunities JSON,   -- Identified improvements

    -- Impact and validation
    confidence_score REAL,             -- Confidence in this learning (0-1)
    impact_score REAL,                 -- Potential impact (0-1)
    validation_status TEXT DEFAULT 'pending', -- 'pending', 'validated', 'rejected'

    -- Application tracking
    times_applied INTEGER DEFAULT 0,
    success_when_applied REAL,         -- Success rate when applied

    -- Timestamps
    learned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    validated_at DATETIME,
    last_applied DATETIME,

    FOREIGN KEY (source_project_id) REFERENCES autonomous_projects (id),
    FOREIGN KEY (source_team_id) REFERENCES project_teams (id)
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Project indexes
CREATE INDEX IF NOT EXISTS idx_autonomous_projects_status ON autonomous_projects(status);
CREATE INDEX IF NOT EXISTS idx_autonomous_projects_complexity ON autonomous_projects(complexity);
CREATE INDEX IF NOT EXISTS idx_autonomous_projects_created_at ON autonomous_projects(created_at);
CREATE INDEX IF NOT EXISTS idx_autonomous_projects_manager ON autonomous_projects(assigned_manager);

-- Team indexes
CREATE INDEX IF NOT EXISTS idx_project_teams_project_id ON project_teams(project_id);
CREATE INDEX IF NOT EXISTS idx_project_teams_status ON project_teams(status);

-- Team member indexes
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_project_id ON team_members(project_id);
CREATE INDEX IF NOT EXISTS idx_team_members_agent_type ON team_members(agent_type);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);

-- Task indexes
CREATE INDEX IF NOT EXISTS idx_project_tasks_project_id ON project_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_project_tasks_status ON project_tasks(status);
CREATE INDEX IF NOT EXISTS idx_project_tasks_assigned_agent ON project_tasks(assigned_agent_type);
CREATE INDEX IF NOT EXISTS idx_project_tasks_phase ON project_tasks(phase);
CREATE INDEX IF NOT EXISTS idx_project_tasks_priority ON project_tasks(priority);

-- Dependency indexes
CREATE INDEX IF NOT EXISTS idx_task_dependencies_from ON task_dependencies(from_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_to ON task_dependencies(to_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_satisfied ON task_dependencies(satisfied);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_project_metrics_project_id ON project_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_project_metrics_type ON project_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_project_metrics_measured_at ON project_metrics(measured_at);

CREATE INDEX IF NOT EXISTS idx_agent_performance_project_id ON agent_performance(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_performance_agent_type ON agent_performance(agent_type);
CREATE INDEX IF NOT EXISTS idx_agent_performance_measured_at ON agent_performance(measured_at);

-- Pattern and learning indexes
CREATE INDEX IF NOT EXISTS idx_project_patterns_type ON project_patterns(pattern_type);
CREATE INDEX IF NOT EXISTS idx_project_patterns_reusability ON project_patterns(reusability_score);
CREATE INDEX IF NOT EXISTS idx_project_patterns_usage ON project_patterns(usage_count);

CREATE INDEX IF NOT EXISTS idx_organization_learning_type ON organization_learning(learning_type);
CREATE INDEX IF NOT EXISTS idx_organization_learning_source_project ON organization_learning(source_project_id);
CREATE INDEX IF NOT EXISTS idx_organization_learning_confidence ON organization_learning(confidence_score);

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- Active Projects Overview
CREATE VIEW IF NOT EXISTS active_projects_overview AS
SELECT
    ap.id,
    ap.name,
    ap.status,
    ap.complexity,
    ap.priority,
    ap.estimated_duration,
    ap.created_at,
    ap.started_at,
    pt.member_count,
    pt.coordination_pattern,
    COUNT(ptasks.id) as total_tasks,
    COUNT(CASE WHEN ptasks.status = 'completed' THEN 1 END) as completed_tasks,
    ROUND(AVG(pm.metric_value), 2) as avg_progress
FROM autonomous_projects ap
LEFT JOIN project_teams pt ON ap.id = pt.project_id
LEFT JOIN project_tasks ptasks ON ap.id = ptasks.project_id
LEFT JOIN project_metrics pm ON ap.id = pm.project_id AND pm.metric_name = 'overall_progress'
WHERE ap.status IN ('planning', 'active')
GROUP BY ap.id, ap.name, ap.status, ap.complexity, ap.priority, ap.estimated_duration, ap.created_at, ap.started_at, pt.member_count, pt.coordination_pattern;

-- Team Performance Summary
CREATE VIEW IF NOT EXISTS team_performance_summary AS
SELECT
    pt.id as team_id,
    pt.project_id,
    pt.coordination_pattern,
    pt.status,
    COUNT(tm.id) as total_members,
    AVG(tm.quality_score) as avg_quality_score,
    AVG(tm.reliability_score) as avg_reliability_score,
    SUM(tm.tasks_completed) as total_tasks_completed,
    SUM(tm.tasks_failed) as total_tasks_failed,
    ROUND(AVG(ap_perf.task_completion_rate), 2) as avg_completion_rate
FROM project_teams pt
LEFT JOIN team_members tm ON pt.id = tm.team_id
LEFT JOIN agent_performance ap_perf ON tm.id = ap_perf.team_member_id
GROUP BY pt.id, pt.project_id, pt.coordination_pattern, pt.status;

-- Project Health Dashboard
CREATE VIEW IF NOT EXISTS project_health_dashboard AS
SELECT
    ap.id as project_id,
    ap.name as project_name,
    ap.status,
    ap.complexity,
    ep.overall_progress,
    ep.current_phase,
    COUNT(ptasks.id) as total_tasks,
    COUNT(CASE WHEN ptasks.status = 'completed' THEN 1 END) as completed_tasks,
    COUNT(CASE WHEN ptasks.status = 'blocked' THEN 1 END) as blocked_tasks,
    COUNT(CASE WHEN ptasks.status = 'failed' THEN 1 END) as failed_tasks,
    MAX(pm.metric_value) as latest_quality_score,
    pt.performance_score as team_performance,
    CASE
        WHEN COUNT(CASE WHEN ptasks.status = 'blocked' THEN 1 END) > 0 THEN 'at_risk'
        WHEN ep.overall_progress < 0.3 AND JULIANDAY('now') - JULIANDAY(ap.created_at) > 7 THEN 'behind_schedule'
        WHEN ep.overall_progress > 0.8 THEN 'on_track'
        ELSE 'normal'
    END as health_status
FROM autonomous_projects ap
LEFT JOIN execution_plans ep ON ap.id = ep.project_id
LEFT JOIN project_tasks ptasks ON ap.id = ptasks.project_id
LEFT JOIN project_metrics pm ON ap.id = pm.project_id AND pm.metric_name = 'quality_score'
LEFT JOIN project_teams pt ON ap.id = pt.project_id
WHERE ap.status IN ('planning', 'active')
GROUP BY ap.id, ap.name, ap.status, ap.complexity, ep.overall_progress, ep.current_phase, pt.performance_score;