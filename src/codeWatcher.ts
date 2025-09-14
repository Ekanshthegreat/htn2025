import * as vscode from 'vscode';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import { AIMentorProvider } from './aiMentorProvider';
import { ProactiveCodeAnalyzer } from './proactiveCodeAnalyzer';
import * as diff from 'diff';
import { ProfileManager } from './profileManager';
import { interactionTracker } from './interactionTracker';

export class CodeWatcher {
    private disposables: vscode.Disposable[] = [];
    private previousContent = new Map<string, string>();
    private debounceTimer: NodeJS.Timeout | undefined;
    private astAnalyzer: ASTAnalyzer;
    private llmService: LLMService;
    private aiMentorProvider: AIMentorProvider | undefined;
    private profileManager: ProfileManager | undefined;
    private proactiveAnalyzer: ProactiveCodeAnalyzer | undefined;
    private isActive: boolean = false;
    private fileWatcher: vscode.FileSystemWatcher | undefined;
    private debounceDelay: number = 3000; // Increased from 1s to 3s
    
    // Rate limiting for different types of events
    private lastCursorMoveTime: number = 0;
    private lastAnalysisTime: number = 0;
    private cursorMoveThrottle: number = 10000; // 10 seconds between cursor analysis
    private analysisThrottle: number = 5000; // 5 seconds between code analysis
    private significantChangeThreshold: number = 10; // Minimum characters changed

    constructor(
        astAnalyzer: ASTAnalyzer,
        llmService: LLMService,
        profileManager?: ProfileManager
    ) {
        this.astAnalyzer = astAnalyzer;
        this.llmService = llmService;
        this.profileManager = profileManager;
    }

    setAIMentorProvider(provider: any) {
        this.aiMentorProvider = provider;
    }

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
        const content = document.getText();
        
        // Skip empty files or very small files
        if (content.trim().length < 20) {
            return;
        }
        
        // Skip file creation analysis for OpenAI to reduce API calls
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get<string>('llmProvider', 'gemini');
        if (provider === 'openai') {
            return; // Skip file creation analysis for OpenAI due to rate limits
        }
        
        await this.llmService.sendMessage({
            type: 'file_created',
            fileName: document.fileName,
            language: document.languageId,
            content: this.truncateForContext(content)
        });
    }

    private async handleTextChange(document: vscode.TextDocument, changes: readonly vscode.TextDocumentContentChangeEvent[]) {
        const currentContent = document.getText();
        const previousContent = this.previousContent.get(document.uri.toString());

        if (previousContent && previousContent !== currentContent) {
            await this.analyzeChanges(document, previousContent, currentContent);
        }

        this.previousContent.set(document.uri.toString(), currentContent);
    }

    private async handleCursorChange(editor: vscode.TextEditor, selections: readonly vscode.Selection[]) {
        const now = Date.now();
        
        // Throttle cursor move events - only analyze every 10 seconds
        if (now - this.lastCursorMoveTime < this.cursorMoveThrottle) {
            return;
        }
        
        this.lastCursorMoveTime = now;
        
        const document = editor.document;
        const position = selections[0].active;
        
        // Only analyze if cursor is on a significant line (not empty/whitespace)
        const line = document.lineAt(position.line);
        if (line.text.trim().length === 0) {
            return;
        }
        
        // Skip cursor analysis for OpenAI to reduce API calls
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get<string>('llmProvider', 'gemini');
        if (provider === 'openai') {
            return; // Skip cursor analysis for OpenAI due to rate limits
        }
        
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
        const now = Date.now();
        
        // Throttle analysis requests
        if (now - this.lastAnalysisTime < this.analysisThrottle) {
            return;
        }
        
        // Check if change is significant enough to analyze
        const changeSize = Math.abs(currentContent.length - previousContent.length);
        if (changeSize < this.significantChangeThreshold) {
            return;
        }
        
        this.lastAnalysisTime = now;
        
        // Generate diff
        const changes = diff.diffLines(previousContent, currentContent);
        
        // Check if changes are meaningful (not just whitespace)
        const meaningfulChanges = changes.some(change => 
            (change.added || change.removed) && change.value.trim().length > 0
        );
        
        if (!meaningfulChanges) {
            return;
        }
        
        // Parse AST for both versions
        const previousAST = await this.astAnalyzer.parseCode(previousContent, document.languageId);
        const currentAST = await this.astAnalyzer.parseCode(currentContent, document.languageId);

        // Analyze the changes
        const analysis = await this.astAnalyzer.analyzeChanges(previousAST, currentAST);

        // Get proactive analysis for pattern-based issues
        const proactiveAnalysis = await this.proactiveAnalyzer?.analyzeCodeProactively(currentContent, document.languageId);

        // Create consolidated analysis combining all three types
        if (this.aiMentorProvider) {
            this.aiMentorProvider.addConsolidatedAnalysis({
                fileName: document.fileName,
                language: document.languageId,
                diff: changes,
                astAnalysis: analysis,
                patternAnalysis: proactiveAnalysis,
                previousContent: this.truncateForContext(previousContent),
                currentContent: this.truncateForContext(currentContent),
                timestamp: new Date().toISOString()
            });
        }

        // Log code change event for summaries (aggregate added/removed lines)
        try {
            let addedLines = 0;
            let removedLines = 0;
            for (const c of changes) {
                const lineCount = (c.value.match(/\n/g) || []).length + (c.value.endsWith('\n') ? 0 : 1);
                if (c.added) addedLines += lineCount;
                if (c.removed) removedLines += lineCount;
            }
            const activeProfile = this.profileManager?.getActiveProfile();
            interactionTracker.logCodeChange(activeProfile?.id, {
                fileName: document.fileName,
                addedLines,
                removedLines
            });
        } catch {}
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

    async startExecutionTrace(code: string, language: string) {
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

    private isSupportedLanguage(languageId: string): boolean {
        const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
        return supportedLanguages.includes(languageId);
    }
    
    private truncateForContext(content: string, maxLength: number = 3000): string {
        if (content.length <= maxLength) {
            return content;
        }
        
        // Try to truncate at a reasonable point (end of line)
        const truncated = content.substring(0, maxLength);
        const lastNewline = truncated.lastIndexOf('\n');
        
        if (lastNewline > maxLength * 0.8) {
            return truncated.substring(0, lastNewline) + '\n\n[Content truncated to stay within context limits]';
        }
        
        return truncated + '\n\n[Content truncated to stay within context limits]';
    }
    
    // Method to adjust throttling based on provider
    setProviderSpecificThrottling(provider: string) {
        if (provider === 'openai') {
            this.debounceDelay = 5000; // 5 seconds for OpenAI
            this.cursorMoveThrottle = 30000; // 30 seconds for cursor moves
            this.analysisThrottle = 10000; // 10 seconds for analysis
        } else {
            this.debounceDelay = 2000; // 2 seconds for Gemini
            this.cursorMoveThrottle = 10000; // 10 seconds for cursor moves
            this.analysisThrottle = 3000; // 3 seconds for analysis
        }
    }
}
