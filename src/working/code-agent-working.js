/**
 * Working Code Agent - No inheritance, just functions that work
 * Generates code, writes files, runs tests
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

class CodeAgentWorking {
    constructor(options = {}) {
        this.agentName = 'code';
        this.sessionId = options.sessionId;
        this.outputDir = options.outputDir || './generated';
        this.language = options.language || 'javascript';
        this.framework = options.framework || 'node';
    }

    /**
     * Generate JavaScript function
     */
    generateFunction(name, params = [], body = '// TODO: implement', description = '') {
        const paramList = params.join(', ');
        const jsdoc = description ? `/**\n * ${description}\n */\n` : '';

        return `${jsdoc}function ${name}(${paramList}) {\n    ${body}\n}`;
    }

    /**
     * Generate JavaScript class
     */
    generateClass(name, methods = [], properties = [], description = '') {
        const jsdoc = description ? `/**\n * ${description}\n */\n` : '';

        let classCode = `${jsdoc}class ${name} {\n`;

        if (properties.length > 0) {
            classCode += '    constructor() {\n';
            properties.forEach(prop => {
                classCode += `        this.${prop} = null;\n`;
            });
            classCode += '    }\n\n';
        }

        methods.filter(method => method.name !== 'constructor').forEach(method => {
            classCode += `    ${method.name}(${method.params?.join(', ') || ''}) {\n`;
            classCode += `        ${method.body || '// TODO: implement'}\n`;
            classCode += '    }\n\n';
        });

        classCode += '}';
        return classCode;
    }

    /**
     * Generate test file
     */
    generateTest(targetFile, testType = 'jest') {
        const baseName = path.basename(targetFile, '.js');
        const className = baseName.charAt(0).toUpperCase() + baseName.slice(1);

        if (testType === 'jest') {
            return `const { ${className} } = require('./${baseName}');

describe('${className}', () => {
    test('should create instance', () => {
        const instance = new ${className}();
        expect(instance).toBeDefined();
    });

    test('should have expected methods', () => {
        const instance = new ${className}();
        // Add method tests here
        expect(typeof instance).toBe('object');
    });
});`;
        }

        return `// Test for ${baseName}\n// TODO: implement tests`;
    }

    /**
     * Write code to file
     */
    async writeCodeFile(filename, content, subdir = '') {
        const outputPath = subdir ?
            path.join(this.outputDir, subdir) :
            this.outputDir;

        // Ensure directory exists
        await fs.mkdir(outputPath, { recursive: true });

        const filePath = path.join(outputPath, filename);
        await fs.writeFile(filePath, content, 'utf8');

        console.log(`✅ Generated: ${filePath}`);
        return filePath;
    }

    /**
     * Run tests on generated code
     */
    async runTests(testFile) {
        return new Promise((resolve) => {
            const testProcess = spawn('node', [testFile], {
                stdio: 'pipe'
            });

            let output = '';
            let error = '';

            testProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            testProcess.stderr.on('data', (data) => {
                error += data.toString();
            });

            testProcess.on('close', (code) => {
                resolve({
                    success: code === 0,
                    output,
                    error,
                    exitCode: code
                });
            });
        });
    }

    /**
     * Execute code generation workflow
     */
    async executeWorkflow(context) {
        const results = {
            timestamp: new Date().toISOString(),
            sessionId: this.sessionId,
            context,
            files: []
        };

        try {
            if (context.action === 'generate-function') {
                const code = this.generateFunction(
                    context.name,
                    context.params,
                    context.body,
                    context.description
                );

                const filename = `${context.name}.js`;
                const filePath = await this.writeCodeFile(filename, code);
                results.files.push(filePath);

            } else if (context.action === 'generate-class') {
                const code = this.generateClass(
                    context.name,
                    context.methods,
                    context.properties,
                    context.description
                );

                const filename = `${context.name}.js`;
                const filePath = await this.writeCodeFile(filename, code);
                results.files.push(filePath);

                // Generate test file
                if (context.generateTests) {
                    const testCode = this.generateTest(filename);
                    const testPath = await this.writeCodeFile(
                        `${context.name}.test.js`,
                        testCode,
                        'tests'
                    );
                    results.files.push(testPath);
                }

            } else if (context.action === 'generate-module') {
                // Generate multiple functions in one module
                let moduleCode = `/**\n * ${context.name} Module\n * Generated by CodeAgentWorking\n */\n\n`;

                context.functions?.forEach(func => {
                    moduleCode += this.generateFunction(
                        func.name,
                        func.params,
                        func.body,
                        func.description
                    ) + '\n\n';
                });

                // Add exports
                if (context.functions?.length > 0) {
                    moduleCode += 'module.exports = {\n';
                    moduleCode += context.functions.map(f => `    ${f.name}`).join(',\n');
                    moduleCode += '\n};\n';
                }

                const filename = `${context.name}.js`;
                const filePath = await this.writeCodeFile(filename, moduleCode);
                results.files.push(filePath);

            } else if (context.action === 'run-tests') {
                if (context.testFile) {
                    const testResults = await this.runTests(context.testFile);
                    results.testResults = testResults;
                }

            } else {
                throw new Error(`Unknown action: ${context.action}`);
            }

            results.success = true;
            return results;

        } catch (error) {
            results.success = false;
            results.error = error.message;
            throw error;
        }
    }

    /**
     * Get status and capabilities
     */
    getStatus() {
        return {
            agent: this.agentName,
            language: this.language,
            framework: this.framework,
            outputDir: this.outputDir,
            capabilities: [
                'generate-function',
                'generate-class',
                'generate-module',
                'run-tests'
            ]
        };
    }
}

module.exports = { CodeAgentWorking };

// Test if run directly
if (require.main === module) {
    async function testCodeAgent() {
        console.log('🧪 Testing CodeAgentWorking...\n');

        const agent = new CodeAgentWorking({
            sessionId: 'test-session',
            outputDir: './test-generated'
        });

        console.log('Status:', agent.getStatus());

        try {
            // Test function generation
            const result = await agent.executeWorkflow({
                action: 'generate-function',
                name: 'calculateSum',
                params: ['a', 'b'],
                body: 'return a + b;',
                description: 'Calculates the sum of two numbers'
            });

            console.log('✅ Code generation successful');
            console.log(`Generated files: ${result.files.length}`);

            // Test class generation
            const classResult = await agent.executeWorkflow({
                action: 'generate-class',
                name: 'Calculator',
                methods: [
                    { name: 'add', params: ['a', 'b'], body: 'return a + b;' },
                    { name: 'subtract', params: ['a', 'b'], body: 'return a - b;' }
                ],
                properties: ['result'],
                description: 'Simple calculator class',
                generateTests: true
            });

            console.log('✅ Class generation successful');
            console.log(`Generated files: ${classResult.files.length}`);

        } catch (error) {
            console.error('❌ Code agent test failed:', error.message);
        }
    }

    testCodeAgent();
}