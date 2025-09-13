"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphiteService = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class GraphiteService {
    constructor() {
        this.gitInitialized = false;
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.checkGitStatus();
    }
    async checkGitStatus() {
        try {
            await execAsync('git status', { cwd: this.workspaceRoot });
            this.gitInitialized = true;
        }
        catch (error) {
            this.gitInitialized = false;
            console.log('Git not initialized in workspace');
        }
    }
    // Graphite-inspired engineering practices analysis
    async analyzeEngineeringPractices() {
        const practices = [];
        // 1. Incremental Development
        const incrementalPractice = await this.checkIncrementalDevelopment();
        practices.push(incrementalPractice);
        // 2. Code Review Quality
        const reviewPractice = await this.checkCodeReviewPractices();
        practices.push(reviewPractice);
        // 3. Clean Commit History
        const commitPractice = await this.checkCommitQuality();
        practices.push(commitPractice);
        // 4. Testing Practices
        const testingPractice = await this.checkTestingPractices();
        practices.push(testingPractice);
        // 5. Code Quality Standards
        const qualityPractice = await this.checkCodeQuality();
        practices.push(qualityPractice);
        return practices;
    }
    async checkIncrementalDevelopment() {
        let score = 0;
        const suggestions = [];
        if (!this.gitInitialized) {
            return {
                name: 'Incremental Development',
                description: 'Making small, focused changes that are easy to review and understand',
                implemented: false,
                score: 0,
                suggestions: ['Initialize Git repository', 'Start making small, focused commits']
            };
        }
        try {
            // Check recent commit sizes
            const { stdout } = await execAsync('git log --oneline -10 --pretty=format:"%h %s"', { cwd: this.workspaceRoot });
            const commits = stdout.split('\n').filter(line => line.trim());
            if (commits.length > 5) {
                score += 30; // Regular commits
            }
            // Check for small commit sizes (heuristic: commits with focused messages)
            const focusedCommits = commits.filter(commit => {
                const message = commit.substring(8).toLowerCase();
                return message.length < 50 && (message.includes('fix') ||
                    message.includes('add') ||
                    message.includes('update') ||
                    message.includes('refactor'));
            });
            if (focusedCommits.length / commits.length > 0.7) {
                score += 40; // Good commit message quality
            }
            else {
                suggestions.push('Write more focused commit messages');
                suggestions.push('Break large changes into smaller commits');
            }
            // Check diff sizes
            const { stdout: diffStats } = await execAsync('git log --stat --oneline -5', { cwd: this.workspaceRoot });
            const hasLargeChanges = diffStats.includes('++++++++++++++++++++++++++++++++++++++++++++++++');
            if (!hasLargeChanges) {
                score += 30; // Small, manageable changes
            }
            else {
                suggestions.push('Consider breaking large changes into smaller increments');
            }
        }
        catch (error) {
            suggestions.push('Unable to analyze git history');
        }
        return {
            name: 'Incremental Development',
            description: 'Making small, focused changes that are easy to review and understand',
            implemented: score > 50,
            score,
            suggestions
        };
    }
    async checkCodeReviewPractices() {
        let score = 0;
        const suggestions = [];
        try {
            // Check for branch-based development
            const { stdout: branches } = await execAsync('git branch -a', { cwd: this.workspaceRoot });
            const branchCount = branches.split('\n').filter(b => b.trim() && !b.includes('HEAD')).length;
            if (branchCount > 1) {
                score += 40; // Using branches
            }
            else {
                suggestions.push('Use feature branches for better code review workflow');
            }
            // Check for merge commits (indicates PR/MR workflow)
            const { stdout: mergeCommits } = await execAsync('git log --merges --oneline -5', { cwd: this.workspaceRoot });
            if (mergeCommits.trim()) {
                score += 30; // Has merge commits
            }
            else {
                suggestions.push('Consider using pull requests for code review');
            }
            // Check for descriptive commit messages
            const { stdout: recentCommits } = await execAsync('git log --oneline -10 --pretty=format:"%s"', { cwd: this.workspaceRoot });
            const commits = recentCommits.split('\n');
            const descriptiveCommits = commits.filter(msg => msg.length > 20 && msg.includes(' '));
            if (descriptiveCommits.length / commits.length > 0.6) {
                score += 30; // Good commit descriptions
            }
            else {
                suggestions.push('Write more descriptive commit messages');
            }
        }
        catch (error) {
            suggestions.push('Initialize git repository for better code review practices');
        }
        if (score < 50) {
            suggestions.push('Set up automated code review tools');
            suggestions.push('Establish code review checklist');
        }
        return {
            name: 'Code Review Practices',
            description: 'Systematic approach to reviewing code changes before merging',
            implemented: score > 60,
            score,
            suggestions
        };
    }
    async checkCommitQuality() {
        let score = 0;
        const suggestions = [];
        if (!this.gitInitialized) {
            return {
                name: 'Clean Commit History',
                description: 'Maintaining a clear, readable git history',
                implemented: false,
                score: 0,
                suggestions: ['Initialize Git repository', 'Follow conventional commit format']
            };
        }
        try {
            // Check commit message format
            const { stdout } = await execAsync('git log --oneline -10 --pretty=format:"%s"', { cwd: this.workspaceRoot });
            const messages = stdout.split('\n');
            // Check for conventional commits
            const conventionalPattern = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: .+/;
            const conventionalCommits = messages.filter(msg => conventionalPattern.test(msg));
            if (conventionalCommits.length / messages.length > 0.5) {
                score += 50; // Good conventional commit usage
            }
            else {
                suggestions.push('Use conventional commit format (feat:, fix:, docs:, etc.)');
            }
            // Check for atomic commits
            const atomicCommits = messages.filter(msg => !msg.toLowerCase().includes('and') &&
                !msg.toLowerCase().includes('also') &&
                msg.length < 72);
            if (atomicCommits.length / messages.length > 0.7) {
                score += 30; // Atomic commits
            }
            else {
                suggestions.push('Make commits atomic - one logical change per commit');
            }
            // Check for no merge conflicts in history
            const { stdout: conflicts } = await execAsync('git log --grep="conflict" --oneline', { cwd: this.workspaceRoot });
            if (!conflicts.trim()) {
                score += 20; // Clean history
            }
        }
        catch (error) {
            suggestions.push('Unable to analyze commit history');
        }
        return {
            name: 'Clean Commit History',
            description: 'Maintaining a clear, readable git history',
            implemented: score > 60,
            score,
            suggestions
        };
    }
    async checkTestingPractices() {
        let score = 0;
        const suggestions = [];
        try {
            // Look for test files
            const testPatterns = ['**/*.test.*', '**/*.spec.*', '**/test/**', '**/tests/**'];
            let testFiles = [];
            for (const pattern of testPatterns) {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');
                testFiles = testFiles.concat(files);
            }
            if (testFiles.length > 0) {
                score += 40; // Has test files
                // Check test-to-source ratio
                const sourceFiles = await vscode.workspace.findFiles('**/*.{js,ts,py,java,cpp}', '**/node_modules/**');
                const ratio = testFiles.length / sourceFiles.length;
                if (ratio > 0.3) {
                    score += 30; // Good test coverage
                }
                else {
                    suggestions.push('Increase test coverage - aim for at least 30% test-to-source ratio');
                }
                // Check for different types of tests
                const unitTests = testFiles.filter(f => f.path.includes('unit') || f.path.includes('.test.'));
                const integrationTests = testFiles.filter(f => f.path.includes('integration') || f.path.includes('e2e'));
                if (unitTests.length > 0 && integrationTests.length > 0) {
                    score += 30; // Multiple test types
                }
                else {
                    suggestions.push('Add both unit and integration tests');
                }
            }
            else {
                suggestions.push('Add test files to your project');
                suggestions.push('Set up a testing framework');
            }
            // Check for CI/CD configuration
            const ciFiles = await vscode.workspace.findFiles('**/.github/workflows/**', '');
            const ciConfigFiles = await vscode.workspace.findFiles('**/{.travis.yml,.circleci/**,azure-pipelines.yml}', '');
            if (ciFiles.length > 0 || ciConfigFiles.length > 0) {
                score += 20; // Has CI/CD
            }
            else {
                suggestions.push('Set up continuous integration');
            }
        }
        catch (error) {
            suggestions.push('Unable to analyze testing setup');
        }
        return {
            name: 'Testing Practices',
            description: 'Comprehensive testing strategy with automated test execution',
            implemented: score > 60,
            score,
            suggestions
        };
    }
    async checkCodeQuality() {
        let score = 0;
        const suggestions = [];
        try {
            // Check for linting configuration
            const lintFiles = await vscode.workspace.findFiles('**/{.eslintrc*,.pylintrc,.rubocop.yml,tslint.json}', '');
            if (lintFiles.length > 0) {
                score += 25; // Has linting
            }
            else {
                suggestions.push('Add linting configuration for code quality');
            }
            // Check for formatting configuration
            const formatFiles = await vscode.workspace.findFiles('**/{.prettierrc*,.editorconfig,pyproject.toml}', '');
            if (formatFiles.length > 0) {
                score += 25; // Has formatting
            }
            else {
                suggestions.push('Add code formatting configuration');
            }
            // Check for type checking (TypeScript, mypy, etc.)
            const typeFiles = await vscode.workspace.findFiles('**/tsconfig.json', '');
            const pythonTypeFiles = await vscode.workspace.findFiles('**/mypy.ini', '');
            if (typeFiles.length > 0 || pythonTypeFiles.length > 0) {
                score += 25; // Has type checking
            }
            else {
                suggestions.push('Enable type checking for better code quality');
            }
            // Check for documentation
            const docFiles = await vscode.workspace.findFiles('**/{README.md,CONTRIBUTING.md,docs/**}', '');
            if (docFiles.length > 0) {
                score += 25; // Has documentation
            }
            else {
                suggestions.push('Add project documentation');
            }
            // Analyze current file for quality issues
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const document = activeEditor.document;
                const text = document.getText();
                // Simple heuristics for code quality
                const lines = text.split('\n');
                const longLines = lines.filter((line) => line.length > 120);
                const complexFunctions = text.match(/function\s+\w+\([^)]*\)\s*{[^}]{200,}/g) || [];
                if (longLines.length / lines.length < 0.1) {
                    score += 10; // Good line length
                }
                else {
                    suggestions.push('Keep lines under 120 characters');
                }
                if (complexFunctions.length === 0) {
                    score += 10; // No overly complex functions
                }
                else {
                    suggestions.push('Break down complex functions into smaller ones');
                }
            }
        }
        catch (error) {
            suggestions.push('Unable to analyze code quality setup');
        }
        return {
            name: 'Code Quality Standards',
            description: 'Automated tools and practices for maintaining high code quality',
            implemented: score > 70,
            score,
            suggestions
        };
    }
    async generateEngineeringReport() {
        const practices = await this.analyzeEngineeringPractices();
        const overallScore = practices.reduce((sum, p) => sum + p.score, 0) / practices.length;
        let report = `# 🏆 Graphite Engineering Practices Report\n\n`;
        report += `**Overall Engineering Score: ${Math.round(overallScore)}/100**\n\n`;
        if (overallScore >= 80) {
            report += `🎉 **Excellent!** Your team demonstrates outstanding engineering practices!\n\n`;
        }
        else if (overallScore >= 60) {
            report += `👍 **Good work!** Your engineering practices are solid with room for improvement.\n\n`;
        }
        else {
            report += `🚀 **Getting started!** Let's level up your engineering practices.\n\n`;
        }
        practices.forEach(practice => {
            const status = practice.implemented ? '✅' : '⚠️';
            report += `## ${status} ${practice.name} (${practice.score}/100)\n`;
            report += `${practice.description}\n\n`;
            if (practice.suggestions.length > 0) {
                report += `**Suggestions:**\n`;
                practice.suggestions.forEach(suggestion => {
                    report += `- ${suggestion}\n`;
                });
                report += `\n`;
            }
        });
        report += `---\n`;
        report += `*This report is powered by AI Debugger Mentor's Graphite-inspired engineering analysis.*\n`;
        report += `*Great engineering practices make all the difference! 🚀*`;
        return report;
    }
    async showEngineeringReport() {
        const report = await this.generateEngineeringReport();
        // Create a new document to show the report
        const doc = await vscode.workspace.openTextDocument({
            content: report,
            language: 'markdown'
        });
        await vscode.window.showTextDocument(doc);
        // Also show a summary notification
        const practices = await this.analyzeEngineeringPractices();
        const implementedCount = practices.filter(p => p.implemented).length;
        vscode.window.showInformationMessage(`📊 Engineering Report: ${implementedCount}/${practices.length} practices implemented. Check the opened document for details!`);
    }
    // Integration with voice service for Graphite practices
    async narrateEngineeringPractices() {
        const practices = await this.analyzeEngineeringPractices();
        const narrations = [];
        practices.forEach(practice => {
            if (practice.implemented) {
                narrations.push(`Great job implementing ${practice.name}! Your score is ${practice.score} out of 100.`);
            }
            else {
                narrations.push(`Let's work on ${practice.name}. ${practice.suggestions[0] || 'This will improve your code quality.'}`);
            }
        });
        return narrations;
    }
}
exports.GraphiteService = GraphiteService;
//# sourceMappingURL=graphiteService.js.map