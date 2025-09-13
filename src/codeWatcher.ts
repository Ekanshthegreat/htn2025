import * as vscode from 'vscode';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import * as diff from 'diff';

export class CodeWatcher {
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private isActive = false;
    private previousContent: Map<string, string> = new Map();
    private debounceTimer: NodeJS.Timeout | undefined;
    private readonly debounceDelay = 1000; // 1 second

    constructor(
        private astAnalyzer: ASTAnalyzer,
        private llmService: LLMService
    ) {}

    activate() {
        if (this.isActive) return;

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

    private setupFileWatcher() {
        // Watch for file changes in the workspace
        this.fileWatcher = vscode.workspace.createFileSystemWatcher('**/*.{js,ts,py,java,cpp}');
        
        this.fileWatcher.onDidChange(uri => {
            this.handleFileChange(uri);
        });

        this.fileWatcher.onDidCreate(uri => {
            this.handleFileCreate(uri);
        });
    }

    private setupTextDocumentWatcher() {
        vscode.workspace.onDidChangeTextDocument(event => {
            if (!this.isActive) return;
            
            const document = event.document;
            if (!this.isSupportedLanguage(document.languageId)) return;

            // Debounce rapid changes
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(() => {
                this.handleTextChange(document, event.contentChanges);
            }, this.debounceDelay);
        });
    }

    private setupCursorWatcher() {
        vscode.window.onDidChangeTextEditorSelection(event => {
            if (!this.isActive) return;
            
            const editor = event.textEditor;
            if (!this.isSupportedLanguage(editor.document.languageId)) return;

            this.handleCursorChange(editor, event.selections);
        });
    }

    private async handleFileChange(uri: vscode.Uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        const currentContent = document.getText();
        const previousContent = this.previousContent.get(uri.toString());

        if (previousContent && previousContent !== currentContent) {
            await this.analyzeChanges(document, previousContent, currentContent);
        }

        this.previousContent.set(uri.toString(), currentContent);
    }

    private async handleFileCreate(uri: vscode.Uri) {
        const document = await vscode.workspace.openTextDocument(uri);
        await this.llmService.sendMessage({
            type: 'file_created',
            fileName: document.fileName,
            language: document.languageId,
            content: document.getText()
        });
    }

    private async handleTextChange(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]) {
        const currentContent = document.getText();
        const previousContent = this.previousContent.get(document.uri.toString()) || '';

        if (previousContent !== currentContent) {
            await this.analyzeChanges(document, previousContent, currentContent);
        }

        this.previousContent.set(document.uri.toString(), currentContent);
    }

    private async handleCursorChange(editor: vscode.TextEditor, selections: readonly vscode.Selection[]) {
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

    private async analyzeChanges(document: vscode.TextDocument, previousContent: string, currentContent: string) {
        // Generate diff
        const changes = diff.diffLines(previousContent, currentContent);
        
        // Parse AST for both versions
        const previousAST = await this.astAnalyzer.parseCode(previousContent, document.languageId);
        const currentAST = await this.astAnalyzer.parseCode(currentContent, document.languageId);

        // Analyze the changes
        const analysis = await this.astAnalyzer.analyzeChanges(previousAST, currentAST);

        // Send to LLM for natural language explanation
        await this.llmService.sendMessage({
            type: 'code_changed',
            fileName: document.fileName,
            language: document.languageId,
            diff: changes,
            analysis: analysis,
            previousContent: previousContent,
            currentContent: currentContent
        });
    }

    private getContextAroundPosition(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 5);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);
        
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            context += `${i + 1}: ${line.text}\n`;
        }
        
        return context;
    }

    async startGuidedDebugging(code: string, language: string) {
        const ast = await this.astAnalyzer.parseCode(code, language);
        const analysis = await this.astAnalyzer.analyzeForDebugging(ast);

        await this.llmService.sendMessage({
            type: 'start_debugging',
            language: language,
            code: code,
            ast: ast,
            analysis: analysis
        });
    }

    async startExecutionTrace(code: string, language: string) {
        const ast = await this.astAnalyzer.parseCode(code, language);
        const executionFlow = await this.astAnalyzer.traceExecutionFlow(ast);

        await this.llmService.sendMessage({
            type: 'trace_execution',
            language: language,
            code: code,
            executionFlow: executionFlow
        });
    }

    private isSupportedLanguage(languageId: string): boolean {
        const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
        return supportedLanguages.includes(languageId);
    }
}
