import * as vscode from 'vscode';
import { LLMService } from './llmService';
import { VoiceService } from './voiceService';
import { MentorPersonalityService } from './mentorPersonality';
import { GenesysService, UserBehaviorAnalysis } from './genesysService';

export interface CodeSuggestion {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    type: 'bug' | 'optimization' | 'style' | 'security' | 'best-practice';
    quickFix?: string;
}

export class RealtimeAnalyzer {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private analysisTimeout: NodeJS.Timeout | null = null;
    private lastAnalyzedContent = '';
    private decorationType: vscode.TextEditorDecorationType;

    private isEnabled = true;
    private personality: MentorPersonalityService;
    private genesysService: GenesysService;
    private userActions: Array<{ action: string; timestamp: Date; context?: any }> = [];
    private sessionStart: Date = new Date();
    private errorCount = 0;
    private completionCount = 0;

    constructor(
        private llmService: LLMService,
        private voiceService: VoiceService,
        private profileManager?: any
    ) {
        this.personality = new MentorPersonalityService();
        this.genesysService = new GenesysService();
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('aiMentor');
        
        // Create decoration for inline hints
        this.decorationType = vscode.window.createTextEditorDecorationType({
            after: {
                color: '#888888',
                fontStyle: 'italic',
                margin: '0 0 0 1em'
            }
        });

        this.setupEventListeners();
        
        // Show startup message with personality
        vscode.window.showInformationMessage(this.personality.getGreeting());
        
        // Debug: Log that analyzer is initialized
        console.log('🔧 AI Mentor: Real-time analyzer initialized and ready!');
        
        // Immediately analyze current document if one is open
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            setTimeout(() => {
                this.runImmediateTest(activeEditor);
            }, 1000);
        }
    }

    private setupEventListeners() {
        // Analyze code on document changes - IMMEDIATE feedback
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (event.document.languageId === 'plaintext') return;
            this.provideInstantFeedback(event);
            this.scheduleAnalysis(event.document);
        });

        // Show encouragement while typing
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (editor) {
                this.showTypingEncouragement();
            }
        });

        // Clear diagnostics when document is closed
        vscode.workspace.onDidCloseTextDocument((document) => {
            this.diagnosticCollection.delete(document.uri);
        });
    }

    private scheduleAnalysis(document: vscode.TextDocument) {
        if (!this.isEnabled) return;
        
        // Debounce analysis to avoid excessive API calls
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }

        this.analysisTimeout = setTimeout(() => {
            this.analyzeDocument(document);
        }, 1500); // Wait 1.5 seconds after user stops typing
    }

    private async analyzeDocument(document: vscode.TextDocument) {
        const content = document.getText();
        if (!content.trim()) return;
        
        const diagnostics: vscode.Diagnostic[] = [];
        const lines = content.split('\n');
        
        // Run comprehensive analysis
        this.analyzeCodeStyle(lines, diagnostics, document);
        this.detectPotentialBugs(lines, diagnostics, document);
        this.checkPerformanceIssues(lines, diagnostics, document);
        this.detectSecurityVulnerabilities(lines, diagnostics, document);
        this.checkBestPractices(lines, diagnostics, document);
        
        // Apply mentor personality to all diagnostics
        this.applyMentorPersonality(diagnostics);
        
        this.diagnosticCollection.set(document.uri, diagnostics);
        
        // Skip if content hasn't changed significantly
        if (this.isSimilarContent(content, this.lastAnalyzedContent)) {
            return;
        }

        this.lastAnalyzedContent = content;

        try {
            const suggestions = await this.getCodeSuggestions(content, document.languageId);
            this.applyDiagnostics(document, suggestions);
            this.showInlineHints(document, suggestions);
            
            // Voice narration for critical issues
            const criticalIssues = suggestions.filter(s => 
                s.severity === vscode.DiagnosticSeverity.Error && s.type === 'bug'
            );
            
            if (criticalIssues.length > 0 && this.voiceService.isVoiceEnabled()) {
                const message = `I found ${criticalIssues.length} potential bug${criticalIssues.length > 1 ? 's' : ''} in your code.`;
                await this.voiceService.narrateCodeFlow(message, 'warning');
            }

        } catch (error) {
            console.error('Real-time analysis failed:', error);
        }
    }

    private async analyzeCurrentLine(editor: vscode.TextEditor) {
        if (!this.isEnabled) return;
        
        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line);
        const lineText = line.text.trim();

        if (lineText.length < 10) return; // Skip short lines

        try {
            const quickHint = await this.getQuickHint(lineText, editor.document.languageId);
            if (quickHint) {
                this.showQuickHint(editor, position.line, quickHint);
                // Show status bar message to indicate AI Mentor is working
                vscode.window.setStatusBarMessage('🤖 AI Mentor analyzing...', 2000);
            }
        } catch (error) {
            console.error('Quick hint analysis failed:', error);
        }
    }

    private async getCodeSuggestions(code: string, language: string): Promise<CodeSuggestion[]> {
        const prompt = `Analyze this ${language} code and provide specific suggestions for improvements. 
        Focus on:
        1. Potential bugs and errors
        2. Performance optimizations
        3. Security vulnerabilities
        4. Code style and best practices
        5. Readability improvements

        For each issue, provide:
        - Line number (approximate)
        - Issue type
        - Severity (error, warning, info)
        - Clear explanation
        - Suggested fix

        Code:
        \`\`\`${language}
        ${code}
        \`\`\`

        Respond with a JSON array of suggestions.`;

        const response = await this.llmService.sendMessage({
            type: 'start_debugging',
            code: code,
            language: language,
            analysis: { prompt }
        });

        return this.parseGeminiResponse(response?.message || '');
    }

    private async getQuickHint(lineText: string, language: string): Promise<string | null> {
        // Quick pattern-based hints for common issues
        const hints = this.getPatternBasedHints(lineText, language);
        if (hints.length > 0) {
            return hints[0];
        }

        // LLM-based hint for complex cases
        if (lineText.length > 50) {
            try {
                const prompt = `Provide a brief hint for this ${language} code line: "${lineText}"
                Focus on potential improvements, bugs, or best practices. Keep it under 50 characters.`;

                const response = await this.llmService.sendMessage({
                    type: 'cursor_moved',
                    currentLine: lineText,
                    language: language,
                    context: prompt
                });

                return response?.message?.substring(0, 80) || null;
            } catch {
                return null;
            }
        }

        return null;
    }

    private getPatternBasedHints(lineText: string, language: string): string[] {
        const hints: string[] = [];
        const lower = lineText.toLowerCase();

        // JavaScript/TypeScript specific
        if (language === 'javascript' || language === 'typescript') {
            if (lower.includes('==') && !lower.includes('===')) {
                hints.push('💡 Use === for strict equality');
            }
            if (lower.includes('var ')) {
                hints.push('💡 Consider using let or const');
            }
            if (lower.includes('console.log') && !lower.includes('//')) {
                hints.push('🧹 Remove console.log before production');
            }
            if (lower.includes('settimeout') && !lower.includes('cleartimeout')) {
                hints.push('⚠️ Consider cleanup for setTimeout');
            }
        }

        // Python specific
        if (language === 'python') {
            if (lower.includes('except:') && !lower.includes('except ')) {
                hints.push('💡 Specify exception type');
            }
            if (lower.match(/^[\s]*print\(/)) {
                hints.push('🧹 Remove print statements for production');
            }
        }

        // General patterns
        if (lower.includes('todo') || lower.includes('fixme')) {
            hints.push('📝 Don\'t forget this TODO');
        }
        if (lower.includes('password') && lower.includes('=')) {
            hints.push('🔒 Avoid hardcoded passwords');
        }
        if (lower.includes('api_key') && lower.includes('=')) {
            hints.push('🔑 Use environment variables for API keys');
        }

        return hints;
    }

    private parseGeminiResponse(content: string): CodeSuggestion[] {
        try {
            // Try to extract JSON from response
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                const suggestions = JSON.parse(jsonMatch[0]);
                return suggestions.map((s: any) => ({
                    range: new vscode.Range(
                        Math.max(0, (s.line || 1) - 1), 0,
                        Math.max(0, (s.line || 1) - 1), 100
                    ),
                    message: s.message || s.description || 'Code suggestion',
                    severity: this.mapSeverity(s.severity),
                    type: s.type || 'best-practice',
                    quickFix: s.fix || s.suggestion
                }));
            }
        } catch (error) {
            console.error('Failed to parse Gemini response:', error);
        }

        // Fallback: create suggestions from text
        return this.extractSuggestionsFromText(content);
    }

    private extractSuggestionsFromText(content: string): CodeSuggestion[] {
        const suggestions: CodeSuggestion[] = [];
        const lines = content.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes('line') && (line.includes('error') || line.includes('warning') || line.includes('suggestion'))) {
                suggestions.push({
                    range: new vscode.Range(index, 0, index, 100),
                    message: line.trim(),
                    severity: line.includes('error') ? vscode.DiagnosticSeverity.Error : 
                             line.includes('warning') ? vscode.DiagnosticSeverity.Warning : 
                             vscode.DiagnosticSeverity.Information,
                    type: 'best-practice'
                });
            }
        });

        return suggestions;
    }

    private mapSeverity(severity: string): vscode.DiagnosticSeverity {
        switch (severity?.toLowerCase()) {
            case 'error': return vscode.DiagnosticSeverity.Error;
            case 'warning': return vscode.DiagnosticSeverity.Warning;
            case 'info': case 'information': return vscode.DiagnosticSeverity.Information;
            default: return vscode.DiagnosticSeverity.Hint;
        }
    }

    private applyDiagnostics(document: vscode.TextDocument, suggestions: CodeSuggestion[]) {
        const diagnostics = suggestions.map(suggestion => {
            const diagnostic = new vscode.Diagnostic(
                suggestion.range,
                suggestion.message,
                suggestion.severity
            );
            diagnostic.source = 'AI Mentor';
            return diagnostic;
        });

        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private showInlineHints(document: vscode.TextDocument, suggestions: CodeSuggestion[]) {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) return;

        const decorations: vscode.DecorationOptions[] = suggestions
            .filter(s => s.severity === vscode.DiagnosticSeverity.Hint)
            .map(suggestion => ({
                range: suggestion.range,
                renderOptions: {
                    after: {
                        contentText: ` 💡 ${suggestion.message}`,
                    }
                }
            }));

        editor.setDecorations(this.decorationType, decorations);
    }

    private showQuickHint(editor: vscode.TextEditor, lineNumber: number, hint: string) {
        const range = new vscode.Range(lineNumber, 0, lineNumber, 0);
        const decoration: vscode.DecorationOptions = {
            range,
            renderOptions: {
                after: {
                    contentText: ` ${hint}`,
                    color: '#888888'
                }
            }
        };

        editor.setDecorations(this.decorationType, [decoration]);
        
        // Clear hint after 3 seconds
        setTimeout(() => {
            editor.setDecorations(this.decorationType, []);
        }, 3000);
    }

    private isSimilarContent(content1: string, content2: string): boolean {
        if (Math.abs(content1.length - content2.length) > 50) return false;
        
        const similarity = this.calculateSimilarity(content1, content2);
        return similarity > 0.95; // 95% similarity threshold
    }

    private calculateSimilarity(str1: string, str2: string): number {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    private levenshteinDistance(str1: string, str2: string): number {
        const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
        
        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + indicator
                );
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    private async provideInstantFeedback(event: vscode.TextDocumentChangeEvent) {
        if (!this.isEnabled) return;
        
        const document = event.document;
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) return;
        
        // Track user actions for Genesys analysis
        this.trackUserAction('document_change', { 
            fileName: document.fileName,
            changeCount: event.contentChanges.length 
        });
        
        // Debug logging
        console.log('🔧 AI Mentor: Document changed, analyzing...', document.fileName);
        
        // Get the changed text
        const changes = event.contentChanges;
        if (changes.length === 0) return;
        
        const latestChange = changes[changes.length - 1];
        const changedText = latestChange.text;

        // Analyze user behavior with Genesys for empathy-driven suggestions
        const behaviorAnalysis = await this.analyzeUserBehaviorWithGenesys(document.getText());
        
        // Immediate pattern-based feedback with empathy adjustments
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Check each line for instant feedback
        const lines = document.getText().split('\n');
        lines.forEach((line, index) => {
            const hints = this.getPatternBasedHints(line, document.languageId);
            hints.forEach(hint => {
                const range = new vscode.Range(index, 0, index, line.length);
                
                // Adjust message based on user's emotional state and empathy needs
                const empathyAdjustedMessage = this.adjustMessageForEmpathy(hint, behaviorAnalysis);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    empathyAdjustedMessage,
                    this.getSeverityBasedOnEmpathy(behaviorAnalysis)
                );
                // Use mentor profile name if available
                const mentorName = this.profileManager?.getActiveProfile()?.name || this.personality.getName();
                diagnostic.source = `${mentorName}`;
                diagnostics.push(diagnostic);
            });
            
            // Proactive comments for code patterns with empathy
            const proactiveComment = this.personality.getProactiveComment(line);
            if (proactiveComment) {
                const range = new vscode.Range(index, 0, index, line.length);
                const empathyAdjustedComment = this.adjustMessageForEmpathy(proactiveComment, behaviorAnalysis);
                
                const diagnostic = new vscode.Diagnostic(
                    range,
                    empathyAdjustedComment,
                    vscode.DiagnosticSeverity.Hint
                );
                diagnostic.source = this.personality.getName();
                diagnostics.push(diagnostic);
            }
        });
        
        this.diagnosticCollection.set(document.uri, diagnostics);
        
        // Show status encouragement
        if (changedText.length > 0) {
            const encouragements = this.personality.getTypingEncouragement();
            const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
            vscode.window.setStatusBarMessage(randomEncouragement, 3000);
        }
    }

    private showTypingEncouragement() {
        if (!this.isEnabled) return;
        
        const encouragements = this.personality.getTypingEncouragement();
        const randomEncouragement = encouragements[Math.floor(Math.random() * encouragements.length)];
        vscode.window.setStatusBarMessage(randomEncouragement, 2000);
    }

    private runImmediateTest(editor: vscode.TextEditor) {
        const document = editor.document;
        const content = document.getText();
        
        // Test pattern-based hints immediately with personality
        const lines = content.split('\n');
        let hintsFound = 0;
        const diagnostics: vscode.Diagnostic[] = [];
        
        lines.forEach((line, index) => {
            const hints = this.getPatternBasedHints(line, document.languageId);
            if (hints.length > 0) {
                hintsFound++;
                const range = new vscode.Range(index, 0, index, line.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    this.personality.formatCodeReview(hints[0], 'suggestion'),
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = this.personality.getName();
                diagnostics.push(diagnostic);
            }
        });
        
        this.diagnosticCollection.set(document.uri, diagnostics);
        
        if (hintsFound > 0) {
            vscode.window.showInformationMessage(
                this.personality.formatCodeReview(
                    `I found ${hintsFound} areas for improvement! Check the Problems panel for my insights.`,
                    'encouragement'
                )
            );
        } else {
            vscode.window.showInformationMessage(
                this.personality.formatCodeReview(
                    "Your code looks clean! I'm watching for any opportunities to share my genius-level insights.",
                    'encouragement'
                )
            );
        }
    }

    public enable() {
        this.isEnabled = true;
        vscode.window.showInformationMessage(
            this.personality.formatCodeReview("Real-time analysis is now ENABLED! Let's create some brilliant code together!", 'encouragement')
        );
    }

    public disable() {
        this.isEnabled = false;
        this.diagnosticCollection.clear();
        vscode.window.showInformationMessage(
            this.personality.formatCodeReview("Real-time analysis DISABLED. I'll be here when you need my genius insights again!", 'insight')
        );
    }

    private trackUserAction(action: string, context?: any) {
        this.userActions.push({
            action,
            timestamp: new Date(),
            context
        });

        // Keep only last 50 actions to avoid memory issues
        if (this.userActions.length > 50) {
            this.userActions = this.userActions.slice(-50);
        }

        // Track error patterns
        if (action.includes('error') || context?.error) {
            this.errorCount++;
        }
        if (action.includes('completion') || action.includes('success')) {
            this.completionCount++;
        }
    }

    private async analyzeUserBehaviorWithGenesys(codeContent: string): Promise<UserBehaviorAnalysis | null> {
        try {
            const sessionData = {
                duration: Date.now() - this.sessionStart.getTime(),
                errorCount: this.errorCount,
                completions: this.completionCount
            };

            return await this.genesysService.analyzeUserBehavior(
                codeContent,
                this.userActions,
                sessionData
            );
        } catch (error) {
            console.warn('Genesys behavior analysis failed:', error);
            return null;
        }
    }

    private adjustMessageForEmpathy(originalMessage: string, behaviorAnalysis: UserBehaviorAnalysis | null): string {
        // If we have a mentor profile, use its personality instead of empathy adjustments
        if (this.profileManager) {
            const activeProfile = this.profileManager.getActiveProfile();
            if (activeProfile && activeProfile.prompts) {
                // Transform the message using the mentor's style
                return this.getMentorStyledMessage(originalMessage, activeProfile);
            }
        }
        
        if (!behaviorAnalysis) return originalMessage;

        const empathyScore = behaviorAnalysis.empathyScore;
        const approach = behaviorAnalysis.suggestedApproach;
        const sentiment = behaviorAnalysis.sentiment;

        // High empathy needed - be very supportive
        if (empathyScore > 70 || behaviorAnalysis.emotionalState === 'frustrated' || behaviorAnalysis.emotionalState === 'confused') {
            return `💙 I understand this can be challenging. ${originalMessage} Take your time - you're doing great!`;
        }

        // Medium empathy - be encouraging
        if (empathyScore > 40 || approach === 'encouraging') {
            return `✨ ${originalMessage} Keep up the excellent work!`;
        }

        // Low empathy - be direct but positive
        if (approach === 'direct') {
            return `⚡ ${originalMessage}`;
        }

        // Patient approach
        if (approach === 'patient') {
            return `🌱 Let's work through this step by step. ${originalMessage} No rush!`;
        }

        return originalMessage;
    }

    private analyzeCodeStyle(lines: string[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check for inconsistent indentation
            if (line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && line.startsWith(' ')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Inconsistent indentation detected',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            
            // Check for long lines
            if (line.length > 120) {
                const range = new vscode.Range(index, 120, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Line too long (>120 characters)',
                    vscode.DiagnosticSeverity.Information
                ));
            }
            
            // Check for trailing whitespace
            if (line.endsWith(' ') || line.endsWith('\t')) {
                const range = new vscode.Range(index, line.trimEnd().length, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Trailing whitespace',
                    vscode.DiagnosticSeverity.Hint
                ));
            }
            
            // Check for missing semicolons in JavaScript/TypeScript
            if ((document.languageId === 'javascript' || document.languageId === 'typescript') &&
                trimmedLine.length > 0 && 
                !trimmedLine.endsWith(';') && 
                !trimmedLine.endsWith('{') && 
                !trimmedLine.endsWith('}') &&
                !trimmedLine.startsWith('//') &&
                !trimmedLine.includes('if ') &&
                !trimmedLine.includes('for ') &&
                !trimmedLine.includes('while ') &&
                !trimmedLine.includes('function ') &&
                !trimmedLine.includes('class ') &&
                !trimmedLine.includes('import ') &&
                !trimmedLine.includes('export ')) {
                const range = new vscode.Range(index, line.length, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Missing semicolon',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
        });
    }

    private detectPotentialBugs(lines: string[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check for potential null/undefined access
            if (trimmedLine.includes('.') && !trimmedLine.includes('?.') && 
                (trimmedLine.includes('null') || trimmedLine.includes('undefined'))) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Potential null/undefined access - consider using optional chaining (?.)',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            
            // Check for == instead of ===
            if (trimmedLine.includes('==') && !trimmedLine.includes('===') && !trimmedLine.includes('!==')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Use strict equality (===) instead of loose equality (==)',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            
            // Check for var usage in modern JavaScript
            if (trimmedLine.startsWith('var ')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Avoid \'var\' - use \'let\' or \'const\' instead',
                    vscode.DiagnosticSeverity.Information
                ));
            }
            
            // Check for console.log in production code
            if (trimmedLine.includes('console.log')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Remove console.log before production',
                    vscode.DiagnosticSeverity.Information
                ));
            }
        });
    }

    private checkPerformanceIssues(lines: string[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check for inefficient array operations in loops
            if (trimmedLine.includes('for') && trimmedLine.includes('.length')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Consider caching array length in variable for better performance',
                    vscode.DiagnosticSeverity.Hint
                ));
            }
            
            // Check for synchronous file operations
            if (trimmedLine.includes('readFileSync') || trimmedLine.includes('writeFileSync')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Consider using async file operations to avoid blocking',
                    vscode.DiagnosticSeverity.Warning
                ));
            }
            
            // Check for nested loops (potential O(n²) complexity)
            if (trimmedLine.includes('for') && index > 0) {
                const prevLines = lines.slice(Math.max(0, index - 5), index);
                if (prevLines.some(prevLine => prevLine.trim().includes('for'))) {
                    const range = new vscode.Range(index, 0, index, line.length);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Nested loops detected - consider optimizing algorithm complexity',
                        vscode.DiagnosticSeverity.Information
                    ));
                }
            }
        });
    }

    private detectSecurityVulnerabilities(lines: string[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check for potential SQL injection
            if (trimmedLine.includes('SELECT') && trimmedLine.includes('+')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Potential SQL injection - use parameterized queries',
                    vscode.DiagnosticSeverity.Error
                ));
            }
            
            // Check for eval usage
            if (trimmedLine.includes('eval(')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Avoid eval() - security risk and performance issue',
                    vscode.DiagnosticSeverity.Error
                ));
            }
            
            // Check for hardcoded credentials
            if (trimmedLine.includes('password') && trimmedLine.includes('=') && 
                (trimmedLine.includes('"') || trimmedLine.includes("'"))) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Potential hardcoded credential - use environment variables',
                    vscode.DiagnosticSeverity.Error
                ));
            }
        });
    }

    private checkBestPractices(lines: string[], diagnostics: vscode.Diagnostic[], document: vscode.TextDocument) {
        lines.forEach((line, index) => {
            const trimmedLine = line.trim();
            
            // Check for TODO comments
            if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'TODO/FIXME comment found - consider addressing this',
                    vscode.DiagnosticSeverity.Information
                ));
            }
            
            // Check for magic numbers
            const magicNumberRegex = /\b(?!0|1)\d{2,}\b/;
            if (magicNumberRegex.test(trimmedLine) && !trimmedLine.includes('//')) {
                const range = new vscode.Range(index, 0, index, line.length);
                diagnostics.push(new vscode.Diagnostic(
                    range,
                    'Consider extracting magic number to a named constant',
                    vscode.DiagnosticSeverity.Hint
                ));
            }
            
            // Check for empty catch blocks
            if (trimmedLine.includes('catch') && index < lines.length - 1) {
                const nextLine = lines[index + 1]?.trim();
                if (nextLine === '}' || nextLine === '{}') {
                    const range = new vscode.Range(index, 0, index + 1, lines[index + 1]?.length || 0);
                    diagnostics.push(new vscode.Diagnostic(
                        range,
                        'Empty catch block - handle errors appropriately',
                        vscode.DiagnosticSeverity.Warning
                    ));
                }
            }
        });
    }

    private applyMentorPersonality(diagnostics: vscode.Diagnostic[]) {
        if (!this.profileManager) return;
        
        const activeProfile = this.profileManager.getActiveProfile();
        if (!activeProfile) return;
        
        diagnostics.forEach(diagnostic => {
            diagnostic.message = this.getMentorStyledMessage(diagnostic.message, activeProfile);
            diagnostic.source = activeProfile.name;
        });
    }

    private getMentorStyledMessage(originalMessage: string, activeProfile: any): string {
        const mentorName = activeProfile.name;
        
        // Apply mentor personality to the message
        switch (activeProfile.id) {
            case 'marcus':
                return `${mentorName}: ${originalMessage} Stop making rookie mistakes!`;
            case 'sophia':
                return `${mentorName}: Oh look, another "TODO"... ${originalMessage} Maybe actually do it this time?`;
            case 'alex':
                return `${mentorName}: Great job adding a TODO! ${originalMessage} You're making excellent progress!`;
            default:
                return `${mentorName}: ${originalMessage}`;
        }
    }

    private getSeverityBasedOnEmpathy(behaviorAnalysis: UserBehaviorAnalysis | null): vscode.DiagnosticSeverity {
        if (!behaviorAnalysis) return vscode.DiagnosticSeverity.Information;

        // For frustrated users, use gentler severity levels
        if (behaviorAnalysis.empathyScore > 70 || 
            behaviorAnalysis.emotionalState === 'frustrated') {
            return vscode.DiagnosticSeverity.Hint; // Gentlest level
        }

        // For confused users, use information level
        if (behaviorAnalysis.emotionalState === 'confused') {
            return vscode.DiagnosticSeverity.Information;
        }

        // For positive/focused users, can use warning level
        if (behaviorAnalysis.sentiment === 'positive' || 
            behaviorAnalysis.emotionalState === 'focused') {
            return vscode.DiagnosticSeverity.Warning;
        }

        return vscode.DiagnosticSeverity.Information;
    }

    public dispose() {
        this.diagnosticCollection.dispose();
        this.decorationType.dispose();
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
    }
}
