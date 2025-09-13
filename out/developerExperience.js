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
exports.DeveloperExperience = void 0;
const vscode = __importStar(require("vscode"));
class DeveloperExperience {
    constructor(geminiService, voiceService, terminalIntegration) {
        this.geminiService = geminiService;
        this.voiceService = voiceService;
        this.terminalIntegration = terminalIntegration;
        this.flowState = {
            isInFlow: false,
            flowStartTime: null,
            interruptionCount: 0,
            focusScore: 100,
            currentTask: 'coding'
        };
        this.insights = [];
        this.keystrokePattern = [];
        this.lastActivity = new Date();
        this.productivityMetrics = {
            linesWritten: 0,
            errorsFixed: 0,
            testsWritten: 0,
            refactoringSessions: 0
        };
        this.setupFlowDetection();
        this.setupProductivityTracking();
    }
    setupFlowDetection() {
        // Track typing patterns to detect flow state
        vscode.workspace.onDidChangeTextDocument(event => {
            this.recordKeystroke();
            this.updateFlowState();
        });
        // Track cursor movements
        vscode.window.onDidChangeTextEditorSelection(event => {
            this.recordActivity();
        });
        // Track file switches (potential flow interruption)
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.handleFileSwitch(editor.document.fileName);
            }
        });
    }
    setupProductivityTracking() {
        // Track diagnostic changes (errors being fixed)
        vscode.languages.onDidChangeDiagnostics(event => {
            this.trackErrorResolution(event);
        });
        // Track test file creation/modification
        vscode.workspace.onDidCreateFiles(event => {
            event.files.forEach(file => {
                if (this.isTestFile(file.fsPath)) {
                    this.productivityMetrics.testsWritten++;
                    this.addInsight({
                        type: 'productivity',
                        title: 'Test Coverage Improvement',
                        description: 'Great job writing tests! This improves code reliability.',
                        impact: 'medium',
                        actionable: false
                    });
                }
            });
        });
    }
    recordKeystroke() {
        const now = Date.now();
        this.keystrokePattern.push(now);
        this.lastActivity = new Date();
        // Keep only last 50 keystrokes for pattern analysis
        if (this.keystrokePattern.length > 50) {
            this.keystrokePattern.shift();
        }
        this.productivityMetrics.linesWritten++;
    }
    recordActivity() {
        this.lastActivity = new Date();
    }
    updateFlowState() {
        const now = new Date();
        const timeSinceLastActivity = now.getTime() - this.lastActivity.getTime();
        // Analyze keystroke rhythm
        const rhythm = this.analyzeKeystrokeRhythm();
        // Determine if in flow state
        const wasInFlow = this.flowState.isInFlow;
        this.flowState.isInFlow = rhythm.isConsistent && timeSinceLastActivity < 30000; // 30 seconds
        if (!wasInFlow && this.flowState.isInFlow) {
            // Entering flow state
            this.flowState.flowStartTime = now;
            this.flowState.interruptionCount = 0;
            this.onFlowStateEntered();
        }
        else if (wasInFlow && !this.flowState.isInFlow) {
            // Exiting flow state
            this.onFlowStateExited();
        }
        // Update focus score
        this.updateFocusScore(rhythm);
    }
    analyzeKeystrokeRhythm() {
        if (this.keystrokePattern.length < 10) {
            return { isConsistent: false, averageInterval: 0 };
        }
        const intervals = [];
        for (let i = 1; i < this.keystrokePattern.length; i++) {
            intervals.push(this.keystrokePattern[i] - this.keystrokePattern[i - 1]);
        }
        const averageInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((acc, interval) => acc + Math.pow(interval - averageInterval, 2), 0) / intervals.length;
        const standardDeviation = Math.sqrt(variance);
        // Consistent rhythm if standard deviation is low relative to average
        const isConsistent = standardDeviation < averageInterval * 0.5 && averageInterval < 2000; // Less than 2 seconds between keystrokes
        return { isConsistent, averageInterval };
    }
    updateFocusScore(rhythm) {
        if (rhythm.isConsistent) {
            this.flowState.focusScore = Math.min(100, this.flowState.focusScore + 1);
        }
        else {
            this.flowState.focusScore = Math.max(0, this.flowState.focusScore - 2);
        }
    }
    handleFileSwitch(fileName) {
        if (this.flowState.isInFlow) {
            this.flowState.interruptionCount++;
            if (this.flowState.interruptionCount > 3) {
                this.addInsight({
                    type: 'productivity',
                    title: 'Frequent File Switching Detected',
                    description: 'You\'ve switched files multiple times. Consider using split view or bookmarks to maintain focus.',
                    impact: 'medium',
                    actionable: true,
                    suggestedAction: 'Use Ctrl+\\ to split editor or Ctrl+Shift+P -> "Bookmarks: Toggle"'
                });
            }
        }
    }
    onFlowStateEntered() {
        this.addInsight({
            type: 'productivity',
            title: 'Flow State Detected',
            description: 'You\'re in a productive coding flow! I\'ll minimize interruptions.',
            impact: 'high',
            actionable: false
        });
        // Minimize notifications during flow
        vscode.commands.executeCommand('notifications.clearAll');
    }
    onFlowStateExited() {
        if (this.flowState.flowStartTime) {
            const flowDuration = new Date().getTime() - this.flowState.flowStartTime.getTime();
            const minutes = Math.round(flowDuration / 60000);
            this.addInsight({
                type: 'productivity',
                title: `Flow Session Completed`,
                description: `Great ${minutes}-minute coding session! Consider taking a short break.`,
                impact: 'medium',
                actionable: true,
                suggestedAction: 'Take a 5-10 minute break to maintain productivity'
            });
        }
    }
    trackErrorResolution(event) {
        event.uris.forEach(uri => {
            const diagnostics = vscode.languages.getDiagnostics(uri);
            const errorCount = diagnostics.filter(d => d.severity === vscode.DiagnosticSeverity.Error).length;
            // If errors decreased, user likely fixed something
            if (errorCount === 0) {
                this.productivityMetrics.errorsFixed++;
                this.addInsight({
                    type: 'productivity',
                    title: 'Error Resolved',
                    description: 'Nice work fixing that error! Your code is getting cleaner.',
                    impact: 'low',
                    actionable: false
                });
            }
        });
    }
    isTestFile(filePath) {
        return filePath.includes('.test.') ||
            filePath.includes('.spec.') ||
            filePath.includes('__tests__') ||
            filePath.includes('/tests/');
    }
    addInsight(insight) {
        this.insights.push({
            ...insight,
            // Add timestamp for sorting
            timestamp: new Date()
        });
        // Keep only last 20 insights
        if (this.insights.length > 20) {
            this.insights.shift();
        }
        // Show high-impact insights immediately
        if (insight.impact === 'high') {
            this.showInsightNotification(insight);
        }
    }
    showInsightNotification(insight) {
        const actions = insight.actionable && insight.suggestedAction ? ['Take Action', 'Dismiss'] : ['Dismiss'];
        vscode.window.showInformationMessage(`💡 ${insight.title}: ${insight.description}`, ...actions).then(selection => {
            if (selection === 'Take Action' && insight.suggestedAction) {
                this.executeInsightAction(insight);
            }
        });
    }
    executeInsightAction(insight) {
        if (insight.suggestedAction?.startsWith('Use Ctrl+')) {
            // Show command palette or execute command
            vscode.window.showInformationMessage(insight.suggestedAction);
        }
        else if (insight.codeLocation) {
            // Navigate to code location
            vscode.workspace.openTextDocument(insight.codeLocation.file).then(doc => {
                vscode.window.showTextDocument(doc).then(editor => {
                    const position = new vscode.Position(insight.codeLocation.line, 0);
                    editor.selection = new vscode.Selection(position, position);
                    editor.revealRange(new vscode.Range(position, position));
                });
            });
        }
    }
    // Advanced developer experience features
    async analyzeCodeQuality(document) {
        const code = document.getText();
        const language = document.languageId;
        const analysis = await this.geminiService.sendMessage({
            type: 'code_changed',
            fileName: document.fileName,
            language: language,
            currentContent: code,
            previousContent: ''
        });
        const qualityInsights = [];
        if (analysis?.predictions) {
            analysis.predictions.forEach((prediction) => {
                qualityInsights.push({
                    type: 'maintainability',
                    title: 'Code Quality Prediction',
                    description: prediction,
                    impact: 'medium',
                    actionable: true,
                    codeLocation: { file: document.fileName, line: 1 }
                });
            });
        }
        return qualityInsights;
    }
    async suggestRefactoring(selection, document) {
        const selectedCode = document.getText(selection);
        const analysis = await this.geminiService.sendMessage({
            type: 'start_debugging',
            code: selectedCode,
            language: document.languageId
        });
        if (analysis?.suggestions) {
            this.addInsight({
                type: 'maintainability',
                title: 'Refactoring Opportunity',
                description: analysis.suggestions.join(' '),
                impact: 'medium',
                actionable: true,
                codeLocation: {
                    file: document.fileName,
                    line: selection.start.line
                },
                suggestedAction: 'Consider applying the suggested refactoring'
            });
        }
    }
    getFlowState() {
        return { ...this.flowState };
    }
    getProductivityMetrics() {
        return { ...this.productivityMetrics };
    }
    getInsights() {
        return [...this.insights];
    }
    clearInsights() {
        this.insights = [];
    }
    // Innovative features for Warp prize
    async predictNextAction() {
        const recentFiles = await vscode.workspace.findFiles('**/*', null, 10);
        const terminalHistory = this.terminalIntegration.getCommandHistory();
        // Use AI to predict what the developer might want to do next
        const context = {
            recentFiles: recentFiles.map(f => f.fsPath),
            terminalHistory: terminalHistory.slice(-5),
            currentTask: this.flowState.currentTask,
            focusScore: this.flowState.focusScore
        };
        const prediction = await this.geminiService.sendMessage({
            type: 'trace_execution',
            code: JSON.stringify(context),
            language: 'json'
        });
        return prediction?.message || 'Continue coding';
    }
    async generateContextualHelp() {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor)
            return;
        const position = activeEditor.selection.active;
        const line = activeEditor.document.lineAt(position.line);
        const help = await this.geminiService.sendMessage({
            type: 'cursor_moved',
            fileName: activeEditor.document.fileName,
            language: activeEditor.document.languageId,
            position: { line: position.line, character: position.character },
            currentLine: line.text,
            context: this.getContextAroundPosition(activeEditor.document, position)
        });
        if (help) {
            this.addInsight({
                type: 'learning',
                title: 'Contextual Help',
                description: help.message,
                impact: 'medium',
                actionable: false
            });
        }
    }
    getContextAroundPosition(document, position) {
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            context += `${i + 1}: ${line.text}\n`;
        }
        return context;
    }
}
exports.DeveloperExperience = DeveloperExperience;
//# sourceMappingURL=developerExperience.js.map