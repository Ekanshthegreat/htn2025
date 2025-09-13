import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

export interface ASTNode {
    type: string;
    name?: string;
    params?: string[];
    returnType?: string;
    children?: ASTNode[];
    line?: number;
    column?: number;
}

export interface CodeAnalysis {
    functions: ASTNode[];
    variables: ASTNode[];
    imports: ASTNode[];
    exports: ASTNode[];
    potentialIssues: Issue[];
    complexity: number;
}

export interface Issue {
    type: 'warning' | 'error' | 'suggestion';
    message: string;
    line?: number;
    column?: number;
    severity: 'low' | 'medium' | 'high';
}

export interface ExecutionFlow {
    entryPoint: string;
    callGraph: CallGraphNode[];
    dataFlow: DataFlowNode[];
}

export interface CallGraphNode {
    function: string;
    calls: string[];
    calledBy: string[];
}

export interface DataFlowNode {
    variable: string;
    assignments: { line: number; value: string }[];
    usages: { line: number; context: string }[];
}

export class ASTAnalyzer {
    async parseCode(code: string, language: string): Promise<ASTNode | null> {
        try {
            switch (language) {
                case 'javascript':
                case 'typescript':
                    return this.parseJavaScript(code, language === 'typescript');
                case 'python':
                    return this.parsePython(code);
                default:
                    return null;
            }
        } catch (error) {
            console.error('AST parsing error:', error);
            return null;
        }
    }

    private parseJavaScript(code: string, isTypeScript: boolean): ASTNode {
        const ast = babel.parse(code, {
            sourceType: 'module',
            plugins: isTypeScript ? ['typescript'] : ['jsx'],
        });

        const rootNode: ASTNode = {
            type: 'Program',
            children: []
        };

        traverse(ast, {
            FunctionDeclaration: (path) => {
                const node = path.node;
                const funcNode: ASTNode = {
                    type: 'FunctionDeclaration',
                    name: node.id?.name,
                    params: node.params.map(param => 
                        t.isIdentifier(param) ? param.name : 'unknown'
                    ),
                    line: node.loc?.start.line,
                    column: node.loc?.start.column,
                    children: []
                };
                rootNode.children?.push(funcNode);
            },
            VariableDeclaration: (path) => {
                const node = path.node;
                node.declarations.forEach(decl => {
                    if (t.isIdentifier(decl.id)) {
                        const varNode: ASTNode = {
                            type: 'VariableDeclaration',
                            name: decl.id.name,
                            line: node.loc?.start.line,
                            column: node.loc?.start.column
                        };
                        rootNode.children?.push(varNode);
                    }
                });
            },
            ImportDeclaration: (path) => {
                const node = path.node;
                const importNode: ASTNode = {
                    type: 'ImportDeclaration',
                    name: node.source.value,
                    line: node.loc?.start.line,
                    column: node.loc?.start.column
                };
                rootNode.children?.push(importNode);
            }
        });

        return rootNode;
    }

    private parsePython(code: string): ASTNode {
        // For Python, we'd need to use a Python AST parser
        // This is a simplified implementation
        const lines = code.split('\n');
        const rootNode: ASTNode = {
            type: 'Module',
            children: []
        };

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('def ')) {
                const match = trimmed.match(/def\s+(\w+)\s*\((.*?)\)/);
                if (match) {
                    const funcNode: ASTNode = {
                        type: 'FunctionDef',
                        name: match[1],
                        params: match[2].split(',').map(p => p.trim()).filter(p => p),
                        line: index + 1
                    };
                    rootNode.children?.push(funcNode);
                }
            } else if (trimmed.includes(' = ')) {
                const varName = trimmed.split(' = ')[0].trim();
                const varNode: ASTNode = {
                    type: 'Assign',
                    name: varName,
                    line: index + 1
                };
                rootNode.children?.push(varNode);
            }
        });

        return rootNode;
    }

    async analyzeChanges(previousAST: ASTNode | null, currentAST: ASTNode | null): Promise<CodeAnalysis> {
        const analysis: CodeAnalysis = {
            functions: [],
            variables: [],
            imports: [],
            exports: [],
            potentialIssues: [],
            complexity: 0
        };

        if (!currentAST) return analysis;

        // Extract functions, variables, etc.
        this.extractNodes(currentAST, analysis);

        // Compare with previous AST to find changes
        if (previousAST) {
            this.findChanges(previousAST, currentAST, analysis);
        }

        // Analyze for potential issues
        this.analyzeForIssues(currentAST, analysis);

        return analysis;
    }

    private extractNodes(node: ASTNode, analysis: CodeAnalysis) {
        if (!node.children) return;

        for (const child of node.children) {
            switch (child.type) {
                case 'FunctionDeclaration':
                case 'FunctionDef':
                    analysis.functions.push(child);
                    analysis.complexity += 1;
                    break;
                case 'VariableDeclaration':
                case 'Assign':
                    analysis.variables.push(child);
                    break;
                case 'ImportDeclaration':
                    analysis.imports.push(child);
                    break;
            }
            this.extractNodes(child, analysis);
        }
    }

    private findChanges(previousAST: ASTNode, currentAST: ASTNode, analysis: CodeAnalysis) {
        // Simple change detection - in a real implementation, this would be more sophisticated
        const prevFunctions = this.getFunctionNames(previousAST);
        const currFunctions = this.getFunctionNames(currentAST);

        // Find new functions
        const newFunctions = currFunctions.filter(f => !prevFunctions.includes(f));
        const removedFunctions = prevFunctions.filter(f => !currFunctions.includes(f));

        if (newFunctions.length > 0) {
            analysis.potentialIssues.push({
                type: 'suggestion',
                message: `New functions added: ${newFunctions.join(', ')}`,
                severity: 'low'
            });
        }

        if (removedFunctions.length > 0) {
            analysis.potentialIssues.push({
                type: 'warning',
                message: `Functions removed: ${removedFunctions.join(', ')}`,
                severity: 'medium'
            });
        }
    }

    private getFunctionNames(node: ASTNode): string[] {
        const names: string[] = [];
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionDef') {
            if (node.name) names.push(node.name);
        }
        if (node.children) {
            for (const child of node.children) {
                names.push(...this.getFunctionNames(child));
            }
        }
        return names;
    }

    private analyzeForIssues(node: ASTNode, analysis: CodeAnalysis) {
        // Check for common issues
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionDef') {
            if (node.params && node.params.length > 5) {
                analysis.potentialIssues.push({
                    type: 'warning',
                    message: `Function ${node.name} has many parameters (${node.params.length}). Consider refactoring.`,
                    line: node.line,
                    severity: 'medium'
                });
            }
        }

        if (node.children) {
            for (const child of node.children) {
                this.analyzeForIssues(child, analysis);
            }
        }
    }

    async analyzeForDebugging(ast: ASTNode | null): Promise<CodeAnalysis> {
        const analysis = await this.analyzeChanges(null, ast);
        
        // Add debugging-specific analysis
        if (ast) {
            this.findDebuggingOpportunities(ast, analysis);
        }

        return analysis;
    }

    private findDebuggingOpportunities(node: ASTNode, analysis: CodeAnalysis) {
        // Look for common debugging scenarios
        if (node.type === 'VariableDeclaration' || node.type === 'Assign') {
            analysis.potentialIssues.push({
                type: 'suggestion',
                message: `Consider adding a breakpoint at variable ${node.name} assignment`,
                line: node.line,
                severity: 'low'
            });
        }

        if (node.children) {
            for (const child of node.children) {
                this.findDebuggingOpportunities(child, analysis);
            }
        }
    }

    async traceExecutionFlow(ast: ASTNode | null): Promise<ExecutionFlow> {
        const flow: ExecutionFlow = {
            entryPoint: 'main',
            callGraph: [],
            dataFlow: []
        };

        if (!ast) return flow;

        // Build call graph
        this.buildCallGraph(ast, flow);
        
        // Build data flow
        this.buildDataFlow(ast, flow);

        return flow;
    }

    private buildCallGraph(node: ASTNode, flow: ExecutionFlow) {
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionDef') {
            if (node.name) {
                const graphNode: CallGraphNode = {
                    function: node.name,
                    calls: [],
                    calledBy: []
                };
                flow.callGraph.push(graphNode);
            }
        }

        if (node.children) {
            for (const child of node.children) {
                this.buildCallGraph(child, flow);
            }
        }
    }

    private buildDataFlow(node: ASTNode, flow: ExecutionFlow) {
        if (node.type === 'VariableDeclaration' || node.type === 'Assign') {
            if (node.name) {
                const dataNode: DataFlowNode = {
                    variable: node.name,
                    assignments: [{
                        line: node.line || 0,
                        value: 'unknown'
                    }],
                    usages: []
                };
                flow.dataFlow.push(dataNode);
            }
        }

        if (node.children) {
            for (const child of node.children) {
                this.buildDataFlow(child, flow);
            }
        }
    }
}
