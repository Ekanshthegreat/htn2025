import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ProfileManager } from './profileManager';

export interface MentorDiagnostic {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    type: 'infinite_loop' | 'missing_increment' | 'security' | 'performance' | 'style' | 'null_pointer';
    mentorPersona: string;
    mentorAdvice: string;
}

export class RealtimeAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private analysisTimeout: NodeJS.Timeout | null = null;
    private lastAnalyzedContent = '';
    private isEnabled = true;

    constructor(private profileManager: ProfileManager) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('realtimeAnalyzer');
        console.log('🔍 RealtimeAnalyzer initialized for blue squiggle diagnostics with mentor persona');
        this.setupEventListeners();
    }

    private getMentorMessageStyle(activeProfile: any, baseMessage: string, context: 'performance' | 'security' | 'quality'): string {
        const personality = activeProfile.personality;
        
        // Direct, critical mentors (like Linus)
        if (personality.communicationStyle === 'direct' && personality.feedbackApproach === 'critical') {
            switch (context) {
                case 'performance':
                    return baseMessage.replace(/inefficient/i, 'inefficient. Use a Set or Map, for crying out loud!')
                                   .replace(/can block/i, 'blocks the event loop? Really? Use async operations, this isn\'t 1995!');
                case 'security':
                    return baseMessage.replace(/eval\(\)/i, 'eval()? Are you insane? This is a massive security hole!')
                                   .replace(/innerHTML/i, 'innerHTML without sanitization? That\'s how you get XSS vulnerabilities!')
                                   .replace(/string.*callback/i, 'String callbacks in timers? That\'s just asking for trouble!');
                case 'quality':
                    return baseMessage.replace(/unused variable/i, 'Unused variable') + ' - clean up your code!';
            }
        }
        
        // Detailed, analytical mentors
        if (personality.communicationStyle === 'detailed' && personality.feedbackApproach === 'analytical') {
            switch (context) {
                case 'performance':
                    return baseMessage.replace(/inefficient/i, 'Performance concern: This has O(n²) complexity. Consider Set/Map for O(1) lookups');
                case 'security':
                    return baseMessage.replace(/security risk/i, 'Critical security vulnerability')
                                   .replace(/can lead to/i, 'enables');
                case 'quality':
                    return `Code quality: ${baseMessage.toLowerCase()} should be removed for maintainability`;
            }
        }
        
        // Supportive, encouraging mentors
        if (personality.communicationStyle === 'supportive' && personality.feedbackApproach === 'encouraging') {
            switch (context) {
                case 'performance':
                    return `Consider optimizing: ${baseMessage.toLowerCase()}. This will improve your app's performance!`;
                case 'security':
                    return `Security improvement opportunity: ${baseMessage.toLowerCase()}. Let's make this safer!`;
                case 'quality':
                    return `Code improvement: ${baseMessage.toLowerCase()}. Removing this will make your code cleaner!`;
            }
        }
        
        // Default to base message
        return baseMessage;
    }

    private setupEventListeners() {
        // Listen for document changes to provide immediate diagnostics
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'plaintext') return;
            this.scheduleAnalysis(event.document);
        });

        // Clear diagnostics when document is closed
        vscode.workspace.onDidCloseTextDocument((document) => {
            this.diagnosticCollection.delete(document.uri);
        });
    }

    private scheduleAnalysis(document: vscode.TextDocument) {
        if (!this.isEnabled) return;
        
        // Debounce analysis
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }

        this.analysisTimeout = setTimeout(() => {
            this.analyzeDocument(document);
        }, 500);
    }

    private analyzeDocument(document: vscode.TextDocument) {
        const content = document.getText();
        if (content === this.lastAnalyzedContent) return;
        
        this.lastAnalyzedContent = content;
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Try AST analysis first for JS/TS files
        if (['javascript', 'typescript', 'javascriptreact', 'typescriptreact'].includes(document.languageId)) {
            this.enhanceWithAdvancedAnalysis(content, diagnostics, document);
        } else {
            // Fallback to pattern-based analysis for other languages
            this.performPatternBasedAnalysis(content, diagnostics);
        }
        
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private performPatternBasedAnalysis(content: string, diagnostics: vscode.Diagnostic[]) {
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Check for common security issues
            if (/eval\s*\(/.test(line)) {
                diagnostics.push(this.createDiagnostic(
                    index, line.indexOf('eval'),
                    'Security risk: eval() can execute arbitrary code',
                    vscode.DiagnosticSeverity.Warning,
                    'security'
                ));
            }
        });
    }

    private createDiagnostic(line: number, column: number, message: string, severity: vscode.DiagnosticSeverity, type: string): vscode.Diagnostic {
        const range = new vscode.Range(line, column, line, column + 10);
        const diagnostic = new vscode.Diagnostic(range, message, severity);
        diagnostic.source = 'AST Analyzer';
        diagnostic.code = type;
        return diagnostic;
    }

    private enhanceWithAdvancedAnalysis(content: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        try {
            const activeProfile = this.profileManager.getActiveProfile();
            if (!activeProfile) return;
            
            const focusAreas = activeProfile.personality.focusAreas;
            const expertise = activeProfile.personality.expertise;
            
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx', 'decorators-legacy']
            });

            traverse(ast, {
                // Detect unreachable code (always check - fundamental issue)
                ReturnStatement: (path) => {
                    this.checkUnreachableCode(path, diagnostics);
                },
                
                // Detect unused variables (code quality mentors care about this)
                VariableDeclarator: (path) => {
                    if (focusAreas.includes('code quality') || focusAreas.includes('maintainability')) {
                        this.checkUnusedVariables(path, diagnostics);
                    }
                },
                
                // Performance and security issues based on mentor focus
                CallExpression: (path) => {
                    if (focusAreas.includes('performance') || expertise.includes('performance optimization')) {
                        this.checkPerformanceIssues(path, diagnostics);
                    }
                    if (focusAreas.includes('security') || expertise.includes('security')) {
                        this.checkSecurityVulnerabilities(path, diagnostics);
                    }
                },
                
                // Null pointer dereference detection
                MemberExpression: (path) => {
                    this.checkNullPointerDereference(path, diagnostics);
                }
            });
        } catch (error) {
            console.log('Advanced AST analysis failed:', error);
        }
    }

    private checkUnreachableCode(path: any, diagnostics: vscode.Diagnostic[]) {
        const parent = path.parent;
        if (t.isBlockStatement(parent)) {
            const statements = parent.body;
            const returnIndex = statements.indexOf(path.node);
            
            if (returnIndex < statements.length - 1) {
                const nextStatement = statements[returnIndex + 1];
                const line = nextStatement.loc?.start.line - 1 || 0;
                
                diagnostics.push(this.createDiagnostic(
                    line, 0,
                    'Unreachable code detected after return statement',
                    vscode.DiagnosticSeverity.Warning,
                    'unreachable_code'
                ));
            }
        }
    }

    private checkUnusedVariables(path: any, diagnostics: vscode.Diagnostic[]) {
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile) return;
        
        const node = path.node;
        
        if (t.isVariableDeclarator(node) && t.isIdentifier(node.id)) {
            const varName = node.id.name;
            
            // Simple check - if variable starts with underscore, assume it's intentionally unused
            if (!varName.startsWith('_')) {
                const line = path.node.loc?.start.line - 1 || 0;
                let baseMessage = `Unused variable '${varName}'`;
                
                const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'quality');
                
                diagnostics.push(this.createDiagnostic(
                    line, 0,
                    message,
                    vscode.DiagnosticSeverity.Information,
                    'style'
                ));
            }
        }
    }

    private checkPerformanceIssues(path: any, diagnostics: vscode.Diagnostic[]) {
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile) return;
        
        const callee = path.node.callee;
        const isPerformanceFocused = activeProfile.personality.focusAreas.includes('performance');
        const hasPerformanceExpertise = activeProfile.personality.expertise.includes('performance optimization');
        
        // Detect inefficient array operations in loops
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;
            
            if (['indexOf', 'includes', 'find'].includes(methodName)) {
                // Check if we're in a loop
                let parent = path.parent;
                while (parent) {
                    if (t.isForStatement(parent) || t.isWhileStatement(parent) || t.isDoWhileStatement(parent)) {
                        const line = path.node.loc?.start.line - 1 || 0;
                        
                        let baseMessage = `Inefficient array method '${methodName}' in loop`;
                        let severity = vscode.DiagnosticSeverity.Information;
                        
                        // Customize message and severity based on mentor personality
                        if (isPerformanceFocused || hasPerformanceExpertise) {
                            severity = vscode.DiagnosticSeverity.Warning;
                        }
                        
                        const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'performance');
                        
                        diagnostics.push(this.createDiagnostic(
                            line, 0,
                            message,
                            severity,
                            'performance'
                        ));
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
        
        // Check for synchronous operations that could block (performance mentors care)
        if (t.isIdentifier(callee) && ['readFileSync', 'writeFileSync'].includes(callee.name)) {
            const line = path.node.loc?.start.line - 1 || 0;
            let baseMessage = `Synchronous file operation '${callee.name}' can block the event loop`;
            
            const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'performance');
            
            diagnostics.push(this.createDiagnostic(
                line, 0,
                message,
                vscode.DiagnosticSeverity.Warning,
                'performance'
            ));
        }
    }

    private checkSecurityVulnerabilities(path: any, diagnostics: vscode.Diagnostic[]) {
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile) return;
        
        const callee = path.node.callee;
        
        // Check for eval usage
        if (t.isIdentifier(callee) && callee.name === 'eval') {
            const line = path.node.loc?.start.line - 1 || 0;
            let baseMessage = 'Security risk: eval() can execute arbitrary code';
            
            const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'security');
            
            diagnostics.push(this.createDiagnostic(
                line, 0,
                message,
                vscode.DiagnosticSeverity.Error,
                'security'
            ));
        }
        
        // Check for innerHTML usage
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property) && callee.property.name === 'innerHTML') {
            const line = path.node.loc?.start.line - 1 || 0;
            let baseMessage = 'Security risk: innerHTML can lead to XSS attacks';
            
            const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'security');
            
            diagnostics.push(this.createDiagnostic(
                line, 0,
                message,
                vscode.DiagnosticSeverity.Warning,
                'security'
            ));
        }
        
        // Check for setTimeout/setInterval usage with string callback
        if (t.isIdentifier(callee) && ['setTimeout', 'setInterval'].includes(callee.name)) {
            const line = path.node.loc?.start.line - 1 || 0;
            if (path.node.arguments[0] && t.isStringLiteral(path.node.arguments[0])) {
                let baseMessage = 'Security risk: Using string as timer callback can lead to code injection';
                
                const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'security');
                
                diagnostics.push(this.createDiagnostic(
                    line, 0,
                    message,
                    vscode.DiagnosticSeverity.Warning,
                    'security'
                ));
            }
        }
    }

    private checkNullPointerDereference(path: any, diagnostics: vscode.Diagnostic[]) {
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile) return;
        
        const node = path.node;
        const object = node.object;
        
        // Check for direct null/undefined access
        if (t.isNullLiteral(object) || (t.isIdentifier(object) && object.name === 'undefined')) {
            const line = node.loc?.start.line - 1 || 0;
            let baseMessage = `Null pointer dereference: Cannot access property of ${t.isNullLiteral(object) ? 'null' : 'undefined'}`;
            
            const message = this.getMentorMessageStyle(activeProfile, baseMessage, 'quality');
            
            diagnostics.push(this.createDiagnostic(
                line, 0,
                message,
                vscode.DiagnosticSeverity.Error,
                'null_pointer'
            ));
            return;
        }
        
        // Check for potentially null variables (simple heuristic)
        if (t.isIdentifier(object)) {
            const varName = object.name;
            
            // Check if this variable was assigned from a potentially null-returning function
            let currentPath = path;
            while (currentPath && currentPath.scope) {
                const binding = currentPath.scope.getBinding(varName);
                if (binding && binding.path && binding.path.isVariableDeclarator()) {
                    const init = binding.path.node.init;
                    if (init && t.isCallExpression(init)) {
                        const callee = init.callee;
                        let calleeString = '';
                        
                        if (t.isMemberExpression(callee)) {
                            if (t.isIdentifier(callee.property)) {
                                calleeString = callee.property.name;
                            }
                        } else if (t.isIdentifier(callee)) {
                            calleeString = callee.name;
                        }
                        
        
                    }
                    break;
                }
                currentPath = currentPath.parentPath;
            }
        }
    }
    
    private hasNullCheckBefore(memberPath: any, varName: string): boolean {
        // Look for null checks in the same block before this member access
        let currentPath = memberPath.parentPath;
        
        while (currentPath) {
            if (t.isBlockStatement(currentPath.node)) {
                const statements = currentPath.node.body;
                const memberStatement = this.findStatementContaining(statements, memberPath.node);
                
                if (memberStatement !== -1) {
                    // Check previous statements for null checks
                    for (let i = 0; i < memberStatement; i++) {
                        const stmt = statements[i];
                        if (this.containsNullCheck(stmt, varName)) {
                            return true;
                        }
                    }
                }
                break;
            }
            currentPath = currentPath.parentPath;
        }
        
        return false;
    }
    
    private findStatementContaining(statements: any[], targetNode: any): number {
        for (let i = 0; i < statements.length; i++) {
            if (this.nodeContains(statements[i], targetNode)) {
                return i;
            }
        }
        return -1;
    }
    
    private nodeContains(container: any, target: any): boolean {
        if (container === target) return true;
        
        // Simple traversal to check if target is contained in container
        if (container && typeof container === 'object') {
            for (const key in container) {
                if (container[key] && typeof container[key] === 'object') {
                    if (this.nodeContains(container[key], target)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    private containsNullCheck(statement: any, varName: string): boolean {
        // Look for patterns like: if (varName), if (varName != null), if (varName !== null), etc.
        if (t.isIfStatement(statement)) {
            const test = statement.test;
            
            // Direct variable check: if (varName)
            if (t.isIdentifier(test) && test.name === varName) {
                return true;
            }
            
            // Binary expression checks: if (varName != null), if (varName !== null), etc.
            if (t.isBinaryExpression(test)) {
                const left = test.left;
                const right = test.right;
                
                if (t.isIdentifier(left) && left.name === varName) {
                    if (t.isNullLiteral(right) || (t.isIdentifier(right) && right.name === 'undefined')) {
                        return ['!=', '!=='].includes(test.operator);
                    }
                }
            }
            
            // Logical expressions: if (varName && ...)
            if (t.isLogicalExpression(test) && test.operator === '&&') {
                if (t.isIdentifier(test.left) && test.left.name === varName) {
                    return true;
                }
            }
        }
        
        return false;
    }

    public activate() {
        this.isEnabled = true;
        console.log('🔍 RealtimeAnalyzer activated for diagnostics');
    }

    public deactivate() {
        this.isEnabled = false;
        this.diagnosticCollection.clear();
        console.log('🔍 RealtimeAnalyzer deactivated');
    }

    public dispose() {
        this.isEnabled = false;
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
        console.log('🔍 RealtimeAnalyzer disposed');
    }
}
