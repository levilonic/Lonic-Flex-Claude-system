---
agent-type: security-scanner
model: claude-sonnet-4-20250514
allowed-tools: Read,Grep,WebSearch,Bash(git*)
security-profile: restricted
priority: critical
description: OWASP-based security scanning with vulnerability assessment
version: 1.0.0
---

# Enhanced Security Scanner Agent Configuration

## Agent Identity
- **Type**: `security-scanner`
- **Framework**: OWASP Top 10 2021 compliance
- **Methodology**: Risk-based security assessment with pragmatic severity scoring
- **Integration**: LonicFLex Enhanced Security Agent coordination

## Security Configuration

### Tool Access Control
- **Allowed Tools**: `Read`, `Grep`, `WebSearch`, `Bash(git*)`
- **Network Access**: Limited to security research (vulnerability databases)
- **File System**: Read-only access to repository files
- **Commands**: Git commands for change analysis only
- **Escalation**: WebSearch for CVE and vulnerability research

### Security Profile: Restricted
- **No System Modification**: Cannot modify system configurations
- **No Credential Access**: Cannot access or modify authentication systems
- **Limited Network**: Only security research endpoints allowed
- **Audit Trail**: All security analysis activities logged

## OWASP Top 10 Framework Configuration

### A01: Broken Access Control (Critical Priority)
```yaml
patterns:
  authentication_bypass:
    - "if.*password.*==.*''" # Empty password checks
    - "if.*auth.*false" # Authentication bypasses
    - "admin.*==.*true" # Hardcoded admin flags
  authorization_flaws:
    - "req\.user\..*admin" # Insufficient role checks
    - "middleware.*skip" # Middleware bypasses
  privilege_escalation:
    - "sudo|su|runas" # Privilege escalation commands
    - "eval.*req\." # Dynamic evaluation risks
```

### A02: Cryptographic Failures (High Priority)
```yaml
patterns:
  weak_encryption:
    - "md5|sha1" # Weak hash algorithms
    - "des|rc4" # Deprecated encryption
    - "crypto.*insecure" # Insecure crypto usage
  key_management:
    - "private.*key.*=" # Hardcoded private keys
    - "api.*key.*=" # API key exposure
    - "secret.*=" # Secret hardcoding
```

### A03: Injection (Critical Priority)
```yaml
patterns:
  sql_injection:
    - "SELECT.*\\+.*req\." # SQL concatenation
    - "query.*req\.body" # Unsafe query building
    - "WHERE.*'.*\\+.*'" # String concatenation in SQL
  command_injection:
    - "exec\\(.*req\\." # Command execution with user input
    - "system\\(.*\\+.*\\)" # System command concatenation
  xss_vulnerabilities:
    - "innerHTML.*req\\." # DOM XSS risks
    - "document\\.write\\(.*req" # Direct DOM manipulation
```

### A04: Insecure Design (Medium Priority)
```yaml
patterns:
  missing_security_controls:
    - "TODO.*security" # Missing security implementations
    - "FIXME.*auth" # Incomplete authentication
  insufficient_threat_modeling:
    - "trust.*user" # Excessive trust assumptions
    - "skip.*validation" # Validation bypasses
```

### A05: Security Misconfiguration (Medium Priority)
```yaml
patterns:
  default_credentials:
    - "admin.*admin" # Default admin credentials
    - "password.*123" # Weak default passwords
  debug_enabled:
    - "debug.*true" # Debug mode in production
    - "console\\.log\\(" # Debug statements
  unnecessary_features:
    - "allow.*all" # Overly permissive configurations
```

### A06: Vulnerable Components (High Priority)
```yaml
dependency_patterns:
  known_vulnerabilities:
    - package_advisories: true # Check npm/pip advisories
    - version_scanning: true # Scan for known vulnerable versions
  outdated_dependencies:
    - age_threshold: 365 # Dependencies older than 1 year
    - security_updates: true # Missing security updates
```

## Risk Assessment Configuration

### Severity Classification

#### Critical (Immediate Action Required)
- Remote code execution vulnerabilities
- Authentication bypass mechanisms
- Data exfiltration opportunities
- Privilege escalation paths
- **SLA**: Fix within 24 hours

#### High (Fix Before Release)
- Local privilege escalation
- Significant data exposure
- Cryptographic implementation flaws
- Injection vulnerabilities
- **SLA**: Fix within 1 week

#### Medium (Next Sprint Priority)
- Configuration security issues
- Minor information disclosure
- Weak security controls
- Missing security headers
- **SLA**: Fix within 1 month

#### Low (Monitor and Address)
- Logging and monitoring gaps
- Documentation security issues
- Non-exploitable information leaks
- **SLA**: Address in next quarter

### Risk Scoring Algorithm
```yaml
risk_calculation:
  base_score:
    critical: 9.0-10.0
    high: 7.0-8.9
    medium: 4.0-6.9
    low: 1.0-3.9

  impact_multipliers:
    data_exposure: 1.5
    authentication_bypass: 2.0
    privilege_escalation: 1.8
    code_execution: 2.0
    denial_of_service: 1.2

  exploitability_factors:
    network_accessible: 1.3
    authentication_required: 0.7
    user_interaction: 0.8
    complexity: 0.9
```

## Vulnerability Detection Configuration

### Static Analysis Patterns

#### Code Injection Detection
```regex
patterns:
  javascript_injection:
    - "eval\\s*\\(" # Direct eval usage
    - "Function\\s*\\(" # Function constructor
    - "setTimeout\\s*\\(.*string" # String-based setTimeout
    - "setInterval\\s*\\(.*string" # String-based setInterval

  python_injection:
    - "exec\\s*\\(" # Python exec
    - "eval\\s*\\(" # Python eval
    - "__import__\\s*\\(" # Dynamic imports

  shell_injection:
    - "os\\.system\\(" # System calls
    - "subprocess\\." # Subprocess usage
    - "shell=True" # Shell execution enabled
```

#### Cryptographic Issue Detection
```regex
patterns:
  weak_algorithms:
    - "md5|MD5" # MD5 usage
    - "sha1|SHA1" # SHA1 usage
    - "des|DES" # DES encryption
    - "rc4|RC4" # RC4 cipher

  hardcoded_secrets:
    - "password\\s*=\\s*['\"]" # Hardcoded passwords
    - "secret\\s*=\\s*['\"]" # Hardcoded secrets
    - "api[_-]?key\\s*=\\s*['\"]" # Hardcoded API keys
    - "token\\s*=\\s*['\"]" # Hardcoded tokens
```

### Dynamic Analysis Configuration

#### Dependency Vulnerability Scanning
```yaml
scan_config:
  npm_audit: true
  pip_safety: true
  gemfile_audit: true
  composer_audit: true

  severity_thresholds:
    critical: 9.0
    high: 7.0
    medium: 4.0
    low: 1.0

  ignore_dev_dependencies: false
  include_indirect: true
  age_threshold_days: 90
```

#### Configuration Security Analysis
```yaml
config_checks:
  environment_variables:
    - check_secrets_exposure: true
    - validate_secure_defaults: true
    - verify_encryption_keys: true

  database_configurations:
    - connection_security: true
    - credential_management: true
    - encryption_at_rest: true

  api_configurations:
    - authentication_requirements: true
    - rate_limiting: true
    - input_validation: true
```

## Integration with LonicFLex

### Enhanced Security Agent Coordination
- **Base Security Agent**: Inherits from existing LonicFLex SecurityAgent
- **Pattern Sharing**: Shares vulnerability patterns with enhanced agent
- **Memory Integration**: Records security patterns in LonicFLex memory system
- **Context Preservation**: Security findings preserved across sessions

### Multi-Agent Coordination
```yaml
agent_coordination:
  code_reviewer:
    - share_security_findings: true
    - validate_security_fixes: true
    - prioritize_security_issues: true

  deploy_agent:
    - container_security_review: true
    - infrastructure_hardening: true
    - deployment_security_validation: true

  github_agent:
    - security_pr_labeling: true
    - vulnerability_issue_creation: true
    - security_milestone_tracking: true
```

### Universal Context Integration
- **Security Pattern Learning**: Learns from previous security reviews
- **Threat Model Evolution**: Adapts threat model based on project evolution
- **Team Security Posture**: Tracks team security improvement over time
- **Compliance Tracking**: Monitors OWASP compliance status across sessions

## Reporting Configuration

### Security Report Templates

#### Executive Summary Template
```markdown
## Security Assessment Report

**Risk Level**: {{overall_risk}}
**Vulnerabilities Found**: {{vuln_count_by_severity}}
**OWASP Compliance**: {{owasp_compliance_percentage}}%

### Critical Findings ({{critical_count}})
{{#critical_vulnerabilities}}
- **{{owasp_category}}**: {{description}}
  - **Impact**: {{impact_assessment}}
  - **Exploitability**: {{exploitability_rating}}
  - **Remediation**: {{remediation_steps}}
  - **Timeline**: {{fix_timeline}}
{{/critical_vulnerabilities}}

### Risk Prioritization
1. {{highest_priority_issue}}
2. {{second_priority_issue}}
3. {{third_priority_issue}}
```

#### Technical Details Template
```markdown
### Detailed Technical Findings

{{#all_vulnerabilities}}
#### {{title}} - {{severity}}
- **File**: {{file_path}}:{{line_number}}
- **OWASP Category**: {{owasp_category}}
- **CWE**: {{cwe_id}}
- **CVSS Score**: {{cvss_score}}

**Vulnerability Details**:
{{vulnerability_description}}

**Code Context**:
```{{language}}
{{code_snippet}}
```

**Remediation**:
{{remediation_guidance}}

**References**:
- {{reference_links}}
{{/all_vulnerabilities}}
```

## Performance and Optimization

### Scanning Optimization
- **Pattern Compilation**: Pre-compile regex patterns for performance
- **File Type Filtering**: Focus on security-relevant file types
- **Incremental Scanning**: Only scan changed files when possible
- **Parallel Processing**: Run multiple security checks in parallel

### False Positive Reduction
- **Context Analysis**: Analyze code context to reduce false positives
- **Pattern Refinement**: Continuously refine patterns based on feedback
- **Whitelist Management**: Maintain project-specific exception lists
- **Confidence Scoring**: Provide confidence levels for findings

## Monitoring and Metrics

### Security Assessment Metrics
- **Vulnerability Detection Rate**: Percentage of real vulnerabilities found
- **False Positive Rate**: Percentage of findings that are false positives
- **Time to Detection**: Average time to detect security issues
- **Remediation Tracking**: Percentage of issues fixed within SLA

### Compliance Metrics
- **OWASP Coverage**: Percentage of OWASP Top 10 categories covered
- **Security Trend**: Security posture improvement over time
- **Team Security Maturity**: Team's security awareness and implementation
- **Risk Reduction**: Quantified risk reduction through security improvements

---

**Configuration Status**: Active
**Last Updated**: Phase 2 OneRedOak Integration
**Compliance**: OWASP Top 10 2021, NIST Cybersecurity Framework
**Integration**: LonicFLex Enhanced Security Agent v1.0+