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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASTAnalyzer = void 0;
const babel = __importStar(require("@babel/parser"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
class ASTAnalyzer {
    async parseCode(code, language) {
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
        }
        catch (error) {
            console.error('AST parsing error:', error);
            return null;
        }
    }
    parseJavaScript(code, isTypeScript) {
        const ast = babel.parse(code, {
            sourceType: 'module',
            plugins: isTypeScript ? ['typescript'] : ['jsx'],
        });
        const rootNode = {
            type: 'Program',
            children: []
        };
        (0, traverse_1.default)(ast, {
            FunctionDeclaration: (path) => {
                const node = path.node;
                const funcNode = {
                    type: 'FunctionDeclaration',
                    name: node.id?.name,
                    params: node.params.map(param => t.isIdentifier(param) ? param.name : 'unknown'),
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
                        const varNode = {
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
                const importNode = {
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
    parsePython(code) {
        // For Python, we'd need to use a Python AST parser
        // This is a simplified implementation
        const lines = code.split('\n');
        const rootNode = {
            type: 'Module',
            children: []
        };
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('def ')) {
                const match = trimmed.match(/def\s+(\w+)\s*\((.*?)\)/);
                if (match) {
                    const funcNode = {
                        type: 'FunctionDef',
                        name: match[1],
                        params: match[2].split(',').map(p => p.trim()).filter(p => p),
                        line: index + 1
                    };
                    rootNode.children?.push(funcNode);
                }
            }
            else if (trimmed.includes(' = ')) {
                const varName = trimmed.split(' = ')[0].trim();
                const varNode = {
                    type: 'Assign',
                    name: varName,
                    line: index + 1
                };
                rootNode.children?.push(varNode);
            }
        });
        return rootNode;
    }
    async analyzeChanges(previousAST, currentAST) {
        const analysis = {
            functions: [],
            variables: [],
            imports: [],
            exports: [],
            potentialIssues: [],
            complexity: 0
        };
        if (!currentAST)
            return analysis;
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
    extractNodes(node, analysis) {
        if (!node.children)
            return;
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
    findChanges(previousAST, currentAST, analysis) {
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
    getFunctionNames(node) {
        const names = [];
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionDef') {
            if (node.name)
                names.push(node.name);
        }
        if (node.children) {
            for (const child of node.children) {
                names.push(...this.getFunctionNames(child));
            }
        }
        return names;
    }
    analyzeForIssues(node, analysis) {
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
    async analyzeForDebugging(ast) {
        const analysis = await this.analyzeChanges(null, ast);
        // Add debugging-specific analysis
        if (ast) {
            this.findDebuggingOpportunities(ast, analysis);
        }
        return analysis;
    }
    findDebuggingOpportunities(node, analysis) {
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
    async traceExecutionFlow(ast) {
        const flow = {
            entryPoint: 'main',
            callGraph: [],
            dataFlow: []
        };
        if (!ast)
            return flow;
        // Build call graph
        this.buildCallGraph(ast, flow);
        // Build data flow
        this.buildDataFlow(ast, flow);
        return flow;
    }
    buildCallGraph(node, flow) {
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionDef') {
            if (node.name) {
                const graphNode = {
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
    buildDataFlow(node, flow) {
        if (node.type === 'VariableDeclaration' || node.type === 'Assign') {
            if (node.name) {
                const dataNode = {
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
exports.ASTAnalyzer = ASTAnalyzer;
//# sourceMappingURL=astAnalyzer.js.map