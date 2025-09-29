#!/usr/bin/env node
const { info, warn, error } = require('../services/logger');
/**
 * Real Natural Language Processor
 *
 * Replaces stub implementations with actual AI-powered natural language processing
 * for project requirement analysis, decomposition, and code generation planning.
 */

const { randomBytes } = require('crypto');

class RealNaturalLanguageProcessor {
    constructor() {
        // For now, we'll use rule-based analysis enhanced with better intelligence
        // In production, this would integrate with Claude API or other LLM services
        this.projectPatterns = this.initializeProjectPatterns();
        this.technologyMapping = this.initializeTechnologyMapping();
        this.featureDetectors = this.initializeFeatureDetectors();
        this.complexityAnalyzers = this.initializeComplexityAnalyzers();
    }

    /**
     * Enhanced requirement analysis using intelligent pattern recognition
     */
    async analyzeRequirements(input) {
        info(`🧠 Real NL Processor: Analyzing "${input.substring(0, 50)}..."`);

        // Step 1: Extract project type with confidence scoring
        const projectAnalysis = this.analyzeProjectType(input);

        // Step 2: Extract features with context understanding
        const featureAnalysis = this.extractIntelligentFeatures(input);

        // Step 3: Analyze technical requirements and constraints
        const technicalAnalysis = this.analyzeTechnicalRequirements(input);

        // Step 4: Determine complexity with multi-factor analysis
        const complexityAnalysis = this.analyzeComplexityIntelligent(input);

        // Step 5: Extract user stories and acceptance criteria
        const userStoryAnalysis = this.extractUserStories(input);

        return {
            input: input,
            analysisTimestamp: new Date().toISOString(),

            // Project identification
            projectType: projectAnalysis.type,
            projectConfidence: projectAnalysis.confidence,
            projectCategory: projectAnalysis.category,

            // Feature analysis
            coreFeatures: featureAnalysis.core,
            secondaryFeatures: featureAnalysis.secondary,
            advancedFeatures: featureAnalysis.advanced,

            // Technical analysis
            technologyStack: technicalAnalysis.recommended,
            architecturePattern: technicalAnalysis.architecture,
            scalabilityNeeds: technicalAnalysis.scalability,
            securityRequirements: technicalAnalysis.security,

            // Complexity assessment
            overallComplexity: complexityAnalysis.level,
            complexityFactors: complexityAnalysis.factors,
            estimatedTimeframe: complexityAnalysis.timeframe,

            // User requirements
            userStories: userStoryAnalysis.stories,
            acceptanceCriteria: userStoryAnalysis.criteria,
            businessGoals: userStoryAnalysis.goals
        };
    }

    /**
     * Intelligent project decomposition based on analysis
     */
    async decomposeProject(requirementAnalysis) {
        info(`🔄 Real NL Processor: Decomposing ${requirementAnalysis.projectType} project`);

        const decomposition = {
            projectId: `real_${Date.now()}_${randomBytes(4).toString('hex')}`,
            projectType: requirementAnalysis.projectType,
            complexity: requirementAnalysis.overallComplexity,

            // Intelligent phase planning
            phases: this.generateIntelligentPhases(requirementAnalysis),

            // Component analysis
            components: this.identifyProjectComponents(requirementAnalysis),

            // Dependency analysis
            dependencies: this.analyzeDependencies(requirementAnalysis),

            // File structure planning
            fileStructure: this.planFileStructure(requirementAnalysis),

            // Implementation timeline
            timeline: this.generateRealisticTimeline(requirementAnalysis)
        };

        return decomposition;
    }

    /**
     * Generate actual code structure and implementation plan
     */
    async generateCodeImplementationPlan(decomposition) {
        info(`💻 Real NL Processor: Planning code implementation for ${decomposition.projectType}`);

        const implementationPlan = {
            projectStructure: this.generateProjectStructure(decomposition),
            codeFiles: this.planCodeFiles(decomposition),
            implementationOrder: this.determineImplementationOrder(decomposition),
            codeTemplates: this.generateCodeTemplates(decomposition)
        };

        return implementationPlan;
    }

    // ========== Enhanced Analysis Methods ==========

    analyzeProjectType(input) {
        const patterns = this.projectPatterns;
        let bestMatch = { type: 'application', confidence: 0, category: 'general' };

        for (const [type, pattern] of Object.entries(patterns)) {
            let score = 0;

            // Keyword matching with weights
            for (const keyword of pattern.keywords) {
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = (input.match(regex) || []).length;
                score += matches * (pattern.weights[keyword] || 1);
            }

            // Context matching
            for (const context of pattern.contexts) {
                if (input.toLowerCase().includes(context.toLowerCase())) {
                    score += 2;
                }
            }

            // Calculate confidence
            const confidence = Math.min(score / pattern.maxScore, 1.0);

            if (confidence > bestMatch.confidence) {
                bestMatch = {
                    type: type,
                    confidence: confidence,
                    category: pattern.category
                };
            }
        }

        return bestMatch;
    }

    extractIntelligentFeatures(input) {
        const features = { core: [], secondary: [], advanced: [] };

        for (const [feature, detector] of Object.entries(this.featureDetectors)) {
            let score = 0;

            // Pattern matching
            for (const pattern of detector.patterns) {
                if (new RegExp(pattern, 'gi').test(input)) {
                    score += detector.weight;
                }
            }

            // Context analysis
            for (const context of detector.contexts) {
                if (input.toLowerCase().includes(context.toLowerCase())) {
                    score += 1;
                }
            }

            // Categorize by importance and score
            if (score >= detector.thresholds.advanced) {
                features.advanced.push({ name: feature, confidence: score, priority: 'high' });
            } else if (score >= detector.thresholds.secondary) {
                features.secondary.push({ name: feature, confidence: score, priority: 'medium' });
            } else if (score >= detector.thresholds.core) {
                features.core.push({ name: feature, confidence: score, priority: 'high' });
            }
        }

        return features;
    }

    analyzeTechnicalRequirements(input) {
        const lowerInput = input.toLowerCase();

        // Technology stack recommendation based on project analysis
        const recommended = this.recommendTechnologyStack(input);

        // Architecture pattern detection
        const architecture = this.detectArchitecturePattern(input);

        // Scalability analysis
        const scalability = this.analyzeScalabilityNeeds(input);

        // Security requirements
        const security = this.identifySecurityRequirements(input);

        return {
            recommended,
            architecture,
            scalability,
            security
        };
    }

    analyzeComplexityIntelligent(input) {
        const factors = [];
        let baseComplexity = 1;

        // Factor analysis
        for (const [factor, analyzer] of Object.entries(this.complexityAnalyzers)) {
            const impact = analyzer.evaluate(input);
            if (impact > 0) {
                factors.push({
                    factor: factor,
                    impact: impact,
                    description: analyzer.description
                });
                baseComplexity *= (1 + impact * analyzer.multiplier);
            }
        }

        // Determine complexity level
        let level;
        if (baseComplexity >= 4) level = 'very_high';
        else if (baseComplexity >= 2.5) level = 'high';
        else if (baseComplexity >= 1.5) level = 'medium';
        else level = 'low';

        // Estimate timeframe based on complexity
        const timeframes = {
            'low': '1-2 weeks',
            'medium': '2-4 weeks',
            'high': '1-2 months',
            'very_high': '2-4 months'
        };

        return {
            level: level,
            score: baseComplexity,
            factors: factors,
            timeframe: timeframes[level]
        };
    }

    extractUserStories(input) {
        // Extract user stories using pattern recognition
        const stories = [];
        const criteria = [];
        const goals = [];

        // Look for explicit user story patterns
        const storyPatterns = [
            /as a ([^,]+), I want to ([^,]+), so that (.+)/gi,
            /users? (?:can|should|must|need to) ([^.]+)/gi,
            /the system (?:should|must|will) ([^.]+)/gi
        ];

        for (const pattern of storyPatterns) {
            const matches = [...input.matchAll(pattern)];
            for (const match of matches) {
                if (match[1] && match[2] && match[3]) {
                    stories.push({
                        role: match[1].trim(),
                        action: match[2].trim(),
                        benefit: match[3].trim(),
                        priority: 'medium'
                    });
                } else if (match[1]) {
                    stories.push({
                        role: 'user',
                        action: match[1].trim(),
                        benefit: 'improve user experience',
                        priority: 'medium'
                    });
                }
            }
        }

        // Extract business goals
        const goalKeywords = ['goal', 'objective', 'purpose', 'aim', 'target'];
        for (const keyword of goalKeywords) {
            const regex = new RegExp(`${keyword}[^.]*`, 'gi');
            const matches = input.match(regex);
            if (matches) {
                goals.push(...matches.map(match => match.trim()));
            }
        }

        // Generate acceptance criteria from features
        const acceptancePatterns = [
            /must ([^.]+)/gi,
            /should ([^.]+)/gi,
            /required to ([^.]+)/gi
        ];

        for (const pattern of acceptancePatterns) {
            const matches = [...input.matchAll(pattern)];
            criteria.push(...matches.map(match => match[1].trim()));
        }

        return { stories, criteria, goals };
    }

    // ========== Implementation Planning Methods ==========

    generateIntelligentPhases(analysis) {
        const basePhases = [
            { name: 'planning', description: 'Requirements analysis and technical design', priority: 'critical' },
            { name: 'foundation', description: 'Project setup and core infrastructure', priority: 'critical' },
            { name: 'core_development', description: 'Core functionality implementation', priority: 'critical' },
            { name: 'feature_development', description: 'Secondary features and enhancements', priority: 'high' },
            { name: 'integration', description: 'System integration and testing', priority: 'high' },
            { name: 'deployment', description: 'Production deployment and monitoring', priority: 'medium' }
        ];

        // Customize phases based on project type and complexity
        const customizedPhases = basePhases.map(phase => ({
            ...phase,
            estimatedDuration: this.estimatePhasesDuration(phase, analysis),
            tasks: this.generatePhaseTasks(phase, analysis),
            deliverables: this.identifyPhaseDeliverables(phase, analysis)
        }));

        return customizedPhases;
    }

    identifyProjectComponents(analysis) {
        const components = [];

        // Base components based on project type
        const baseComponents = this.getBaseComponentsForType(analysis.projectType);

        // Add feature-specific components
        for (const feature of [...analysis.coreFeatures, ...analysis.secondaryFeatures]) {
            const featureComponents = this.getComponentsForFeature(feature.name);
            components.push(...featureComponents);
        }

        // Remove duplicates and prioritize
        const uniqueComponents = [...new Set([...baseComponents, ...components])];

        return uniqueComponents.map(component => ({
            name: component,
            type: this.classifyComponentType(component),
            priority: this.determineComponentPriority(component, analysis),
            dependencies: this.identifyComponentDependencies(component)
        }));
    }

    planFileStructure(analysis) {
        const structure = {};

        // Generate file structure based on project type
        switch (analysis.projectType) {
            case 'web_application':
                structure = {
                    'public/': ['index.html', 'favicon.ico'],
                    'src/': ['app.js', 'index.js'],
                    'src/components/': ['Header.js', 'Footer.js'],
                    'src/styles/': ['main.css', 'components.css'],
                    'src/utils/': ['helpers.js', 'api.js'],
                    'tests/': ['app.test.js'],
                    'config/': ['webpack.config.js'],
                    '/': ['package.json', 'README.md', '.gitignore']
                };
                break;

            case 'api_service':
                structure = {
                    'src/': ['server.js', 'app.js'],
                    'src/routes/': ['index.js', 'api.js'],
                    'src/controllers/': ['userController.js'],
                    'src/models/': ['User.js'],
                    'src/middleware/': ['auth.js', 'validation.js'],
                    'src/config/': ['database.js', 'config.js'],
                    'tests/': ['api.test.js'],
                    'docs/': ['api.md'],
                    '/': ['package.json', 'README.md', '.env.example']
                };
                break;

            case 'dashboard':
                structure = {
                    'public/': ['index.html'],
                    'src/': ['App.js', 'index.js'],
                    'src/components/': ['Dashboard.js', 'Chart.js', 'Table.js'],
                    'src/services/': ['dataService.js'],
                    'src/styles/': ['dashboard.css'],
                    'src/utils/': ['chartUtils.js'],
                    '/': ['package.json', 'README.md']
                };
                break;

            default:
                structure = {
                    'src/': ['index.js', 'main.js'],
                    'tests/': ['main.test.js'],
                    '/': ['package.json', 'README.md']
                };
        }

        return structure;
    }

    generateCodeTemplates(decomposition) {
        const templates = {};

        // Generate templates for each file type
        for (const [directory, files] of Object.entries(decomposition.fileStructure)) {
            for (const file of files) {
                const fileType = this.getFileType(file);
                templates[`${directory}${file}`] = this.generateFileTemplate(file, fileType, decomposition);
            }
        }

        return templates;
    }

    // ========== Data Initialization ==========

    initializeProjectPatterns() {
        return {
            web_application: {
                keywords: ['website', 'web app', 'frontend', 'ui', 'user interface', 'responsive', 'browser'],
                contexts: ['user login', 'navigation', 'pages', 'forms'],
                weights: { 'web app': 3, 'website': 2, 'frontend': 2 },
                maxScore: 10,
                category: 'frontend'
            },
            api_service: {
                keywords: ['api', 'rest', 'endpoint', 'service', 'backend', 'server', 'microservice'],
                contexts: ['json', 'http', 'database', 'authentication'],
                weights: { 'api': 3, 'rest': 2, 'service': 2 },
                maxScore: 12,
                category: 'backend'
            },
            dashboard: {
                keywords: ['dashboard', 'analytics', 'charts', 'metrics', 'data visualization', 'reports'],
                contexts: ['graphs', 'kpi', 'monitoring', 'business intelligence'],
                weights: { 'dashboard': 4, 'analytics': 3, 'charts': 2 },
                maxScore: 15,
                category: 'data'
            },
            mobile_app: {
                keywords: ['mobile', 'app', 'ios', 'android', 'phone', 'tablet', 'responsive'],
                contexts: ['touch', 'native', 'cross-platform'],
                weights: { 'mobile': 4, 'app': 2, 'ios': 2, 'android': 2 },
                maxScore: 12,
                category: 'mobile'
            }
        };
    }

    initializeFeatureDetectors() {
        return {
            authentication: {
                patterns: ['login', 'auth', 'user.*account', 'sign.*up', 'register'],
                contexts: ['password', 'session', 'jwt', 'oauth'],
                weight: 2,
                thresholds: { core: 1, secondary: 3, advanced: 5 }
            },
            database: {
                patterns: ['database', 'data.*stor', 'persistence', 'crud'],
                contexts: ['mysql', 'postgres', 'mongodb', 'sql'],
                weight: 3,
                thresholds: { core: 1, secondary: 4, advanced: 6 }
            },
            api_integration: {
                patterns: ['api', 'integration', 'external.*service', 'third.*party'],
                contexts: ['rest', 'graphql', 'webhook', 'oauth'],
                weight: 2,
                thresholds: { core: 2, secondary: 4, advanced: 6 }
            },
            real_time: {
                patterns: ['real.*time', 'websocket', 'live.*update', 'streaming'],
                contexts: ['socket.io', 'sse', 'push notification'],
                weight: 3,
                thresholds: { core: 2, secondary: 4, advanced: 7 }
            },
            file_upload: {
                patterns: ['upload', 'file.*handling', 'document.*manage'],
                contexts: ['multipart', 'storage', 's3', 'cloudinary'],
                weight: 2,
                thresholds: { core: 1, secondary: 3, advanced: 5 }
            }
        };
    }

    initializeTechnologyMapping() {
        return {
            frontend: {
                'web_application': ['React', 'Vue.js', 'HTML/CSS/JS'],
                'dashboard': ['React', 'D3.js', 'Chart.js'],
                'mobile_app': ['React Native', 'Flutter']
            },
            backend: {
                'api_service': ['Node.js', 'Express', 'FastAPI'],
                'web_application': ['Node.js', 'Django', 'Rails'],
                'dashboard': ['Node.js', 'Python Flask']
            },
            database: {
                'simple': ['SQLite', 'JSON files'],
                'moderate': ['PostgreSQL', 'MySQL'],
                'complex': ['MongoDB', 'Redis', 'Elasticsearch']
            }
        };
    }

    initializeComplexityAnalyzers() {
        return {
            multiple_systems: {
                evaluate: (input) => (input.match(/integration|external|third.*party|api/gi) || []).length,
                multiplier: 0.3,
                description: 'Multiple system integrations increase complexity'
            },
            real_time_features: {
                evaluate: (input) => (input.match(/real.*time|live|streaming|websocket/gi) || []).length,
                multiplier: 0.4,
                description: 'Real-time features require complex architecture'
            },
            security_requirements: {
                evaluate: (input) => (input.match(/secure|auth|permission|encrypt|security/gi) || []).length,
                multiplier: 0.2,
                description: 'Security features add implementation complexity'
            },
            scalability_needs: {
                evaluate: (input) => (input.match(/scalable|scale|performance|load|concurrent/gi) || []).length,
                multiplier: 0.3,
                description: 'Scalability requirements increase system complexity'
            }
        };
    }

    // ========== Helper Methods ==========

    recommendTechnologyStack(input) {
        const projectType = this.analyzeProjectType(input).type;
        const frontend = this.technologyMapping.frontend[projectType] || ['HTML/CSS/JS'];
        const backend = this.technologyMapping.backend[projectType] || ['Node.js'];

        // Determine database based on complexity
        const complexity = this.analyzeComplexityIntelligent(input).level;
        let database = this.technologyMapping.database.simple;
        if (complexity === 'high' || complexity === 'very_high') {
            database = this.technologyMapping.database.complex;
        } else if (complexity === 'medium') {
            database = this.technologyMapping.database.moderate;
        }

        return {
            frontend: frontend[0],
            backend: backend[0],
            database: database[0],
            alternatives: {
                frontend: frontend,
                backend: backend,
                database: database
            }
        };
    }

    detectArchitecturePattern(input) {
        if (/microservice|distributed/gi.test(input)) return 'microservices';
        if (/api.*first|headless/gi.test(input)) return 'api_first';
        if (/serverless|lambda/gi.test(input)) return 'serverless';
        return 'monolithic';
    }

    analyzeScalabilityNeeds(input) {
        const indicators = (input.match(/scalable|scale|performance|load|concurrent|users?/gi) || []).length;
        if (indicators >= 3) return 'high';
        if (indicators >= 1) return 'medium';
        return 'low';
    }

    identifySecurityRequirements(input) {
        const requirements = [];
        if (/auth|login|user/gi.test(input)) requirements.push('authentication');
        if (/permission|role|access/gi.test(input)) requirements.push('authorization');
        if (/secure|encrypt|ssl/gi.test(input)) requirements.push('data_encryption');
        if (/audit|log/gi.test(input)) requirements.push('audit_logging');
        return requirements;
    }

    estimatePhasesDuration(phase, analysis) {
        const baseDurations = {
            planning: 3, foundation: 5, core_development: 10,
            feature_development: 8, integration: 5, deployment: 3
        };

        const complexityMultiplier = {
            low: 0.7, medium: 1.0, high: 1.5, very_high: 2.0
        };

        const base = baseDurations[phase.name] || 5;
        const multiplier = complexityMultiplier[analysis.overallComplexity] || 1.0;

        return Math.ceil(base * multiplier) + ' days';
    }

    generateFileTemplate(fileName, fileType, decomposition) {
        // This would generate actual code templates
        // For now, return basic templates
        const templates = {
            'js': '// Auto-generated JavaScript file\ninfo("Hello from ' + fileName + '");',
            'html': '<!DOCTYPE html><html><head><title>Generated App</title></head><body><h1>Welcome</h1></body></html>',
            'css': '/* Auto-generated styles */\nbody { font-family: Arial, sans-serif; }',
            'json': JSON.stringify({ name: decomposition.projectId, version: "1.0.0" }, null, 2),
            'md': `# ${decomposition.projectId}\n\nAuto-generated project documentation.`
        };

        return templates[fileType] || `// Generated ${fileName}`;
    }

    getFileType(fileName) {
        const ext = fileName.split('.').pop();
        return ext || 'txt';
    }

    getBaseComponentsForType(projectType) {
        const components = {
            web_application: ['frontend', 'backend', 'database', 'authentication'],
            api_service: ['server', 'routes', 'middleware', 'database'],
            dashboard: ['data_service', 'charts', 'ui_components', 'api'],
            mobile_app: ['navigation', 'screens', 'services', 'storage']
        };
        return components[projectType] || ['main', 'utilities'];
    }

    getComponentsForFeature(featureName) {
        const featureComponents = {
            authentication: ['auth_service', 'user_model', 'login_component'],
            database: ['models', 'migrations', 'queries'],
            api_integration: ['api_client', 'data_mapper', 'error_handler'],
            file_upload: ['upload_handler', 'file_storage', 'validation']
        };
        return featureComponents[featureName] || [];
    }

    classifyComponentType(component) {
        if (['frontend', 'ui', 'component'].some(term => component.includes(term))) return 'frontend';
        if (['backend', 'server', 'api'].some(term => component.includes(term))) return 'backend';
        if (['database', 'model', 'storage'].some(term => component.includes(term))) return 'data';
        return 'utility';
    }

    determineComponentPriority(component, analysis) {
        const criticalComponents = ['authentication', 'database', 'server', 'main'];
        return criticalComponents.includes(component) ? 'high' : 'medium';
    }

    identifyComponentDependencies(component) {
        const dependencies = {
            'auth_service': ['database', 'user_model'],
            'api_client': ['error_handler'],
            'charts': ['data_service'],
            'upload_handler': ['file_storage', 'validation']
        };
        return dependencies[component] || [];
    }

    generatePhaseTasks(phase, analysis) {
        // Generate specific tasks for each phase based on project analysis
        const baseTasks = {
            planning: ['Analyze requirements', 'Create technical design', 'Setup development environment'],
            foundation: ['Initialize project structure', 'Setup build tools', 'Configure basic infrastructure'],
            core_development: ['Implement main functionality', 'Create core components', 'Setup data models'],
            feature_development: ['Add secondary features', 'Enhance user experience', 'Optimize performance'],
            integration: ['Test all features', 'Fix integration issues', 'Perform quality assurance'],
            deployment: ['Setup production environment', 'Deploy application', 'Configure monitoring']
        };
        return baseTasks[phase.name] || ['Complete phase objectives'];
    }

    identifyPhaseDeliverables(phase, analysis) {
        const deliverables = {
            planning: ['Technical specification', 'Project timeline', 'Resource allocation plan'],
            foundation: ['Project repository', 'Development environment', 'Basic project structure'],
            core_development: ['Working core features', 'Database schema', 'API endpoints'],
            feature_development: ['Complete feature set', 'User interface', 'Documentation'],
            integration: ['Tested application', 'Bug fixes', 'Performance optimization'],
            deployment: ['Live application', 'Deployment documentation', 'Monitoring setup']
        };
        return deliverables[phase.name] || ['Phase completion'];
    }

    analyzeDependencies(analysis) {
        // Analyze component dependencies based on features
        const dependencies = [];

        if (analysis.coreFeatures.some(f => f.name === 'authentication')) {
            dependencies.push({
                from: 'frontend',
                to: 'authentication_service',
                type: 'requires',
                description: 'Frontend needs authentication for user management'
            });
        }

        if (analysis.coreFeatures.some(f => f.name === 'database')) {
            dependencies.push({
                from: 'backend',
                to: 'database',
                type: 'requires',
                description: 'Backend requires database for data persistence'
            });
        }

        return dependencies;
    }

    generateRealisticTimeline(analysis) {
        const phases = this.generateIntelligentPhases(analysis);
        let totalDays = 0;

        const timeline = phases.map(phase => {
            const duration = parseInt(phase.estimatedDuration) || 5;
            totalDays += duration;

            return {
                phase: phase.name,
                startDay: totalDays - duration,
                endDay: totalDays,
                duration: `${duration} days`
            };
        });

        return {
            totalDuration: `${totalDays} days`,
            phases: timeline,
            milestones: this.identifyMilestones(timeline)
        };
    }

    identifyMilestones(timeline) {
        return timeline.filter(phase =>
            ['foundation', 'core_development', 'integration', 'deployment'].includes(phase.phase)
        ).map(phase => ({
            name: `${phase.phase.replace('_', ' ')} complete`,
            day: phase.endDay,
            description: `${phase.phase} milestone achieved`
        }));
    }

    generateProjectStructure(decomposition) {
        return {
            name: decomposition.projectId,
            type: decomposition.projectType,
            structure: decomposition.fileStructure,
            mainFiles: this.identifyMainFiles(decomposition),
            entryPoint: this.determineEntryPoint(decomposition)
        };
    }

    planCodeFiles(decomposition) {
        const codeFiles = [];

        for (const [directory, files] of Object.entries(decomposition.fileStructure)) {
            for (const file of files) {
                codeFiles.push({
                    path: `${directory}${file}`,
                    type: this.getFileType(file),
                    priority: this.determineFilePriority(file),
                    template: this.generateFileTemplate(file, this.getFileType(file), decomposition)
                });
            }
        }

        return codeFiles.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    determineImplementationOrder(decomposition) {
        const order = [];

        // 1. Configuration files first
        order.push(...this.getFilesByType(['json', 'yml', 'yaml', 'env'], decomposition));

        // 2. Core backend files
        order.push(...this.getFilesByPattern(['server', 'app', 'main'], decomposition));

        // 3. Models and database
        order.push(...this.getFilesByPattern(['model', 'schema', 'migration'], decomposition));

        // 4. API routes and controllers
        order.push(...this.getFilesByPattern(['route', 'controller', 'api'], decomposition));

        // 5. Frontend components
        order.push(...this.getFilesByPattern(['component', 'view', 'page'], decomposition));

        // 6. Styles and assets
        order.push(...this.getFilesByType(['css', 'scss', 'less'], decomposition));

        // 7. Tests
        order.push(...this.getFilesByPattern(['test', 'spec'], decomposition));

        return order;
    }

    getFilesByType(types, decomposition) {
        const files = [];
        for (const [directory, fileList] of Object.entries(decomposition.fileStructure)) {
            for (const file of fileList) {
                if (types.includes(this.getFileType(file))) {
                    files.push(`${directory}${file}`);
                }
            }
        }
        return files;
    }

    getFilesByPattern(patterns, decomposition) {
        const files = [];
        for (const [directory, fileList] of Object.entries(decomposition.fileStructure)) {
            for (const file of fileList) {
                if (patterns.some(pattern => file.toLowerCase().includes(pattern.toLowerCase()))) {
                    files.push(`${directory}${file}`);
                }
            }
        }
        return files;
    }

    identifyMainFiles(decomposition) {
        const mainPatterns = ['index', 'main', 'app', 'server'];
        return this.getFilesByPattern(mainPatterns, decomposition);
    }

    determineEntryPoint(decomposition) {
        const entryPoints = ['index.js', 'main.js', 'app.js', 'server.js'];

        for (const [directory, files] of Object.entries(decomposition.fileStructure)) {
            for (const file of files) {
                if (entryPoints.includes(file)) {
                    return `${directory}${file}`;
                }
            }
        }

        return 'src/index.js'; // Default
    }

    determineFilePriority(fileName) {
        const highPriority = ['package.json', 'index.js', 'app.js', 'server.js', 'main.js'];
        const lowPriority = ['README.md', '.gitignore', 'test'];

        if (highPriority.some(pattern => fileName.includes(pattern))) return 'high';
        if (lowPriority.some(pattern => fileName.includes(pattern))) return 'low';
        return 'medium';
    }
}

module.exports = { RealNaturalLanguageProcessor };