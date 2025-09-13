import * as vscode from 'vscode';
import { LLMService } from './llmService';
import { VoiceService } from './voiceService';
import { MentorPersonalityService } from './mentorPersonality';

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

    constructor(
        private llmService: LLMService,
        private voiceService: VoiceService
    ) {
        this.personality = new MentorPersonalityService();
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
        console.log('🔧 Nikola: Real-time analyzer initialized and ready!');
        
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

    private provideInstantFeedback(event: vscode.TextDocumentChangeEvent) {
        if (!this.isEnabled) return;
        
        const document = event.document;
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.document !== document) return;
        
        // Debug logging
        console.log('🔧 Nikola: Document changed, analyzing...', document.fileName);
        
        // Get the changed text
        const changes = event.contentChanges;
        if (changes.length === 0) return;
        
        const latestChange = changes[changes.length - 1];
        const changedText = latestChange.text;
        
        // Immediate pattern-based feedback
        const diagnostics: vscode.Diagnostic[] = [];
        
        // Check each line for instant feedback
        const lines = document.getText().split('\n');
        lines.forEach((line, index) => {
            const hints = this.getPatternBasedHints(line, document.languageId);
            hints.forEach(hint => {
                const range = new vscode.Range(index, 0, index, line.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    this.personality.formatCodeReview(hint, 'suggestion'),
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = this.personality.getName();
                diagnostics.push(diagnostic);
            });
            
            // Proactive comments for code patterns
            const proactiveComment = this.personality.getProactiveComment(line);
            if (proactiveComment) {
                const range = new vscode.Range(index, 0, index, line.length);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    proactiveComment,
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

    public dispose() {
        this.diagnosticCollection.dispose();
        this.decorationType.dispose();
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }
    }
}
