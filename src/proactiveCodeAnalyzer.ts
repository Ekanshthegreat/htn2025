import * as vscode from 'vscode';
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ProactiveIssue {
    type: 'bug_risk' | 'performance' | 'security' | 'maintainability' | 'logic_error';
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    line: number;
    column: number;
    suggestion: string;
    confidence: number; // 0-1
    codePattern: string;
    quickFix?: string;
}

export interface CodeFlowNode {
    id: string;
    type: 'function' | 'condition' | 'loop' | 'assignment' | 'call';
    name: string;
    line: number;
    dependencies: string[];
    affects: string[];
    complexity: number;
}

export interface DataDependency {
    variable: string;
    definedAt: number[];
    usedAt: number[];
    mutatedAt: number[];
    scope: 'global' | 'function' | 'block';
    potentialIssues: string[];
}

export interface ControlFlowPath {
    path: CodeFlowNode[];
    conditions: string[];
    complexity: number;
    potentialDeadCode: boolean;
    unreachableCode: number[];
}

export class ProactiveCodeAnalyzer {
    private issuePatterns: Map<string, RegExp[]>;
    private securityPatterns: Map<string, RegExp[]>;
    private performancePatterns: Map<string, RegExp[]>;

    constructor() {
        this.initializePatterns();
    }

    private initializePatterns(): void {
        // Bug risk patterns
        this.issuePatterns = new Map([
            ['null_dereference', [
                /\w+\.\w+(?!\s*[?.])/g, // obj.prop without null check
                /\w+\[\w+\](?!\s*[?.])/g // obj[key] without null check
            ]],
            ['async_await_missing', [
                /(?:fetch|axios|http)\s*\([^)]*\)(?!\s*\.then)(?!\s*await)/g,
                /Promise\s*\([^)]*\)(?!\s*\.then)(?!\s*await)/g
            ]],
            ['memory_leak', [
                /addEventListener\s*\([^)]*\)(?![\s\S]*removeEventListener)/g,
                /setInterval\s*\([^)]*\)(?![\s\S]*clearInterval)/g,
                /setTimeout\s*\([^)]*\)(?![\s\S]*clearTimeout)/g
            ]],
            ['infinite_loop_risk', [
                /while\s*\(\s*true\s*\)(?![\s\S]*break)/g,
                /for\s*\([^;]*;\s*true\s*;[^)]*\)(?![\s\S]*break)/g
            ]]
        ]);

        // Security vulnerability patterns
        this.securityPatterns = new Map([
            ['xss_risk', [
                /innerHTML\s*=\s*[^;]*\+/g,
                /document\.write\s*\(/g,
                /eval\s*\(/g
            ]],
            ['sql_injection', [
                /SELECT\s+.*\+.*FROM/gi,
                /INSERT\s+.*\+.*VALUES/gi,
                /UPDATE\s+.*\+.*SET/gi
            ]],
            ['hardcoded_secrets', [
                /(?:password|secret|key|token)\s*[:=]\s*["'][^"']+["']/gi,
                /api[_-]?key\s*[:=]\s*["'][^"']+["']/gi
            ]]
        ]);

        // Performance issue patterns
        this.performancePatterns = new Map([
            ['nested_loops', [
                /for\s*\([^)]*\)\s*{[^}]*for\s*\([^)]*\)/g,
                /while\s*\([^)]*\)\s*{[^}]*while\s*\([^)]*\)/g
            ]],
            ['inefficient_dom', [
                /document\.getElementById\s*\([^)]*\)(?=[\s\S]*document\.getElementById)/g,
                /querySelector\s*\([^)]*\)(?=[\s\S]*querySelector)/g
            ]],
            ['synchronous_operations', [
                /fs\.readFileSync/g,
                /fs\.writeFileSync/g,
                /JSON\.parse\s*\(\s*fs\.readFileSync/g
            ]]
        ]);
    }

    async analyzeCodeProactively(code: string, language: string): Promise<{
        issues: ProactiveIssue[];
        codeFlow: CodeFlowNode[];
        dataDependencies: DataDependency[];
        controlFlowPaths: ControlFlowPath[];
        complexity: number;
    }> {
        const issues: ProactiveIssue[] = [];
        const codeFlow: CodeFlowNode[] = [];
        const dataDependencies: DataDependency[] = [];
        const controlFlowPaths: ControlFlowPath[] = [];

        // Pattern-based analysis for immediate feedback
        issues.push(...this.detectPatternBasedIssues(code, language));

        // AST-based deep analysis
        if (language === 'javascript' || language === 'typescript') {
            const astAnalysis = await this.analyzeJavaScriptAST(code, language === 'typescript');
            issues.push(...astAnalysis.issues);
            codeFlow.push(...astAnalysis.codeFlow);
            dataDependencies.push(...astAnalysis.dataDependencies);
            controlFlowPaths.push(...astAnalysis.controlFlowPaths);
        }

        const complexity = this.calculateComplexity(codeFlow, controlFlowPaths);

        return {
            issues,
            codeFlow,
            dataDependencies,
            controlFlowPaths,
            complexity
        };
    }

    private detectPatternBasedIssues(code: string, language: string): ProactiveIssue[] {
        const issues: ProactiveIssue[] = [];
        const lines = code.split('\n');

        // Check bug risk patterns
        for (const [patternName, regexes] of this.issuePatterns) {
            for (const regex of regexes) {
                let match;
                while ((match = regex.exec(code)) !== null) {
                    const lineNumber = this.getLineNumber(code, match.index);
                    issues.push({
                        type: 'bug_risk',
                        severity: this.getSeverityForPattern(patternName),
                        message: this.getMessageForPattern(patternName, match[0]),
                        line: lineNumber,
                        column: match.index - this.getLineStart(code, match.index),
                        suggestion: this.getSuggestionForPattern(patternName),
                        confidence: 0.8,
                        codePattern: match[0],
                        quickFix: this.getQuickFixForPattern(patternName, match[0])
                    });
                }
            }
        }

        // Check security patterns
        for (const [patternName, regexes] of this.securityPatterns) {
            for (const regex of regexes) {
                let match;
                while ((match = regex.exec(code)) !== null) {
                    const lineNumber = this.getLineNumber(code, match.index);
                    issues.push({
                        type: 'security',
                        severity: 'high',
                        message: this.getSecurityMessage(patternName, match[0]),
                        line: lineNumber,
                        column: match.index - this.getLineStart(code, match.index),
                        suggestion: this.getSecuritySuggestion(patternName),
                        confidence: 0.9,
                        codePattern: match[0]
                    });
                }
            }
        }

        // Check performance patterns
        for (const [patternName, regexes] of this.performancePatterns) {
            for (const regex of regexes) {
                let match;
                while ((match = regex.exec(code)) !== null) {
                    const lineNumber = this.getLineNumber(code, match.index);
                    issues.push({
                        type: 'performance',
                        severity: 'medium',
                        message: this.getPerformanceMessage(patternName, match[0]),
                        line: lineNumber,
                        column: match.index - this.getLineStart(code, match.index),
                        suggestion: this.getPerformanceSuggestion(patternName),
                        confidence: 0.7,
                        codePattern: match[0]
                    });
                }
            }
        }

        return issues;
    }

    private async analyzeJavaScriptAST(code: string, isTypeScript: boolean): Promise<{
        issues: ProactiveIssue[];
        codeFlow: CodeFlowNode[];
        dataDependencies: DataDependency[];
        controlFlowPaths: ControlFlowPath[];
    }> {
        const issues: ProactiveIssue[] = [];
        const codeFlow: CodeFlowNode[] = [];
        const dataDependencies: DataDependency[] = [];
        const controlFlowPaths: ControlFlowPath[] = [];

        try {
            const ast = babel.parse(code, {
                sourceType: 'module',
                plugins: isTypeScript ? ['typescript'] : ['jsx'],
                errorRecovery: true
            });

            const variableTracker = new Map<string, DataDependency>();
            const functionCalls = new Map<string, CodeFlowNode>();

            traverse(ast, {
                FunctionDeclaration: (path) => {
                    const node = path.node;
                    const flowNode: CodeFlowNode = {
                        id: `func_${node.id?.name || 'anonymous'}`,
                        type: 'function',
                        name: node.id?.name || 'anonymous',
                        line: node.loc?.start.line || 0,
                        dependencies: [],
                        affects: [],
                        complexity: this.calculateFunctionComplexity(path)
                    };
                    codeFlow.push(flowNode);
                    functionCalls.set(flowNode.name, flowNode);

                    // Check for potential issues in function
                    this.analyzeFunctionForIssues(path, issues);
                },

                VariableDeclarator: (path) => {
                    const node = path.node;
                    if (t.isIdentifier(node.id)) {
                        const varName = node.id.name;
                        const line = node.loc?.start.line || 0;
                        
                        if (!variableTracker.has(varName)) {
                            variableTracker.set(varName, {
                                variable: varName,
                                definedAt: [line],
                                usedAt: [],
                                mutatedAt: [],
                                scope: this.getScope(path),
                                potentialIssues: []
                            });
                        } else {
                            variableTracker.get(varName)!.definedAt.push(line);
                        }

                        // Check for potential variable issues
                        this.analyzeVariableForIssues(path, issues, varName);
                    }
                },

                Identifier: (path) => {
                    const name = path.node.name;
                    const line = path.node.loc?.start.line || 0;
                    
                    if (variableTracker.has(name) && !path.isVariableDeclarator()) {
                        const dependency = variableTracker.get(name)!;
                        if (path.isAssignmentExpression() && path.node.left === path.node) {
                            dependency.mutatedAt.push(line);
                        } else {
                            dependency.usedAt.push(line);
                        }
                    }
                },

                IfStatement: (path) => {
                    const node = path.node;
                    const flowNode: CodeFlowNode = {
                        id: `if_${node.loc?.start.line}`,
                        type: 'condition',
                        name: 'if statement',
                        line: node.loc?.start.line || 0,
                        dependencies: [],
                        affects: [],
                        complexity: 1
                    };
                    codeFlow.push(flowNode);

                    // Analyze condition for potential issues
                    this.analyzeConditionForIssues(path, issues);
                },

                Loop: (path) => {
                    const node = path.node;
                    const flowNode: CodeFlowNode = {
                        id: `loop_${node.loc?.start.line}`,
                        type: 'loop',
                        name: `${node.type.toLowerCase()}`,
                        line: node.loc?.start.line || 0,
                        dependencies: [],
                        affects: [],
                        complexity: 2
                    };
                    codeFlow.push(flowNode);

                    // Check for infinite loop risks
                    this.analyzeLoopForIssues(path, issues);
                },

                CallExpression: (path) => {
                    const node = path.node;
                    let functionName = 'unknown';
                    
                    if (t.isIdentifier(node.callee)) {
                        functionName = node.callee.name;
                    } else if (t.isMemberExpression(node.callee) && t.isIdentifier(node.callee.property)) {
                        functionName = node.callee.property.name;
                    }

                    const flowNode: CodeFlowNode = {
                        id: `call_${functionName}_${node.loc?.start.line}`,
                        type: 'call',
                        name: functionName,
                        line: node.loc?.start.line || 0,
                        dependencies: [],
                        affects: [],
                        complexity: 1
                    };
                    codeFlow.push(flowNode);

                    // Check for async/await issues
                    this.analyzeCallForIssues(path, issues);
                }
            });

            // Convert variable tracker to data dependencies
            dataDependencies.push(...Array.from(variableTracker.values()));

            // Build control flow paths
            controlFlowPaths.push(...this.buildControlFlowPaths(codeFlow));

        } catch (error) {
            console.error('AST analysis error:', error);
            issues.push({
                type: 'bug_risk',
                severity: 'high',
                message: 'Syntax error detected - code may not execute properly',
                line: 1,
                column: 0,
                suggestion: 'Fix syntax errors before proceeding',
                confidence: 1.0,
                codePattern: 'syntax_error'
            });
        }

        return { issues, codeFlow, dataDependencies, controlFlowPaths };
    }

    private analyzeFunctionForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const functionName = node.id?.name || 'anonymous';
        const line = node.loc?.start.line || 0;

        // Check function length
        const bodyLength = node.body.body?.length || 0;
        if (bodyLength > 20) {
            issues.push({
                type: 'maintainability',
                severity: 'medium',
                message: `Function '${functionName}' is too long (${bodyLength} statements)`,
                line,
                column: 0,
                suggestion: 'Consider breaking this function into smaller, more focused functions',
                confidence: 0.8,
                codePattern: 'long_function'
            });
        }

        // Check parameter count
        const paramCount = node.params?.length || 0;
        if (paramCount > 5) {
            issues.push({
                type: 'maintainability',
                severity: 'medium',
                message: `Function '${functionName}' has too many parameters (${paramCount})`,
                line,
                column: 0,
                suggestion: 'Consider using an options object or breaking the function down',
                confidence: 0.7,
                codePattern: 'too_many_params'
            });
        }
    }

    private analyzeVariableForIssues(path: any, issues: ProactiveIssue[], varName: string): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;

        // Check for unused variables (basic check)
        if (node.init === null) {
            issues.push({
                type: 'maintainability',
                severity: 'low',
                message: `Variable '${varName}' declared but not initialized`,
                line,
                column: 0,
                suggestion: 'Initialize the variable or remove if unused',
                confidence: 0.6,
                codePattern: 'uninitialized_var'
            });
        }
    }

    private analyzeConditionForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;

        // Check for assignment in condition
        if (t.isAssignmentExpression(node.test)) {
            issues.push({
                type: 'bug_risk',
                severity: 'high',
                message: 'Assignment in condition - did you mean to use == or ===?',
                line,
                column: 0,
                suggestion: 'Use comparison operators (==, ===) instead of assignment (=)',
                confidence: 0.9,
                codePattern: 'assignment_in_condition',
                quickFix: 'Replace = with === for comparison'
            });
        }
    }

    private analyzeLoopForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;

        // Check for potential infinite loops
        if (t.isWhileStatement(node) && t.isBooleanLiteral(node.test) && node.test.value === true) {
            issues.push({
                type: 'bug_risk',
                severity: 'critical',
                message: 'Potential infinite loop detected',
                line,
                column: 0,
                suggestion: 'Ensure there is a break statement or modify the condition',
                confidence: 0.9,
                codePattern: 'infinite_loop'
            });
        }
    }

    private analyzeCallForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;

        // Check for missing await on async calls
        if (t.isIdentifier(node.callee) && ['fetch', 'axios'].includes(node.callee.name)) {
            const parent = path.parent;
            if (!t.isAwaitExpression(parent) && !t.isCallExpression(parent)) {
                issues.push({
                    type: 'bug_risk',
                    severity: 'high',
                    message: 'Async function call without await or .then()',
                    line,
                    column: 0,
                    suggestion: 'Add await keyword or use .then() to handle the promise',
                    confidence: 0.8,
                    codePattern: 'missing_await',
                    quickFix: `await ${node.callee.name}(...)`
                });
            }
        }
    }

    private calculateFunctionComplexity(path: any): number {
        let complexity = 1; // Base complexity
        
        path.traverse({
            IfStatement: () => { complexity++; },
            ConditionalExpression: () => { complexity++; },
            LogicalExpression: () => { complexity++; },
            SwitchCase: () => { complexity++; },
            ForStatement: () => { complexity++; },
            WhileStatement: () => { complexity++; },
            DoWhileStatement: () => { complexity++; },
            CatchClause: () => { complexity++; }
        });

        return complexity;
    }

    private getScope(path: any): 'global' | 'function' | 'block' {
        if (path.scope.path.isProgram()) return 'global';
        if (path.scope.path.isFunction()) return 'function';
        return 'block';
    }

    private buildControlFlowPaths(codeFlow: CodeFlowNode[]): ControlFlowPath[] {
        // Simplified control flow path building
        const paths: ControlFlowPath[] = [];
        
        const functions = codeFlow.filter(node => node.type === 'function');
        for (const func of functions) {
            const relatedNodes = codeFlow.filter(node => 
                node.line >= func.line && 
                (codeFlow.find(f => f.type === 'function' && f.line > func.line)?.line || Infinity) > node.line
            );

            paths.push({
                path: relatedNodes,
                conditions: relatedNodes.filter(n => n.type === 'condition').map(n => n.name),
                complexity: relatedNodes.reduce((sum, n) => sum + n.complexity, 0),
                potentialDeadCode: false,
                unreachableCode: []
            });
        }

        return paths;
    }

    private calculateComplexity(codeFlow: CodeFlowNode[], controlFlowPaths: ControlFlowPath[]): number {
        const baseComplexity = codeFlow.reduce((sum, node) => sum + node.complexity, 0);
        const pathComplexity = controlFlowPaths.reduce((sum, path) => sum + path.complexity, 0);
        return Math.max(baseComplexity, pathComplexity);
    }

    // Helper methods for pattern matching
    private getLineNumber(code: string, index: number): number {
        return code.substring(0, index).split('\n').length;
    }

    private getLineStart(code: string, index: number): number {
        const beforeIndex = code.substring(0, index);
        const lastNewline = beforeIndex.lastIndexOf('\n');
        return lastNewline === -1 ? 0 : lastNewline + 1;
    }

    private getSeverityForPattern(patternName: string): 'critical' | 'high' | 'medium' | 'low' {
        const severityMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
            'null_dereference': 'high',
            'async_await_missing': 'medium',
            'memory_leak': 'high',
            'infinite_loop_risk': 'critical'
        };
        return severityMap[patternName] || 'medium';
    }

    private getMessageForPattern(patternName: string, match: string): string {
        const messages: Record<string, string> = {
            'null_dereference': `Potential null/undefined access: ${match}`,
            'async_await_missing': `Missing await/then for async operation: ${match}`,
            'memory_leak': `Potential memory leak: ${match}`,
            'infinite_loop_risk': `Infinite loop risk detected: ${match}`
        };
        return messages[patternName] || `Code pattern detected: ${match}`;
    }

    private getSuggestionForPattern(patternName: string): string {
        const suggestions: Record<string, string> = {
            'null_dereference': 'Add null/undefined checks before accessing properties',
            'async_await_missing': 'Use await keyword or .then() to handle promises properly',
            'memory_leak': 'Add cleanup code to remove event listeners and clear timers',
            'infinite_loop_risk': 'Add break conditions or modify loop termination logic'
        };
        return suggestions[patternName] || 'Review this code pattern for potential issues';
    }

    private getQuickFixForPattern(patternName: string, match: string): string | undefined {
        const quickFixes: Record<string, string> = {
            'null_dereference': `${match}?.`,
            'async_await_missing': `await ${match}`
        };
        return quickFixes[patternName];
    }

    private getSecurityMessage(patternName: string, match: string): string {
        const messages: Record<string, string> = {
            'xss_risk': `XSS vulnerability detected: ${match}`,
            'sql_injection': `SQL injection risk: ${match}`,
            'hardcoded_secrets': `Hardcoded secret detected: ${match}`
        };
        return messages[patternName] || `Security issue: ${match}`;
    }

    private getSecuritySuggestion(patternName: string): string {
        const suggestions: Record<string, string> = {
            'xss_risk': 'Use textContent instead of innerHTML, or sanitize input',
            'sql_injection': 'Use parameterized queries or prepared statements',
            'hardcoded_secrets': 'Move secrets to environment variables or secure storage'
        };
        return suggestions[patternName] || 'Review for security implications';
    }

    private getPerformanceMessage(patternName: string, match: string): string {
        const messages: Record<string, string> = {
            'nested_loops': `Performance concern - nested loops: ${match}`,
            'inefficient_dom': `DOM query inefficiency: ${match}`,
            'synchronous_operations': `Blocking operation: ${match}`
        };
        return messages[patternName] || `Performance issue: ${match}`;
    }

    private getPerformanceSuggestion(patternName: string): string {
        const suggestions: Record<string, string> = {
            'nested_loops': 'Consider algorithm optimization or data structure changes',
            'inefficient_dom': 'Cache DOM queries or use more efficient selectors',
            'synchronous_operations': 'Use async alternatives for better performance'
        };
        return suggestions[patternName] || 'Optimize for better performance';
    }
}
