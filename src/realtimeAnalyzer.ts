import * as vscode from 'vscode';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { ProfileManager } from './profileManager';

export interface MentorDiagnostic {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    type: 'infinite_loop' | 'missing_increment' | 'security' | 'performance' | 'style';
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

    private async analyzeDocument(document: vscode.TextDocument) {
        const content = document.getText();
        if (!content.trim() || content === this.lastAnalyzedContent) return;
        
        this.lastAnalyzedContent = content;
        const diagnostics: vscode.Diagnostic[] = [];
        
        try {
            // Parse JavaScript/TypeScript code for AST analysis
            if (document.languageId === 'javascript' || document.languageId === 'typescript') {
                this.analyzeWithAST(content, diagnostics, document);
            } else {
                // Pattern-based analysis for other languages
                this.analyzeWithPatterns(content, diagnostics, document);
            }
            
            // Run advanced AST analysis for comprehensive error detection
            this.enhanceWithAdvancedAnalysis(content, diagnostics, document);
            
            this.diagnosticCollection.set(document.uri, diagnostics);
            
            console.log(` RealtimeAnalyzer found ${diagnostics.length} issues in ${document.fileName}`);
            
        } catch (error) {
            console.error('RealtimeAnalyzer error:', error);
        }
    }

    private analyzeWithAST(content: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        try {
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx', 'decorators-legacy']
            });

            traverse(ast, {
                WhileStatement: (path) => {
                    this.checkWhileLoop(path, diagnostics);
                },
                ForStatement: (path) => {
                    this.checkForLoop(path, diagnostics);
                }
            });
        } catch (error) {
            console.log('AST parsing failed, falling back to pattern analysis');
            this.analyzeWithPatterns(content, diagnostics, document);
        }
    }

    private checkWhileLoop(path: any, diagnostics: vscode.Diagnostic[]) {
        const node = path.node;
        const line = node.loc?.start.line - 1 || 0;
        
        // Check for while(true) loops
        if (t.isBooleanLiteral(node.test) && node.test.value === true) {
            const hasBreak = this.hasBreakStatement(path);
            if (!hasBreak) {
                diagnostics.push(this.createDiagnostic(
                    line, 0, 
                    'Potential infinite loop: while(true) without break statement',
                    vscode.DiagnosticSeverity.Error,
                    'infinite_loop'
                ));
            }
        }
        
        // Check for missing increments in while loops
        if (t.isIdentifier(node.test) || (t.isBinaryExpression(node.test) && t.isIdentifier(node.test.left))) {
            const hasIncrement = this.hasIncrementOrAssignment(path);
            const hasBreak = this.hasBreakStatement(path);
            
            if (!hasIncrement && !hasBreak) {
                diagnostics.push(this.createDiagnostic(
                    line, 0,
                    'Potential infinite loop: missing increment or break statement',
                    vscode.DiagnosticSeverity.Warning,
                    'missing_increment'
                ));
            }
        }
    }

    private checkForLoop(path: any, diagnostics: vscode.Diagnostic[]) {
        const node = path.node;
        const line = node.loc?.start.line - 1 || 0;
        
        // Check for missing increment in for loops
        if (!node.update && !this.hasBreakStatement(path)) {
            diagnostics.push(this.createDiagnostic(
                line, 0,
                'For loop missing increment expression',
                vscode.DiagnosticSeverity.Warning,
                'missing_increment'
            ));
        }
    }

    private hasBreakStatement(path: any): boolean {
        let hasBreak = false;
        
        traverse(path.node.body, {
            BreakStatement: () => {
                hasBreak = true;
            }
        }, path.scope, path);
        
        return hasBreak;
    }

    private hasIncrementOrAssignment(path: any): boolean {
        let hasIncrement = false;
        
        traverse(path.node.body, {
            UpdateExpression: () => {
                hasIncrement = true;
            },
            AssignmentExpression: () => {
                hasIncrement = true;
            }
        }, path.scope, path);
        
        return hasIncrement;
    }

    private analyzeWithPatterns(content: string, diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            // Check for infinite loop patterns
            if (/while\s*\(\s*true\s*\)/.test(line) && !content.includes('break')) {
                diagnostics.push(this.createDiagnostic(
                    index, 0,
                    'Potential infinite loop: while(true) without break',
                    vscode.DiagnosticSeverity.Error,
                    'infinite_loop'
                ));
            }
            
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
        // Advanced AST-based analysis for complex patterns
        try {
            const ast = parser.parse(content, {
                sourceType: 'module',
                plugins: ['typescript', 'jsx', 'decorators-legacy']
            });

            traverse(ast, {
                // Detect unreachable code
                ReturnStatement: (path) => {
                    this.checkUnreachableCode(path, diagnostics);
                },
                
                // Detect variable shadowing
                VariableDeclarator: (path) => {
                    this.checkVariableShadowing(path, diagnostics);
                },
                
                // Detect unused variables
                Identifier: (path) => {
                    this.checkUnusedVariables(path, diagnostics);
                },
                
                // Detect potential null pointer exceptions
                MemberExpression: (path) => {
                    this.checkNullPointerAccess(path, diagnostics);
                },
                
                // Detect performance and security issues
                CallExpression: (path) => {
                    this.checkPerformanceIssues(path, diagnostics);
                    this.checkSecurityVulnerabilities(path, diagnostics);
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

    private checkVariableShadowing(path: any, diagnostics: vscode.Diagnostic[]) {
        const name = path.node.id?.name;
        if (!name) return;
        
        let currentScope = path.scope.parent;
        while (currentScope) {
            if (currentScope.hasOwnBinding(name)) {
                const line = path.node.loc?.start.line - 1 || 0;
                diagnostics.push(this.createDiagnostic(
                    line, 0,
                    `Variable '${name}' shadows outer scope variable`,
                    vscode.DiagnosticSeverity.Warning,
                    'variable_shadowing'
                ));
                break;
            }
            currentScope = currentScope.parent;
        }
    }

    private checkUnusedVariables(path: any, diagnostics: vscode.Diagnostic[]) {
        if (path.isReferencedIdentifier()) return;
        
        const binding = path.scope.getBinding(path.node.name);
        if (binding && binding.referenced === false && binding.kind === 'var') {
            const line = binding.path.node.loc?.start.line - 1 || 0;
            diagnostics.push(this.createDiagnostic(
                line, 0,
                `Unused variable '${path.node.name}'`,
                vscode.DiagnosticSeverity.Information,
                'unused_variable'
            ));
        }
    }

    private checkNullPointerAccess(path: any, diagnostics: vscode.Diagnostic[]) {
        const object = path.node.object;
        
        // Check for potential null/undefined access
        if (t.isIdentifier(object)) {
            const binding = path.scope.getBinding(object.name);
            if (binding) {
                // Simple heuristic: check if variable might be null
                const line = path.node.loc?.start.line - 1 || 0;
                // This is a simplified check - in practice, you'd want more sophisticated analysis
            }
        }
    }

    private checkPerformanceIssues(path: any, diagnostics: vscode.Diagnostic[]) {
        const callee = path.node.callee;
        
        // Detect inefficient array operations in loops
        if (t.isMemberExpression(callee) && t.isIdentifier(callee.property)) {
            const methodName = callee.property.name;
            
            if (['indexOf', 'includes', 'find'].includes(methodName)) {
                // Check if we're in a loop
                let parent = path.parent;
                while (parent) {
                    if (t.isForStatement(parent) || t.isWhileStatement(parent) || t.isDoWhileStatement(parent)) {
                        const line = path.node.loc?.start.line - 1 || 0;
                        diagnostics.push(this.createDiagnostic(
                            line, 0,
                            `Inefficient array method '${methodName}' in loop - consider using Set or Map`,
                            vscode.DiagnosticSeverity.Information,
                            'performance'
                        ));
                        break;
                    }
                    parent = parent.parent;
                }
            }
        }
    }

    private checkSecurityVulnerabilities(path: any, diagnostics: vscode.Diagnostic[]) {
        const callee = path.node.callee;
        
        if (t.isIdentifier(callee)) {
            const functionName = callee.name;
            const line = path.node.loc?.start.line - 1 || 0;
            
            // Detect dangerous functions
            switch (functionName) {
                case 'eval':
                    diagnostics.push(this.createDiagnostic(
                        line, 0,
                        'Security risk: eval() can execute arbitrary code',
                        vscode.DiagnosticSeverity.Error,
                        'security'
                    ));
                    break;
                    
                case 'setTimeout':
                case 'setInterval':
                    // Check if first argument is a string (code injection risk)
                    if (path.node.arguments[0] && t.isStringLiteral(path.node.arguments[0])) {
                        diagnostics.push(this.createDiagnostic(
                            line, 0,
                            'Security risk: Using string as timer callback can lead to code injection',
                            vscode.DiagnosticSeverity.Warning,
                            'security'
                        ));
                    }
                    break;
            }
        }
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
        this.diagnosticCollection.dispose();
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
    }
}
