import * as vscode from 'vscode';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import { AIMentorProvider } from './aiMentorProvider';
import { ProfileManager } from './profileManager';
import { ProactiveCodeAnalyzer } from './proactiveCodeAnalyzer';
import { DiagnosticsManager } from './diagnosticsManager';
import * as diff from 'diff';

// Import interaction tracker
const interactionTracker = {
    logCodeChange: (profileId: string | undefined, data: any) => {
        // Implementation for tracking code changes
    }
};

// Simple diff service
const diffService = {
    getDiff: (previousContent: string, currentContent: string) => {
        return diff.diffLines(previousContent, currentContent);
    }
};

export class CodeWatcher {
    private disposables: vscode.Disposable[] = [];
    private previousContent = new Map<string, string>();
    private debounceTimer: NodeJS.Timeout | undefined;
    private astAnalyzer: ASTAnalyzer;
    private llmService: LLMService;
    private aiMentorProvider: AIMentorProvider | undefined;
    private profileManager: ProfileManager | undefined;
    private proactiveAnalyzer: ProactiveCodeAnalyzer | undefined;
    private diagnosticsManager: DiagnosticsManager;
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
        this.diagnosticsManager = new DiagnosticsManager();
        this.proactiveAnalyzer = new ProactiveCodeAnalyzer();
    }

    setAIMentorProvider(provider: any) {
        this.aiMentorProvider = provider;
    }

    getDiagnosticsManager(): DiagnosticsManager {
        return this.diagnosticsManager;
    }

    activate() {
        if (this.isActive) return;

        this.isActive = true;
        this.setupFileWatcher();
        this.setupTextDocumentWatcher();
        this.setupCursorWatcher();
        
        // Initialize previous content for currently open documents
        this.initializePreviousContent();
    }
    
    private initializePreviousContent() {
        vscode.workspace.textDocuments.forEach(document => {
            if (this.isSupportedLanguage(document.languageId)) {
                this.previousContent.set(document.uri.toString(), document.getText());
                console.log(`🔧 CodeWatcher: Initialized content tracking for ${document.fileName}`);
            }
        });
    }

    deactivate() {
        this.isActive = false;
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.diagnosticsManager.dispose();
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
        const startTime = Date.now();
        const sessionId = Math.random().toString(36).substr(2, 9);
        
        console.log(`[AI-FLOW-${sessionId}] 🚀 Starting unified AI analysis flow for ${document.fileName}`);
        
        const changes = diffService.getDiff(previousContent, currentContent);
        
        if (changes.length === 0) {
            console.log(`[AI-FLOW-${sessionId}] ⏭️ No changes detected, skipping analysis`);
            return;
        }

        console.log(`[AI-FLOW-${sessionId}] 📝 Detected ${changes.length} changes in ${document.fileName}`);

        try {
            // Pattern-based analysis for immediate diagnostics
            console.log(`[AI-FLOW-${sessionId}] 🔍 Starting pattern-based analysis...`);
            const patternStartTime = Date.now();
            const proactiveAnalysis = await this.proactiveAnalyzer?.analyzeCodeProactively(
                currentContent,
                document.languageId
            );
            const patternDuration = Date.now() - patternStartTime;
            console.log(`[AI-FLOW-${sessionId}] ✅ Pattern analysis completed in ${patternDuration}ms, found ${proactiveAnalysis?.issues?.length || 0} issues`);

            // AST-based analysis
            console.log(`[AI-FLOW-${sessionId}] 🌳 Starting AST-based analysis...`);
            const astStartTime = Date.now();
            const analysis = await this.astAnalyzer.parseCode(
                currentContent,
                document.languageId
            );
            const astDuration = Date.now() - astStartTime;
            console.log(`[AI-FLOW-${sessionId}] ✅ AST analysis completed in ${astDuration}ms, parsed ${analysis?.children?.length || 0} nodes`);

            // Apply immediate blue squiggles from pattern analysis
            console.log(`[AI-FLOW-${sessionId}] 🔍 Pattern analysis issues:`, proactiveAnalysis?.issues);
            this.applyImmediateDiagnostics(document, proactiveAnalysis?.issues || [], sessionId);

            // Check rate limiting for AI analysis
            const now = Date.now();
            if (now - this.lastAnalysisTime < this.analysisThrottle) {
                console.log(`[AI-FLOW-${sessionId}] ⏸️ Rate limited, skipping AI analysis (last: ${now - this.lastAnalysisTime}ms ago)`);
                return;
            }
            this.lastAnalysisTime = now;

            // Route everything through AI mentor with context
            console.log(`[AI-FLOW-${sessionId}] 🤖 Starting AI mentor processing...`);
            await this.processWithAIMentor({
                fileName: document.fileName,
                language: document.languageId,
                diff: changes,
                astAnalysis: analysis,
                patternAnalysis: proactiveAnalysis,
                previousContent: this.truncateForContext(previousContent),
                currentContent: this.truncateForContext(currentContent),
                timestamp: new Date().toISOString(),
                sessionId: sessionId
            }, document);

            const totalDuration = Date.now() - startTime;
            console.log(`[AI-FLOW-${sessionId}] 🎉 Complete unified AI analysis flow finished in ${totalDuration}ms`);

        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[AI-FLOW-${sessionId}] ❌ AI analysis flow failed after ${totalDuration}ms:`, error);
            throw error;
        }
    }

    private applyImmediateDiagnostics(document: vscode.TextDocument, issues: any[], sessionId: string) {
        const diagnostics: vscode.Diagnostic[] = [];
        
        issues.forEach(issue => {
            const range = new vscode.Range(
                Math.max(0, issue.line - 1),
                0,
                Math.max(0, issue.line - 1),
                issue.endColumn || 100
            );
            
            const diagnostic = new vscode.Diagnostic(
                range,
                issue.message,
                vscode.DiagnosticSeverity.Information // Blue squiggles
            );
            
            diagnostic.source = 'AI Mentor';
            diagnostics.push(diagnostic);
        });
        
        this.diagnosticsManager.getCollection().set(document.uri, diagnostics);
        console.log(`[AI-FLOW-${sessionId}] 🔵 Applied ${diagnostics.length} blue squiggles to editor`);
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
    
    private async processWithAIMentor(analysisData: any, document: vscode.TextDocument) {
        const sessionId = analysisData.sessionId;
        const aiStartTime = Date.now();
        
        try {
            console.log(`[AI-FLOW-${sessionId}] 🔍 Getting active mentor profile...`);
            
            // Get active mentor profile
            const activeProfile = this.profileManager?.getActiveProfile();
            if (!activeProfile) {
                console.warn(`[AI-FLOW-${sessionId}] ⚠️ No active mentor profile found, skipping AI processing`);
                return;
            }

            console.log(`[AI-FLOW-${sessionId}] 👤 Using mentor profile: ${activeProfile.name} (${activeProfile.id})`);

            // Prepare context for AI with pattern and AST findings
            console.log(`[AI-FLOW-${sessionId}] 📋 Building mentor context...`);
            const contextStartTime = Date.now();
            const contextMessage = this.buildMentorContext(analysisData, activeProfile);
            const contextDuration = Date.now() - contextStartTime;
            console.log(`[AI-FLOW-${sessionId}] ✅ Context built in ${contextDuration}ms, length: ${contextMessage.length} chars`);

            // Send to AI with mentor persona
            console.log(`[AI-FLOW-${sessionId}] 🚀 Sending request to AI service...`);
            const llmStartTime = Date.now();
            const aiResponse = await this.llmService.sendMessage({
                type: 'code_analysis',
                fileName: analysisData.fileName,
                language: analysisData.language,
                content: contextMessage,
                previousContent: analysisData.previousContent,
                currentContent: analysisData.currentContent,
                analysis: {
                    pattern: analysisData.patternAnalysis,
                    ast: analysisData.astAnalysis,
                    diff: analysisData.diff
                }
            });
            const llmDuration = Date.now() - llmStartTime;

            if (aiResponse) {
                console.log(`[AI-FLOW-${sessionId}] ✅ AI response received in ${llmDuration}ms`);
                console.log(`[AI-FLOW-${sessionId}] 📊 Response contains: ${Object.keys(aiResponse).join(', ')}`);
                
                if (this.aiMentorProvider) {
                    console.log(`[AI-FLOW-${sessionId}] 🎨 Displaying mentor response...`);
                    const displayStartTime = Date.now();
                    await this.displayMentorResponse(aiResponse, activeProfile, document, analysisData);
                    const displayDuration = Date.now() - displayStartTime;
                    console.log(`[AI-FLOW-${sessionId}] ✅ Mentor response displayed in ${displayDuration}ms`);
                } else {
                    console.warn(`[AI-FLOW-${sessionId}] ⚠️ AI mentor provider not available for display`);
                }
            } else {
                console.warn(`[AI-FLOW-${sessionId}] ⚠️ No AI response received from LLM service`);
            }

            const totalAiDuration = Date.now() - aiStartTime;
            console.log(`[AI-FLOW-${sessionId}] 🎉 AI mentor processing completed in ${totalAiDuration}ms`);

        } catch (error) {
            const totalAiDuration = Date.now() - aiStartTime;
            console.error(`[AI-FLOW-${sessionId}] ❌ AI mentor processing failed after ${totalAiDuration}ms:`, error);
            console.error(`[AI-FLOW-${sessionId}] 📋 Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined
            });
            
            // No fallback - only show AI-generated persona responses
            console.log(`[AI-FLOW-${sessionId}] ❌ Skipping display due to AI failure - no hardcoded fallbacks`);
        }
    }

    private buildMentorContext(analysisData: any, mentorProfile: any): string {
        // Build detailed mentor persona context
        let context = `You are ${mentorProfile.name}, a coding mentor with the following personality:\n`;
        
        // Add mentor personality details
        if (mentorProfile.personality) {
            context += `- Communication Style: ${mentorProfile.personality.communicationStyle}\n`;
            context += `- Expertise: ${mentorProfile.personality.expertise.join(', ')}\n`;
            context += `- Focus Areas: ${mentorProfile.personality.focusAreas.join(', ')}\n`;
            context += `- Feedback Approach: ${mentorProfile.personality.feedbackApproach}\n\n`;
        }

        // Add specific mentor characteristics
        if (mentorProfile.name === 'Linus Torvalds') {
            context += `Respond as Linus Torvalds would - direct, efficient, focused on simplicity and performance. Use phrases like "Keep it simple" and be straightforward about issues.\n\n`;
        }

        // Add specific analysis instructions
        context += `CRITICAL: Analyze the code changes for:\n`;
        context += `1. Infinite loops (missing increments, no break conditions)\n`;
        context += `2. Logic errors (assignment vs comparison, off-by-one errors)\n`;
        context += `3. Performance issues (O(n²) complexity, memory leaks)\n`;
        context += `4. Security vulnerabilities (injection, XSS, hardcoded secrets)\n`;
        context += `5. Code quality issues (deep nesting, long functions)\n\n`;
        
        if (mentorProfile.name === 'Marcus') {
            context += `Respond as Marcus, the performance expert - focus on optimization, efficiency, and scalability concerns.\n\n`;
        } else if (mentorProfile.name === 'Sophia') {
            context += `Respond as Sophia, the code quality guru - emphasize clean code, maintainability, and best practices.\n\n`;
        }

        context += `Analyze this code change:\n\n`;
        
        // Add pattern analysis findings if any
        if (analysisData.patternAnalysis?.issues?.length > 0) {
            context += "Pattern Analysis Findings:\n";
            analysisData.patternAnalysis.issues.forEach((issue: any, index: number) => {
                context += `${index + 1}. ${issue.message} (${issue.severity}, confidence: ${issue.confidence}%)\n`;
            });
            context += "\n";
        }

        // Add AST analysis findings if any
        if (analysisData.astAnalysis?.issues?.length > 0) {
            context += "AST Analysis Findings:\n";
            analysisData.astAnalysis.issues.forEach((issue: any, index: number) => {
                context += `${index + 1}. ${issue.type}: ${issue.message}\n`;
            });
            context += "\n";
        }

        // Add diff context
        if (analysisData.diff?.length > 0) {
            context += "Code Changes:\n";
            analysisData.diff.forEach((change: any) => {
                if (change.added) {
                    context += `+ ${change.value.trim()}\n`;
                } else if (change.removed) {
                    context += `- ${change.value.trim()}\n`;
                }
            });
        }

        context += `\nRespond in character as ${mentorProfile.name}. Start your response with "${mentorProfile.name}:" and provide persona-appropriate advice. Focus on the most critical issue and provide specific, actionable guidance in your characteristic style.`;
        return context;
    }

    private async displayMentorResponse(aiResponse: any, mentorProfile: any, document: vscode.TextDocument, analysisData: any) {
        // CodeWatcher sends AI mentor messages to CHAT PANEL only
        // Format as a conversational message for the chat panel
        const mentorMessage = {
            type: 'insight' as const,
            mentor: mentorProfile.name,
            message: aiResponse.content || aiResponse.message || this.extractMentorMessage(aiResponse),
            content: aiResponse.content || aiResponse.message || this.extractMentorMessage(aiResponse),
            fileName: analysisData.fileName,
            language: analysisData.language,
            timestamp: new Date().toISOString(),
            confidence: aiResponse.confidence || 85,
            analysisType: 'deep_review',
            issues: analysisData.patternAnalysis?.issues || [],
            suggestions: aiResponse.suggestions || []
        };

        console.log(`[CodeWatcher] 💬 Sending mentor message to chat panel: ${mentorMessage.content?.substring(0, 100)}...`);
        
        // Send to chat panel (not consolidated analysis)
        if (this.aiMentorProvider) {
            this.aiMentorProvider.addMessage(mentorMessage);
        }
    }

    private extractMentorMessage(aiResponse: any): string {
        // Extract the actual mentor message from AI response
        if (typeof aiResponse === 'string') {
            return aiResponse;
        }
        
        if (aiResponse.content) {
            return aiResponse.content;
        }
        
        if (aiResponse.message) {
            return aiResponse.message;
        }
        
        if (aiResponse.insights && aiResponse.insights.length > 0) {
            return aiResponse.insights.join(' ');
        }
        
        if (aiResponse.suggestions && aiResponse.suggestions.length > 0) {
            return aiResponse.suggestions.join(' ');
        }
        
        return "Let me analyze your code changes and provide guidance.";
    }

    // Removed - now handled by DiagnosticsManager

    private calculatePriority(aiResponse: any): 'critical' | 'high' | 'medium' | 'low' {
        const warningCount = aiResponse.warnings?.length || 0;
        const confidence = aiResponse.confidence || 0;
        
        if (warningCount > 2 && confidence > 90) return 'critical';
        if (warningCount > 1 && confidence > 80) return 'high';
        if (warningCount > 0 || confidence > 70) return 'medium';
        return 'low';
    }

    private displayFallbackAnalysis(analysisData: any) {
        // Fallback to consolidated analysis if AI fails
        if (this.aiMentorProvider) {
            this.aiMentorProvider.addConsolidatedAnalysis(analysisData);
        }
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
    
    private getContextAroundPosition(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 3);
        const endLine = Math.min(document.lineCount - 1, position.line + 3);
        
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const lineText = document.lineAt(i).text;
            const marker = i === position.line ? ' >>> ' : '     ';
            context += `${i + 1}${marker}${lineText}\n`;
        }
        
        return context;
    }

    // Method to adjust throttling based on provider
    setProviderSpecificThrottling(provider: string) {
        if (provider === 'openai') {
            this.debounceDelay = 10000; // 10 seconds for OpenAI
            this.cursorMoveThrottle = 60000; // 60 seconds for cursor moves
            this.analysisThrottle = 20000; // 20 seconds for analysis
            this.analysisThrottle = 10000; // 10 seconds for analysis
        } else {
            this.debounceDelay = 2000; // 2 seconds for Gemini
            this.cursorMoveThrottle = 10000; // 10 seconds for cursor moves
            this.analysisThrottle = 3000; // 3 seconds for analysis
        }
    }
}
