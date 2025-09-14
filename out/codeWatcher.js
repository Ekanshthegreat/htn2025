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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeWatcher = void 0;
const vscode = __importStar(require("vscode"));
const diff = __importStar(require("diff"));
const interactionTracker_1 = require("./interactionTracker");
class CodeWatcher {
    constructor(astAnalyzer, llmService, profileManager) {
        this.astAnalyzer = astAnalyzer;
        this.llmService = llmService;
        this.profileManager = profileManager;
        this.isActive = false;
        this.previousContent = new Map();
        this.debounceDelay = 1000; // 1 second
    }
    setAIMentorProvider(provider) {
        this.aiMentorProvider = provider;
    }
    activate() {
        if (this.isActive)
            return;
        this.isActive = true;
        this.setupFileWatcher();
        this.setupTextDocumentWatcher();
        this.setupCursorWatcher();
    }
    deactivate() {
        this.isActive = false;
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
    setupFileWatcher() {
        // Watch for file changes in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,py,java,cpp}');
        this.fileWatcher.onDidChange(uri => {
            this.handleFileChange(uri);
        });
        this.fileWatcher.onDidCreate(uri => {
            this.handleFileCreate(uri);
        });
    }
    setupTextDocumentWatcher() {
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!this.isActive)
                return;
            const document = event.document;
            if (!this.isSupportedLanguage(document.languageId))
                return;
            // Debounce rapid changes
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }
            this.debounceTimer = setTimeout(() => {
                this.handleTextChange(document, event.contentChanges);
            }, this.debounceDelay);
        });
    }
    setupCursorWatcher() {
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (!this.isActive)
                return;
            const editor = event.textEditor;
            if (!this.isSupportedLanguage(editor.document.languageId))
                return;
            this.handleCursorChange(editor, event.selections);
        });
    }
    async handleFileChange(uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        const currentContent = document.getText();
        const previousContent = this.previousContent.get(uri.toString());
        if (previousContent && previousContent !== currentContent) {
            await this.analyzeChanges(document, previousContent, currentContent);
        }
        this.previousContent.set(uri.toString(), currentContent);
    }
    async handleFileCreate(uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        await this.llmService.sendMessage({
            type: 'file_created',
            fileName: document.fileName,
            language: document.languageId,
            content: document.getText()
        });
    }
    async handleTextChange(document, changes) {
        const currentContent = document.getText();
        const previousContent = this.previousContent.get(document.uri.toString()) || '';
        if (previousContent !== currentContent) {
            await this.analyzeChanges(document, previousContent, currentContent);
        }
        this.previousContent.set(document.uri.toString(), currentContent);
    }
    async handleCursorChange(editor, selections) {
        const document = editor.document;
        const position = selections[0].active;
        // Analyze the context around the cursor
        const line = document.lineAt(position.line);
        const context = this.getContextAroundPosition(document, position);
        await this.llmService.sendMessage({
            type: 'cursor_moved',
            fileName: document.fileName,
            language: document.languageId,
            position: { line: position.line, character: position.character },
            currentLine: line.text,
            context: context
        });
    }
    async analyzeChanges(document, previousContent, currentContent) {
        // Generate diff
        const changes = diff.diffLines(previousContent, currentContent);
        // Parse AST for both versions
        const previousAST = await this.astAnalyzer.parseCode(previousContent, document.languageId);
        const currentAST = await this.astAnalyzer.parseCode(currentContent, document.languageId);
        // Analyze the changes
        const analysis = await this.astAnalyzer.analyzeChanges(previousAST, currentAST);
        // Send to LLM for natural language explanation
        const response = await this.llmService.sendMessage({
            type: 'code_changed',
            fileName: document.fileName,
            language: document.languageId,
            diff: changes,
            analysis: analysis,
            previousContent: previousContent,
            currentContent: currentContent
        });
        // Display response in UI if available
        if (response && this.aiMentorProvider) {
            this.aiMentorProvider.addMessage(response);
        }
        // Log code change event for summaries (aggregate added/removed lines)
        try {
            let addedLines = 0;
            let removedLines = 0;
            for (const c of changes) {
                const lineCount = (c.value.match(/\n/g) || []).length + (c.value.endsWith('\n') ? 0 : 1);
                if (c.added)
                    addedLines += lineCount;
                if (c.removed)
                    removedLines += lineCount;
            }
            const activeProfile = this.profileManager?.getActiveProfile();
            interactionTracker_1.interactionTracker.logCodeChange(activeProfile?.id, {
                fileName: document.fileName,
                addedLines,
                removedLines
            });
        }
        catch { }
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
    async startGuidedDebugging(code, language) {
        const ast = await this.astAnalyzer.parseCode(code, language);
        const analysis = await this.astAnalyzer.analyzeForDebugging(ast);
        const response = await this.llmService.sendMessage({
            type: 'start_debugging',
            language: language,
            code: code,
            ast: ast,
            analysis: analysis
        });
        if (response && this.aiMentorProvider) {
            this.aiMentorProvider.addMessage(response);
        }
    }
    async startExecutionTrace(code, language) {
        const ast = await this.astAnalyzer.parseCode(code, language);
        const executionFlow = await this.astAnalyzer.traceExecutionFlow(ast);
        const response = await this.llmService.sendMessage({
            type: 'trace_execution',
            language: language,
            code: code,
            executionFlow: executionFlow
        });
        if (response && this.aiMentorProvider) {
            this.aiMentorProvider.addMessage(response);
        }
    }
    isSupportedLanguage(languageId) {
        const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
        return supportedLanguages.includes(languageId);
    }
}
exports.CodeWatcher = CodeWatcher;
//# sourceMappingURL=codeWatcher.js.map