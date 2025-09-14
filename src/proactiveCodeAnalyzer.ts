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

export interface ProactiveAnalysisResult {
    issues: ProactiveIssue[];
    codeFlow: CodeFlowNode[];
    dataDependencies: DataDependency[];
    controlFlowPaths: ControlFlowPath[];
    complexity: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
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

    async analyzeCodeProactively(code: string, language: string): Promise<ProactiveAnalysisResult> {
        const issues: ProactiveIssue[] = [];
        let codeFlow: CodeFlowNode[] = [];
        let dataDependencies: DataDependency[] = [];
        let controlFlowPaths: ControlFlowPath[] = [];

        console.log(`🔍 ProactiveCodeAnalyzer: Starting analysis for ${language}, code length: ${code.length}`);

        try {
            // Pattern-based analysis for immediate feedback
            const patternIssues = this.detectPatternBasedIssues(code, language);
            issues.push(...patternIssues);
            console.log(`🔍 Pattern-based issues found: ${patternIssues.length}`);

            // AST-based analysis for deeper insights
            if (language === 'javascript' || language === 'typescript') {
                console.log(`🌳 Starting AST analysis for ${language}...`);
                const astResult = await this.analyzeJavaScriptAST(code, language === 'typescript');
                issues.push(...astResult.issues);
                codeFlow = astResult.codeFlow;
                dataDependencies = astResult.dataDependencies;
                controlFlowPaths = astResult.controlFlowPaths;
                console.log(`🌳 AST analysis complete: ${astResult.issues.length} issues, ${codeFlow.length} flow nodes`);
            }

            console.log(`🔍 Total issues found: ${issues.length}`);
            return {
                issues,
                codeFlow,
                dataDependencies,
                controlFlowPaths,
                complexity: this.calculateComplexity(issues, codeFlow),
                priority: this.calculatePriority(issues)
            };
        } catch (error) {
            console.error('❌ Error in proactive analysis:', error);
            return {
                issues: [],
                codeFlow: [],
                dataDependencies: [],
                controlFlowPaths: [],
                complexity: 0,
                priority: 'low'
            };
        }
    }

    private detectPatternBasedIssues(code: string, language: string): ProactiveIssue[] {
        const issues: ProactiveIssue[] = [];

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

                WhileStatement: (path) => {
                    const node = path.node;
                    const flowNode: CodeFlowNode = {
                        id: `while_${node.loc?.start.line}`,
                        type: 'loop',
                        name: 'while loop',
                        line: node.loc?.start.line || 0,
                        dependencies: [],
                        affects: [],
                        complexity: 2
                    };
                    codeFlow.push(flowNode);

                    // Check for infinite loop risks
                    this.analyzeLoopForIssues(path, issues);
                },

                ForStatement: (path) => {
                    const node = path.node;
                    const flowNode: CodeFlowNode = {
                        id: `for_${node.loc?.start.line}`,
                        type: 'loop',
                        name: 'for loop',
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

                    // Analyze function call for potential issues
                    this.analyzeCallForIssues(path, issues);
                }
            });

            // Convert variable tracker to data dependencies
            for (const dependency of variableTracker.values()) {
                dataDependencies.push(dependency);
            }

            console.log(`🌳 AST traversal complete: found ${codeFlow.length} flow nodes, ${dataDependencies.length} dependencies`);

        } catch (error) {
            console.error('❌ Error parsing AST:', error);
        }

        return {
            issues,
            codeFlow,
            dataDependencies,
            controlFlowPaths
        };
    }

    private analyzeLoopForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;
        console.log(`🔍 Analyzing loop at line ${line}, type: ${node.type}`);

        if (t.isWhileStatement(node) && t.isBooleanLiteral(node.test) && node.test.value === true) {
            console.log(`🚨 Found while(true) loop at line ${line}`);
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

        if (t.isWhileStatement(node)) {
            const bodyHasIncrement = this.checkForLoopIncrement(path);
            const bodyHasBreak = this.checkForBreakStatement(path);
            console.log(`🔍 While loop analysis: hasIncrement=${bodyHasIncrement}, hasBreak=${bodyHasBreak}`);

            if (!bodyHasIncrement && !bodyHasBreak) {
                console.log(`🚨 Found infinite loop pattern at line ${line} - missing increment/break`);
                issues.push({
                    type: 'bug_risk',
                    severity: 'critical',
                    message: 'Potential infinite loop: missing increment or break statement',
                    line,
                    column: 0,
                    suggestion: 'Add increment statement (i++) or break condition to prevent infinite loop',
                    confidence: 0.85,
                    codePattern: 'missing_loop_increment'
                });
            }
        }

        if (t.isForStatement(node)) {
            if (!node.update && !this.checkForBreakStatement(path)) {
                console.log(`🚨 Found for loop missing increment at line ${line}`);
                issues.push({
                    type: 'bug_risk',
                    severity: 'high',
                    message: 'For loop missing increment expression',
                    line,
                    column: 0,
                    suggestion: 'Add increment expression in for loop or break statement',
                    confidence: 0.8,
                    codePattern: 'missing_for_increment'
                });
            }
        }
    }

    private checkForLoopIncrement(path: any): boolean {
        let hasIncrement = false;
        const loopNode = path.node;
        
        // For while loops, check if the test condition variable is modified in the body
        if (t.isWhileStatement(loopNode)) {
            let testVariable = null;
            
            // Extract variable from test condition (e.g., i < arr.length -> 'i')
            if (t.isBinaryExpression(loopNode.test)) {
                if (t.isIdentifier(loopNode.test.left)) {
                    testVariable = loopNode.test.left.name;
                } else if (t.isIdentifier(loopNode.test.right)) {
                    testVariable = loopNode.test.right.name;
                }
            }
            
            console.log(`🔍 Checking for increment of variable '${testVariable}' in while loop`);
            
            if (testVariable) {
                path.traverse({
                    UpdateExpression: (updatePath: any) => {
                        if (t.isIdentifier(updatePath.node.argument) && 
                            updatePath.node.argument.name === testVariable) {
                            console.log(`✅ Found increment for '${testVariable}': ${updatePath.node.operator}`);
                            hasIncrement = true;
                        }
                    },
                    AssignmentExpression: (assignPath: any) => {
                        if (t.isIdentifier(assignPath.node.left) && 
                            assignPath.node.left.name === testVariable) {
                            console.log(`✅ Found assignment for '${testVariable}'`);
                            hasIncrement = true;
                        }
                    }
                });
            }
        } else {
            // For other loops, check for any increment
            path.traverse({
                UpdateExpression: () => {
                    hasIncrement = true;
                },
                AssignmentExpression: (assignPath: any) => {
                    if (t.isBinaryExpression(assignPath.node.right) && 
                        (assignPath.node.right.operator === '+' || assignPath.node.right.operator === '-')) {
                        hasIncrement = true;
                    }
                }
            });
        }
        
        console.log(`🔍 Loop increment check result: ${hasIncrement}`);
        return hasIncrement;
    }

    private checkForBreakStatement(path: any): boolean {
        let hasBreak = false;
        path.traverse({
            BreakStatement: () => {
                hasBreak = true;
            }
        });
        return hasBreak;
    }

    private calculateComplexity(issues: ProactiveIssue[], codeFlow: CodeFlowNode[]): number {
        let complexity = 0;
        
        // Base complexity from code flow
        complexity += codeFlow.reduce((sum, node) => sum + node.complexity, 0);
        
        // Add complexity based on issues
        complexity += issues.filter(i => i.severity === 'critical').length * 3;
        complexity += issues.filter(i => i.severity === 'high').length * 2;
        complexity += issues.filter(i => i.severity === 'medium').length * 1;
        
        return complexity;
    }

    private calculatePriority(issues: ProactiveIssue[]): 'critical' | 'high' | 'medium' | 'low' {
        const criticalCount = issues.filter(i => i.severity === 'critical').length;
        const highCount = issues.filter(i => i.severity === 'high').length;
        const mediumCount = issues.filter(i => i.severity === 'medium').length;
        
        if (criticalCount > 0) return 'critical';
        if (highCount > 2) return 'high';
        if (highCount > 0 || mediumCount > 3) return 'medium';
        return 'low';
    }

    private calculateFunctionComplexity(path: any): number {
        let complexity = 1; // Base complexity
        
        // Add complexity for control flow statements
        path.traverse({
            IfStatement: () => complexity++,
            WhileStatement: () => complexity += 2,
            ForStatement: () => complexity += 2,
            SwitchStatement: () => complexity++,
            ConditionalExpression: () => complexity++
        });
        
        return complexity;
    }

    private getScope(path: any): 'global' | 'function' | 'block' {
        if (path.getFunctionParent()) return 'function';
        if (path.getStatementParent()) return 'block';
        return 'global';
    }

    private analyzeFunctionForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;
        
        // Check for functions with too many parameters
        if (node.params && node.params.length > 5) {
            issues.push({
                type: 'maintainability',
                severity: 'medium',
                message: `Function has ${node.params.length} parameters, consider reducing complexity`,
                line,
                column: 0,
                suggestion: 'Consider using an options object or breaking into smaller functions',
                confidence: 0.8,
                codePattern: 'too_many_parameters'
            });
        }
        
        // Check for recursive functions without base case
        const functionName = node.id?.name;
        if (functionName) {
            let hasRecursiveCall = false;
            let hasBaseCase = false;
            
            path.traverse({
                CallExpression: (callPath: any) => {
                    if (t.isIdentifier(callPath.node.callee) && callPath.node.callee.name === functionName) {
                        hasRecursiveCall = true;
                    }
                },
                ReturnStatement: (returnPath: any) => {
                    // Simple heuristic: if there's a return without recursive call, it might be base case
                    if (!returnPath.node.argument || t.isLiteral(returnPath.node.argument)) {
                        hasBaseCase = true;
                    }
                }
            });
            
            if (hasRecursiveCall && !hasBaseCase) {
                console.log(`🚨 Found recursive function '${functionName}' without clear base case at line ${line}`);
                issues.push({
                    type: 'bug_risk',
                    severity: 'high',
                    message: `Recursive function '${functionName}' may lack proper base case`,
                    line,
                    column: 0,
                    suggestion: 'Ensure function has a clear base case to prevent stack overflow',
                    confidence: 0.7,
                    codePattern: 'recursive_without_base_case'
                });
            }
        }
    }

    private analyzeVariableForIssues(path: any, issues: ProactiveIssue[], varName: string): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;
        
        // Check for variable shadowing
        const binding = path.scope.getBinding(varName);
        if (binding && binding.scope.parent && binding.scope.parent.hasBinding(varName)) {
            issues.push({
                type: 'maintainability',
                severity: 'medium',
                message: `Variable '${varName}' shadows outer scope variable`,
                line,
                column: 0,
                suggestion: 'Use a different variable name to avoid confusion',
                confidence: 0.9,
                codePattern: 'variable_shadowing'
            });
        }
    }

    private analyzeConditionForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;
        
        // Check for assignment in condition (= instead of ===)
        if (t.isAssignmentExpression(node.test)) {
            console.log(`🚨 Found assignment in condition at line ${line}`);
            issues.push({
                type: 'bug_risk',
                severity: 'high',
                message: 'Assignment in condition, did you mean to use === for comparison?',
                line,
                column: 0,
                suggestion: 'Use === for comparison instead of = for assignment',
                confidence: 0.95,
                codePattern: 'assignment_in_condition'
            });
        }
    }

    private analyzeCallForIssues(path: any, issues: ProactiveIssue[]): void {
        const node = path.node;
        const line = node.loc?.start.line || 0;
        
        // Check for console.log in production code
        if (t.isMemberExpression(node.callee) && 
            t.isIdentifier(node.callee.object) && node.callee.object.name === 'console') {
            issues.push({
                type: 'maintainability',
                severity: 'low',
                message: 'Console statement found, consider removing for production',
                line,
                column: 0,
                suggestion: 'Remove console statements or use proper logging',
                confidence: 0.6,
                codePattern: 'console_statement'
            });
        }
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
            'infinite_loop_risk': 'critical',
            'async_await_missing': 'medium',
            'memory_leak': 'high'
        };
        return severityMap[patternName] || 'medium';
    }

    private getMessageForPattern(patternName: string, match: string): string {
        const messageMap: Record<string, string> = {
            'infinite_loop_risk': 'Potential infinite loop detected',
            'async_await_missing': 'Missing await for async operation',
            'memory_leak': 'Potential memory leak detected'
        };
        return messageMap[patternName] || `Pattern issue detected: ${match}`;
    }

    private getSuggestionForPattern(patternName: string): string {
        const suggestionMap: Record<string, string> = {
            'infinite_loop_risk': 'Add break statement or modify loop condition',
            'async_await_missing': 'Add await keyword or .then() handler',
            'memory_leak': 'Add cleanup code to remove listeners'
        };
        return suggestionMap[patternName] || 'Review and fix the identified pattern';
    }

    private getQuickFixForPattern(patternName: string, match: string): string | undefined {
        const quickFixMap: Record<string, string> = {
            'async_await_missing': `await ${match}`
        };
        return quickFixMap[patternName];
    }

    private getSecurityMessage(patternName: string, match: string): string {
        const messageMap: Record<string, string> = {
            'xss_risk': 'Potential XSS vulnerability detected',
            'sql_injection': 'Potential SQL injection vulnerability',
            'hardcoded_secrets': 'Hardcoded secret detected'
        };
        return messageMap[patternName] || `Security issue detected: ${match}`;
    }

    private getSecuritySuggestion(patternName: string): string {
        const suggestionMap: Record<string, string> = {
            'xss_risk': 'Use textContent instead of innerHTML or sanitize input',
            'sql_injection': 'Use parameterized queries',
            'hardcoded_secrets': 'Move secrets to environment variables'
        };
        return suggestionMap[patternName] || 'Review security implications';
    }

    private getPerformanceMessage(patternName: string, match: string): string {
        const messageMap: Record<string, string> = {
            'nested_loops': 'Nested loops detected - potential O(n²) complexity',
            'inefficient_dom': 'Repeated DOM queries detected',
            'synchronous_operations': 'Synchronous file operation detected'
        };
        return messageMap[patternName] || `Performance issue detected: ${match}`;
    }

    private getPerformanceSuggestion(patternName: string): string {
        const suggestionMap: Record<string, string> = {
            'nested_loops': 'Consider optimizing algorithm or caching results',
            'inefficient_dom': 'Cache DOM elements in variables',
            'synchronous_operations': 'Use async alternatives'
        };
        return suggestionMap[patternName] || 'Consider performance optimization';
    }
}
