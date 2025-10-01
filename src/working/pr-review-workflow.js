/**
 * PR Review Workflow - Actually Works
 * Real workflow that does actual PR analysis
 */

const { GitHubReal } = require('./github-real');

class PRReviewWorkflow {
    constructor(options = {}) {
        this.github = new GitHubReal(options);
        this.rules = {
            maxAdditions: 500,
            maxChangedFiles: 10,
            requireTests: true
        };
    }

    /**
     * Execute PR review workflow - ACTUALLY WORKS
     */
    async execute(prNumber) {
        console.log(` Starting PR review for #${prNumber}...`);

        try {
            // Step 1: Get PR details
            const pr = await this.github.getPR(prNumber);
            console.log(` Reviewing: ${pr.title}`);

            // Step 2: Analyze PR
            const analysis = this.analyzePR(pr);

            // Step 3: Generate recommendations
            const recommendations = this.generateRecommendations(analysis);

            // Step 4: Create review summary
            const review = {
                prNumber: pr.number,
                title: pr.title,
                author: pr.user?.login || 'unknown',
                analysis: analysis,
                recommendations: recommendations,
                overallScore: this.calculateScore(analysis),
                timestamp: new Date().toISOString()
            };

            console.log(`PASS Review completed with score: ${review.overallScore}/100`);
            return review;

        } catch (error) {
            console.error(`FAIL PR review failed for #${prNumber}:`, error.message);
            throw error;
        }
    }

    /**
     * Analyze PR metrics
     */
    analyzePR(pr) {
        return {
            size: {
                additions: pr.additions || 0,
                deletions: pr.deletions || 0,
                changedFiles: pr.changed_files || 0,
                complexity: this.calculateComplexity(pr)
            },
            risks: this.identifyRisks(pr),
            quality: this.assessQuality(pr)
        };
    }

    /**
     * Calculate PR complexity score
     */
    calculateComplexity(pr) {
        const additions = pr.additions || 0;
        const changedFiles = pr.changed_files || 0;

        if (additions > 1000 || changedFiles > 15) return 'high';
        if (additions > 200 || changedFiles > 5) return 'medium';
        return 'low';
    }

    /**
     * Identify potential risks
     */
    identifyRisks(pr) {
        const risks = [];

        if ((pr.additions || 0) > this.rules.maxAdditions) {
            risks.push('Large PR - consider splitting');
        }

        if ((pr.changed_files || 0) > this.rules.maxChangedFiles) {
            risks.push('Too many files changed - hard to review');
        }

        if (pr.title?.toLowerCase().includes('fix') && (pr.additions || 0) > 50) {
            risks.push('Large fix - might introduce new bugs');
        }

        if (!pr.body || pr.body.length < 50) {
            risks.push('Missing or insufficient description');
        }

        return risks;
    }

    /**
     * Assess code quality indicators
     */
    assessQuality(pr) {
        const quality = {
            hasDescription: (pr.body || '').length > 50,
            reasonableSize: (pr.additions || 0) <= this.rules.maxAdditions,
            focusedScope: (pr.changed_files || 0) <= this.rules.maxChangedFiles
        };

        quality.score = Object.values(quality).filter(Boolean).length * 33.3;
        return quality;
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations(analysis) {
        const recommendations = [];

        if (analysis.size.complexity === 'high') {
            recommendations.push('Consider splitting this PR into smaller, focused changes');
        }

        if (analysis.risks.length > 0) {
            recommendations.push(`Address risks: ${analysis.risks.join(', ')}`);
        }

        if (analysis.quality.score < 66) {
            recommendations.push('Improve PR description and scope');
        }

        if (analysis.size.additions > 100) {
            recommendations.push('Add comprehensive tests for new functionality');
        }

        if (recommendations.length === 0) {
            recommendations.push('PR looks good - ready for detailed code review');
        }

        return recommendations;
    }

    /**
     * Calculate overall PR score
     */
    calculateScore(analysis) {
        let score = 100;

        // Complexity penalty
        if (analysis.size.complexity === 'high') score -= 30;
        else if (analysis.size.complexity === 'medium') score -= 15;

        // Risk penalty
        score -= analysis.risks.length * 10;

        // Quality bonus/penalty
        score = Math.max(0, score + (analysis.quality.score - 66));

        return Math.round(Math.max(0, Math.min(100, score)));
    }

    /**
     * Post review as PR comment
     */
    async postReview(prNumber, review) {
        const comment = this.formatReviewComment(review);
        return await this.github.commentOnPR(prNumber, comment);
    }

    /**
     * Format review as markdown comment
     */
    formatReviewComment(review) {
        return `## AGENT Automated PR Review

**Overall Score: ${review.overallScore}/100**

### METRICS Analysis
- **Size**: ${review.analysis.size.additions} additions, ${review.analysis.size.deletions} deletions
- **Files**: ${review.analysis.size.changedFiles} changed
- **Complexity**: ${review.analysis.size.complexity}

### WARN Risks Found
${review.analysis.risks.length > 0 ?
    review.analysis.risks.map(risk => `- ${risk}`).join('\n') :
    '- No major risks identified'}

###  Recommendations
${review.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*Generated by LonicFLex PR Review Workflow*`;
    }
}

module.exports = { PRReviewWorkflow };

// Test if run directly
if (require.main === module) {
    async function testWorkflow() {
        console.log('TEST Testing PR Review Workflow...\n');

        const workflow = new PRReviewWorkflow();

        try {
            // Test with mock PR (no token needed)
            const review = await workflow.execute(123);

            console.log('\n Review Results:');
            console.log(`Score: ${review.overallScore}/100`);
            console.log(`Recommendations: ${review.recommendations.length}`);
            console.log(`Risks: ${review.analysis.risks.length}`);

            console.log('\n Generated Comment:');
            console.log(workflow.formatReviewComment(review));

            console.log('\nPASS PR Review Workflow test completed!');

        } catch (error) {
            console.error('\nFAIL Workflow test failed:', error.message);
        }
    }

    testWorkflow();
}