import * as vscode from 'vscode';
import { CodeWatcher } from './codeWatcher';
import { LLMService, MentorResponse } from './llmService';
import { ProfileManager } from './profileManager';
import { VapiServer } from './vapiServer';
import { interactionTracker } from './interactionTracker';

export interface ConsolidatedMentorMessage {
    id: string;
    mentorId: string;
    mentorName: string;
    mentorAvatar: string;
    timestamp: Date;
    analysisTypes: ('pattern' | 'ast' | 'ai')[];
    confidence: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    patternAnalysis?: {
        issues: Array<{type: string; severity: string; message: string; line?: number}>;
        suggestions: string[];
    };
    astAnalysis?: {
        complexity: number;
        issues: any[];
        metrics: any;
        changes: any[];
    };
    aiAnalysis?: {
        insights: string[];
        predictions: string[];
        suggestions: string[];
        warnings: string[];
        codeSnippets?: Array<{language: string; code: string; explanation?: string}>;
    };
    content: {
        message: string;
        patternAnalysis?: {
            issues: Array<{type: string; severity: string; message: string; line?: number}>;
            suggestions: string[];
        };
        astAnalysis?: {
            complexity: number;
            codeFlow: any[];
            dataDependencies: any[];
            issues: Array<{type: string; message: string; confidence: number}>;
        };
        aiAnalysis?: {
            insights: string[];
            predictions: string[];
            suggestions: string[];
            warnings: string[];
            codeSnippets?: Array<{language: string; code: string; explanation?: string}>;
        };
    };
    actionable: boolean;
}

export class AIMentorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiMentorPanel';
    private _view?: vscode.WebviewView;
    // Change from private to public
    public vapiServer?: VapiServer;
    private messages: ConsolidatedMentorMessage[] = [];
    private messageIdCounter = 0;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private codeWatcher: CodeWatcher,
        private llmService: LLMService,
        private profileManager?: any
    ) {
        // Listen for mentor responses
        this.setupMessageListener();
    }

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'clearHistory':
                    this.clearHistory();
                    break;
                case 'switchProfile':
                    this.switchProfile(data.profileId);
                    break;
                case 'startVoiceChat':
                    this.startVoiceChat();
                case 'analyzeCode':
                    this.addCodeAnalysis();
                    break;
            }
        });

        // Send initial profile data when webview is ready
        setTimeout(() => {
            this.sendProfileUpdate();
            this.updateWebview();
        }, 100);
    }

    private setupMessageListener() {
        // In a real implementation, you'd set up proper event listening
        // For now, we'll add a method to receive messages
    }

    public addMessage(response: MentorResponse) {
        if (!response.message || !response.type) {
            console.error('Invalid response format:', response);
            return;
        }
        
        // Convert legacy MentorResponse to ConsolidatedMentorMessage
        const activeProfile = this.profileManager?.getActiveProfile();
        const consolidatedMessage = this.createConsolidatedMessage(response, activeProfile, ['ai']);
        
        this.messages.push(consolidatedMessage);
        console.log('Added consolidated message:', consolidatedMessage.content.message.substring(0, 100) + '...');
        this.updateWebview();
    }

    public addLocalAnalysis(data: any) {
        const { fileName, language, diff, analysis, currentContent } = data;
        const activeProfile = this.profileManager?.getActiveProfile();
        
        // Create consolidated message with pattern and AST analysis
        const consolidatedMessage: ConsolidatedMentorMessage = {
            id: `msg_${++this.messageIdCounter}`,
            mentorId: activeProfile?.id || 'default',
            mentorName: activeProfile?.name || 'AI Mentor',
            mentorAvatar: this.getMentorAvatar(activeProfile),
            timestamp: new Date(),
            analysisTypes: ['pattern', 'ast'],
            content: {
                message: this.generatePersonalizedMessage(activeProfile, 'code_analysis', fileName),
                patternAnalysis: this.generatePatternAnalysis(currentContent, language),
                astAnalysis: analysis ? {
                    complexity: analysis.complexity || 0,
                    codeFlow: analysis.functions || [],
                    dataDependencies: analysis.variables || [],
                    issues: analysis.potentialIssues?.map((issue: any) => ({
                        type: issue.type,
                        message: issue.message,
                        confidence: 0.8
                    })) || []
                } : undefined
            },
            confidence: 0.85,
            priority: this.calculatePriority(currentContent, analysis),
            actionable: true
        };
        
        this.messages.push(consolidatedMessage);
        this.updateWebview();
    }

    public addConsolidatedAnalysis(analysis: {
        fileName: string;
        language: string;
        diff: any[];
        astAnalysis: any;
        patternAnalysis: any;
        aiAnalysis?: {
            insights: string[];
            predictions: string[];
            suggestions: string[];
            warnings: string[];
            codeSnippets?: Array<{language: string; code: string; explanation?: string}>;
        };
        mentorResponse?: any;
        previousContent: string;
        currentContent: string;
        timestamp: string;
    }) {
        const activeProfile = this.profileManager?.getActiveProfile();
        if (!activeProfile) return;

        const consolidatedMessage: ConsolidatedMentorMessage = {
            id: `consolidated_${Date.now()}`,
            mentorId: activeProfile.id,
            mentorName: activeProfile.name,
            mentorAvatar: this.getMentorAvatar(activeProfile.id),
            timestamp: new Date(analysis.timestamp),
            analysisTypes: [],
            confidence: 0.7,
            priority: 'medium',
            content: {
                message: analysis.mentorResponse?.message || this.generatePersonalizedMessage(activeProfile, 'code_analysis', analysis.fileName)
            },
            actionable: true
        };

        // Add pattern analysis if available
        if (analysis.patternAnalysis && analysis.patternAnalysis.issues?.length > 0) {
            consolidatedMessage.analysisTypes.push('pattern');
            consolidatedMessage.patternAnalysis = {
                issues: analysis.patternAnalysis.issues.map((issue: any) => ({
                    type: issue.type || 'issue',
                    message: issue.message || issue.description,
                    severity: issue.severity || 'medium',
                    line: issue.line || 0
                })),
                suggestions: analysis.patternAnalysis.suggestions || []
            };
        }

        // Add AST analysis if available
        if (analysis.astAnalysis) {
            consolidatedMessage.analysisTypes.push('ast');
            consolidatedMessage.astAnalysis = {
                complexity: analysis.astAnalysis.complexity || 0,
                issues: analysis.astAnalysis.issues || [],
                metrics: analysis.astAnalysis.metrics || {},
                changes: analysis.astAnalysis.changes || []
            };
        }

        // Add AI analysis if available
        if (analysis.aiAnalysis) {
            consolidatedMessage.analysisTypes.push('ai');
            consolidatedMessage.aiAnalysis = {
                insights: analysis.aiAnalysis.insights || [],
                predictions: analysis.aiAnalysis.predictions || [],
                suggestions: analysis.aiAnalysis.suggestions || [],
                warnings: analysis.aiAnalysis.warnings || [],
                codeSnippets: analysis.aiAnalysis.codeSnippets || []
            };
            // Use AI response confidence if available
            consolidatedMessage.confidence = analysis.mentorResponse?.confidence || 0.85;
            consolidatedMessage.priority = this.calculateAIPriority(analysis.aiAnalysis);
        } else {
            // Calculate priority based on analysis results
            consolidatedMessage.priority = this.calculateConsolidatedPriority(consolidatedMessage);
            // Calculate confidence based on analysis types
            consolidatedMessage.confidence = consolidatedMessage.analysisTypes.length > 1 ? 0.9 : 0.7;
        }

        this.messages.push(consolidatedMessage);
        this.updateWebview();
    }

    public updateWebview() {
        if (this._view) {
            const formattedMessages = this.messages.map(msg => ({
                id: msg.id,
                mentorId: msg.mentorId,
                mentorName: msg.mentorName,
                mentorAvatar: msg.mentorAvatar,
                timestamp: msg.timestamp.toISOString(),
                analysisTypes: msg.analysisTypes,
                message: msg.content.message,
                type: 'consolidated',
                patternAnalysis: msg.content.patternAnalysis,
                astAnalysis: msg.content.astAnalysis,
                aiAnalysis: msg.content.aiAnalysis,
                confidence: msg.confidence,
                priority: msg.priority,
                actionable: msg.actionable,
                // Legacy compatibility
                suggestions: msg.content.aiAnalysis?.suggestions || msg.content.patternAnalysis?.suggestions || [],
                warnings: msg.content.aiAnalysis?.warnings || [],
                insights: msg.content.aiAnalysis?.insights || [],
                predictions: msg.content.aiAnalysis?.predictions || [],
                codeSnippets: msg.content.aiAnalysis?.codeSnippets || []
            }));
            this._view.webview.postMessage({ type: 'updateConsolidatedMessages', messages: formattedMessages });
        }
    }

    private sendProfileUpdate() {
        if (this._view && this.profileManager) {
            try {
                const profiles = this.profileManager.getAllProfiles();
                const activeProfile = this.profileManager.getActiveProfile();
                
                this._view.webview.postMessage({
                    type: 'updateProfiles',
                    profiles: profiles,
                    activeProfileId: activeProfile?.id || null,
                    activeMentorName: activeProfile?.name || 'AI Mentor'
                });
            } catch (error) {
                console.error('Error sending profile update:', error);
            }
        }
    }

    private clearHistory() {
        this.messages = [];
        this.llmService.clearHistory();
        this.updateWebview();
    }

    private async requestExplanation(code: string) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            this.sendErrorToWebview('No active editor found');
            return;
        }

        const activeProfile = this.profileManager?.getActiveProfile();
        if (activeProfile) {
            interactionTracker.logInteraction({
                mentorId: activeProfile.id,
                timestamp: new Date(),
                type: 'advice_request',
                data: { code, language: activeEditor.document.languageId }
            });
        }

        try {
            // Send typing indicator to webview
            this._view?.webview.postMessage({ type: 'mentorTyping' });

            const response = await this.llmService.sendMessage({
                type: 'start_debugging',
                code: code,
                language: activeEditor.document.languageId
            });

            if (response) {
                this.addMessage(response);
            } else {
                // Fallback response if LLM fails
                const fallbackResponse = this.createFallbackResponse(code, activeEditor.document.languageId);
                this.addMessage(fallbackResponse);
            }
        } catch (error) {
            console.error('Request explanation failed:', error);
            const errorResponse = this.createErrorResponse(error);
            this.addMessage(errorResponse);
        }
    }

    private createFallbackResponse(code: string, language: string): any {
        const activeProfile = this.profileManager?.getActiveProfile();

        if (!activeProfile) {
            return {
                message: 'AI Mentor: No mentor profile available. Please create a GitHub-based mentor profile first.',
                suggestions: ['Use the command palette to create a mentor from a GitHub profile'],
                warnings: ['No active mentor profile found'],
                type: 'warning'
            };
        }

        const mentorName = activeProfile.name;
        const communicationStyle = activeProfile.personality.communicationStyle;
        const feedbackApproach = activeProfile.personality.feedbackApproach;

        // Pattern-based analysis
        let suggestions = [];
        let warnings = [];

        // Analyze code patterns
        const hasConsoleLog = code.includes('console.log');
        const hasVar = code.includes('var ');
        const hasLooseEquality = code.includes('==') && !code.includes('===');
        const hasArrowFunctions = code.includes('=>');
        const hasAsync = code.includes('async') || code.includes('await');
        const hasComments = code.includes('//') || code.includes('/*');
        const lineCount = code.split('\n').length;

        // Generate suggestions based on GitHub profile personality
        if (hasConsoleLog) {
            suggestions.push(this.formatSuggestionByStyle('Consider using a proper logging library for production code', communicationStyle, feedbackApproach));
        }
        if (hasVar) {
            suggestions.push(this.formatSuggestionByStyle('Use let or const instead of var for better scoping', communicationStyle, feedbackApproach));
        }
        if (hasLooseEquality) {
            warnings.push(this.formatSuggestionByStyle('Use strict equality (===) instead of loose equality (==)', communicationStyle, feedbackApproach));
        }
        if (hasArrowFunctions && feedbackApproach === 'encouraging') {
            suggestions.push('Great use of arrow functions! Modern JavaScript practices.');
        }
        if (hasAsync && activeProfile.personality.expertise.includes('node.js')) {
            suggestions.push('Good async/await usage. Consider error handling patterns.');
        }
        if (!hasComments && lineCount > 10) {
            suggestions.push(this.formatSuggestionByStyle('Consider adding comments for better code documentation', communicationStyle, feedbackApproach));
        }

        // Ensure we always have at least one suggestion
        if (suggestions.length === 0 && warnings.length === 0) {
            suggestions.push(this.formatSuggestionByStyle('Your code looks clean! Keep up the good work.', communicationStyle, feedbackApproach));
        }

        const message = `${mentorName}: I've analyzed your ${language} code based on my GitHub profile analysis. Here's what I found:`;

        return {
            message,
            suggestions,
            warnings,
            type: 'explanation'
        };
    }

    private createErrorResponse(error: any): any {
        const activeProfile = this.profileManager?.getActiveProfile();
        const mentorName = activeProfile?.name || 'AI Mentor';
        const communicationStyle = activeProfile?.personality?.communicationStyle || 'supportive';

        let message = `${mentorName}: I'm having trouble analyzing your code right now.`;
        let suggestions = [
            'Check your API key in VS Code settings',
            'Ensure you have internet connectivity',
            'Try again in a moment'
        ];

        // Adjust message tone based on GitHub profile communication style
        if (communicationStyle === 'direct') {
            message = `${mentorName}: API error occurred. Check your configuration.`;
        } else if (communicationStyle === 'detailed') {
            message = `${mentorName}: I encountered a technical issue while processing your request. This typically indicates a configuration or connectivity problem.`;
            suggestions.push('Review the error details below for more information');
        } else if (communicationStyle === 'supportive') {
            message = `${mentorName}: Don't worry, I'm having a small technical hiccup. Let's troubleshoot this together.`;
        }

        return {
            message,
            suggestions,
            warnings: [`Error: ${error.message || 'Unknown error'}`],
            type: 'warning'
        };
    }

    private formatSuggestionByStyle(baseSuggestion: string, communicationStyle: string, feedbackApproach: string): string {
        switch (communicationStyle) {
            case 'direct':
                return baseSuggestion;
            case 'detailed':
                return `${baseSuggestion} This will improve code maintainability and reduce potential issues.`;
            case 'supportive':
                if (feedbackApproach === 'encouraging') {
                    return `Great progress! ${baseSuggestion} to make your code even better.`;
                }
                return `Consider this improvement: ${baseSuggestion}`;
            case 'concise':
                return baseSuggestion.split('.')[0]; // Take first sentence only
            default:
                return baseSuggestion;
        }
    }

    private sendErrorToWebview(message: string) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'error',
                message: message
            });
        }
    }

    private async switchProfile(profileId: string) {
        if (this.profileManager) {
            const success = await this.profileManager.setActiveProfile(profileId);
            if (success) {
                const profile = this.profileManager.getProfile(profileId);
                this.sendProfileUpdate(); // Send updated profile info to webview
                this.updateWebview();
                vscode.window.showInformationMessage(`Switched to mentor profile: ${profile?.name}`);
            }
        }
    }


    private async startVoiceChat() {
        if (!this.vapiServer) {
            this.vapiServer = new VapiServer(this.profileManager, {}); // {} = Message Context
        }
        
        try {
            const port = await this.vapiServer.start();
            vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
        } catch (error) {
            vscode.window.showErrorMessage('Failed to start voice chat: ' + (error as Error).message);
        }
    }

    // Generate real AI suggestions for current code
    public async addCodeAnalysis() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            this.addMessage({
                message: "No active editor found. Please open a file to analyze.",
                type: "warning",
                suggestions: ["Open a code file in the editor", "Select some code to analyze"],
            });
            return;
        }

        const document = editor.document;
        const selection = editor.selection;
        const code = selection.isEmpty ? document.getText() : document.getText(selection);

        if (!code.trim()) {
            this.addMessage({
                message: "No code found to analyze. The file appears to be empty.",
                type: "warning",
                suggestions: ["Write some code first", "Select a code snippet to analyze"],
            });
            return;
        }

        this.updateWebview();
        this._view?.webview.postMessage({ type: "showTyping", mentor: "AI Mentor" });

        try {
            const response = await this.llmService.sendMessage({
                type: "code_analysis",
                fileName: document.fileName,
                language: document.languageId,
                code,
                currentContent: code,
                analysis: {
                    complexity: this.calculateComplexity(code),
                    patterns: this.detectPatterns(code, document.languageId),
                    potentialIssues: this.detectPotentialIssues(code),
                },
            });

            if (response) {
                this.addMessage(response);
            } else {
                this.addMessage({
                    message: `🔍 Analyzed ${document.languageId} code in ${document.fileName}. Here's what I found:`,
                    type: "explanation",
                    suggestions: this.generateCodeSuggestions(code, document.languageId),
                    insights: this.generateCodeInsights(code, document.languageId),
                    warnings: this.detectWarnings(code, document.languageId),
                    codeSnippets: this.generateImprovementSnippets(code, document.languageId),
                });
            }
        } catch (error: unknown) {
            console.error("Code analysis error:", error);
            this.addMessage({
                message: "❌ Error analyzing code. Please check your Gemini API configuration.",
                type: "warning",
                suggestions: [
                    "Set your Gemini API key: aiMentor.apiKey",
                    "Ensure llmProvider is set to 'gemini'",
                    "Try again in a moment",
                ],
            });
        } finally {
            this._view?.webview.postMessage({ type: "hideTyping" });
        }
    }

    private calculateComplexity(code: string): string {
        const lines = code.split('\n').length;
        const functions = (code.match(/function|def |class |const \w+\s*=/g) || []).length;
        const conditions = (code.match(/if|else|switch|case|while|for/g) || []).length;
        
        const complexity = lines + functions * 2 + conditions * 3;
        if (complexity < 20) return 'low';
        if (complexity < 50) return 'medium';
        return 'high';
    }
    
    private detectPatterns(code: string, language: string): string[] {
        const patterns = [];
        
        if (code.includes('function') || code.includes('def ')) patterns.push('function_definition');
        if (code.includes('class ')) patterns.push('class_definition');
        if (code.includes('const ') || code.includes('let ') || code.includes('var ')) patterns.push('variable_declaration');
        if (code.includes('if') || code.includes('else')) patterns.push('conditional_logic');
        if (code.includes('for') || code.includes('while')) patterns.push('loops');
        if (code.includes('try') || code.includes('catch')) patterns.push('error_handling');
        if (code.includes('async') || code.includes('await')) patterns.push('async_programming');
        
        return patterns;
    }
    
    private detectPotentialIssues(code: string): string[] {
        const issues = [];
        
        if (code.includes('console.log')) issues.push('debug_statements');
        if (code.includes('TODO') || code.includes('FIXME')) issues.push('todo_comments');
        if (!code.includes('try') && code.includes('await')) issues.push('unhandled_async_errors');
        if (code.split('\n').some(line => line.length > 120)) issues.push('long_lines');
        
        return issues;
    }
    
    private generateCodeSuggestions(code: string, language: string): string[] {
        const suggestions = [];
        
        if (code.includes('console.log')) suggestions.push('Consider using a proper logging library instead of console.log');
        if (!code.includes('//') && !code.includes('/*')) suggestions.push('Add comments to explain complex logic');
        if (code.includes('var ')) suggestions.push('Use const/let instead of var for better scoping');
        if (language === 'javascript' && !code.includes('use strict')) suggestions.push('Consider adding "use strict" directive');
        
        return suggestions;
    }
    
    private generateCodeInsights(code: string, language: string): string[] {
        const insights = [];
        const lines = code.split('\n').length;
        
        insights.push(`Code contains ${lines} lines`);
        if (code.includes('async')) insights.push('Uses modern async/await patterns');
        if (code.includes('class')) insights.push('Object-oriented programming approach');
        if (code.includes('const')) insights.push('Good use of immutable variables');
        
        return insights;
    }
    
    private detectWarnings(code: string, language: string): string[] {
        const warnings = [];
        
        if (code.includes('eval(')) warnings.push('⚠️ eval() usage detected - potential security risk');
        if (code.includes('innerHTML') && !code.includes('sanitize')) warnings.push('⚠️ innerHTML usage without sanitization');
        if (language === 'javascript' && code.includes('==') && !code.includes('===')) warnings.push('⚠️ Use === instead of == for strict equality');
        
        return warnings;
    }
    
    private generateImprovementSnippets(code: string, language: string): any[] {
        const snippets = [];
        
        if (code.includes('console.log')) {
            snippets.push({
                language: language,
                code: 'const logger = require("winston");\nlogger.info("Your message here");',
                explanation: 'Use a proper logging library for production code'
            });
        }
        
        if (language === 'javascript' && code.includes('var ')) {
            snippets.push({
                language: 'javascript',
                code: 'const myVariable = "value"; // or let for mutable',
                explanation: 'Use const/let for better scoping and immutability'
            });
        }
        
        return snippets;
    }

    // New methods for consolidated mentor messages
    private createConsolidatedMessage(response: MentorResponse, activeProfile: any, analysisTypes: ('pattern' | 'ast' | 'ai')[]): ConsolidatedMentorMessage {
        return {
            id: `msg_${++this.messageIdCounter}`,
            mentorId: activeProfile?.id || 'default',
            mentorName: activeProfile?.name || 'AI Mentor',
            mentorAvatar: this.getMentorAvatar(activeProfile),
            timestamp: new Date(),
            analysisTypes,
            content: {
                message: response.message,
                aiAnalysis: {
                    insights: response.insights || [],
                    predictions: response.predictions || [],
                    suggestions: response.suggestions || [],
                    warnings: response.warnings || [],
                    codeSnippets: (response.codeSnippets || []).map(snippet => ({
                        language: snippet.language,
                        code: snippet.code,
                        explanation: snippet.explanation || ''
                    }))
                }
            },
            confidence: response.confidence || 0.8,
            priority: this.determinePriorityFromType(response.type),
            actionable: (response.suggestions && response.suggestions.length > 0) || false
        };
    }

    private getMentorAvatar(activeProfile: any): string {
        if (!activeProfile) return 'https://avatars.githubusercontent.com/u/60302907?v=4';
        
        if (activeProfile.githubUsername) {
            return `https://avatars.githubusercontent.com/${activeProfile.githubUsername}?v=4`;
        }
        
        return activeProfile.avatar || 'https://avatars.githubusercontent.com/u/60302907?v=4';
    }

    private generatePersonalizedMessage(activeProfile: any, messageType: string, fileName?: string): string {
        const mentorName = activeProfile?.name || 'AI Mentor';
        const communicationStyle = activeProfile?.personality?.communicationStyle || 'supportive';
        
        const baseMessage = fileName ? 
            `I've analyzed the changes in ${fileName.split('/').pop()}` :
            `I've completed my analysis of your code`;
        
        switch (communicationStyle) {
            case 'direct':
                return `${mentorName}: ${baseMessage}. Here's what I found:`;
            case 'supportive':
                return `${mentorName}: Great work! ${baseMessage} and I have some insights to share:`;
            case 'detailed':
                return `${mentorName}: I've conducted a comprehensive analysis of your code. ${baseMessage} using multiple analysis techniques. Here are my findings:`;
            case 'concise':
                return `${mentorName}: Analysis complete.`;
            default:
                return `${mentorName}: ${baseMessage}. Here are my observations:`;
        }
    }

    private generatePatternAnalysis(content: string, language: string): { issues: Array<{type: string; severity: string; message: string; line?: number}>; suggestions: string[] } {
        const issues: Array<{type: string; severity: string; message: string; line?: number}> = [];
        const suggestions: string[] = [];
        
        if (!content) return { issues, suggestions };
        
        const lines = content.split('\n');
        
        // Pattern-based analysis
        lines.forEach((line, index) => {
            const trimmed = line.trim();
            
            if (trimmed.includes('console.log')) {
                issues.push({
                    type: 'debug_statement',
                    severity: 'low',
                    message: 'Debug statement detected',
                    line: index + 1
                });
                suggestions.push('Remove console.log statements before production');
            }
            
            if (trimmed.includes('TODO') || trimmed.includes('FIXME')) {
                issues.push({
                    type: 'todo_comment',
                    severity: 'medium',
                    message: 'TODO/FIXME comment found',
                    line: index + 1
                });
                suggestions.push('Address TODO/FIXME comments');
            }
            
            if (language === 'javascript' || language === 'typescript') {
                if (trimmed.includes('var ')) {
                    issues.push({
                        type: 'deprecated_syntax',
                        severity: 'medium',
                        message: 'Use of var keyword detected',
                        line: index + 1
                    });
                    suggestions.push('Use let or const instead of var');
                }
                
                if (trimmed.includes('==') && !trimmed.includes('===')) {
                    issues.push({
                        type: 'loose_equality',
                        severity: 'high',
                        message: 'Loose equality comparison detected',
                        line: index + 1
                    });
                    suggestions.push('Use strict equality (===) instead of loose equality (==)');
                }
            }
        });

        return { issues, suggestions };
    }

    private calculatePriority(currentContent: string, analysis: any): 'critical' | 'high' | 'medium' | 'low' {
        const hasErrors = analysis?.potentialIssues?.some((issue: any) => issue.severity === 'error');
        const hasWarnings = analysis?.potentialIssues?.some((issue: any) => issue.severity === 'warning');
        const complexity = analysis?.complexity || 0;
        
        if (hasErrors || complexity > 15) return 'critical';
        if (hasWarnings || complexity > 10) return 'high';
        if (complexity > 5) return 'medium';
        return 'low';
    }

    private calculateAIPriority(aiAnalysis: any): 'critical' | 'high' | 'medium' | 'low' {
        const warningCount = aiAnalysis.warnings?.length || 0;
        const suggestionCount = aiAnalysis.suggestions?.length || 0;
        
        if (warningCount > 2) return 'critical';
        if (warningCount > 1 || suggestionCount > 3) return 'high';
        if (warningCount > 0 || suggestionCount > 1) return 'medium';
        return 'low';
    }

    private calculateConsolidatedPriority(message: ConsolidatedMentorMessage): 'critical' | 'high' | 'medium' | 'low' {
        let priorityScore = 0;

        // Check pattern analysis issues
        if (message.patternAnalysis?.issues) {
            const criticalIssues = message.patternAnalysis.issues.filter(issue => issue.severity === 'critical' || issue.severity === 'error');
            const highIssues = message.patternAnalysis.issues.filter(issue => issue.severity === 'high' || issue.severity === 'warning');
            
            priorityScore += criticalIssues.length * 10;
            priorityScore += highIssues.length * 5;
            priorityScore += message.patternAnalysis.issues.length * 2;
        }

        // Check AST analysis complexity and issues
        if (message.astAnalysis) {
            const complexity = message.astAnalysis.complexity || 0;
            priorityScore += Math.min(complexity, 20);
            
            if (message.astAnalysis.issues) {
                priorityScore += message.astAnalysis.issues.length * 3;
            }
        }

        // Check AI analysis warnings and suggestions
        if (message.aiAnalysis) {
            priorityScore += (message.aiAnalysis.warnings?.length || 0) * 4;
            priorityScore += (message.aiAnalysis.suggestions?.length || 0) * 2;
        }

        if (priorityScore >= 30) return 'critical';
        if (priorityScore >= 15) return 'high';
        if (priorityScore >= 5) return 'medium';
        return 'low';
    }

    private determinePriorityFromType(type: string): 'critical' | 'high' | 'medium' | 'low' {
        switch (type) {
            case 'warning': return 'high';
            case 'suggestion': return 'medium';
            case 'explanation': return 'low';
            case 'narration': return 'low';
            default: return 'medium';
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

        // Get available profiles safely
        let mentorOptions = '<option value="">No mentor profiles available</option>';
        if (this.profileManager) {
            try {
                const profiles = this.profileManager.getAllProfiles();
                const activeProfile = this.profileManager.getActiveProfile();
                
                if (profiles && profiles.length > 0) {
                    mentorOptions = profiles.map(profile => {
                        const isSelected = activeProfile && profile.id === activeProfile.id ? 'selected' : '';
                        return `<option value="${profile.id}" ${isSelected}>${profile.name}</option>`;
                    }).join('');
                }
            } catch (error) {
                console.error('Error getting profiles for HTML generation:', error);
            }
        }

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>AI Mentor</title>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="mentor-info">
                            <img id="mentorAvatar" class="mentor-avatar-img" src="https://avatars.githubusercontent.com/u/60302907?v=4" alt="Mentor Avatar" />
                            <div class="mentor-details">
                                <h2 id="mentorTitle">🤖 AI Mentor</h2>
                                <span id="mentorStatus" class="mentor-status">Ready to help</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="header-controls">
                        <select id="mentorSelect" class="mentor-dropdown">
                            ${mentorOptions}
                        </select>
                        <button id="analyzeBtn" class="btn btn-primary">Analyze Code</button>
                        <button id="clearBtn" class="btn btn-secondary">Clear</button>
                        <button id="voiceChatBtn" class="btn btn-success">🎤 Speak to Mentor</button>
                    </div>

                    <div id="status" class="status">
                        <span class="status-indicator"></span>
                        <span id="statusText">Ready to help</span>
                    </div>

                    <div id="messages" class="messages-container">
                        <div class="welcome-message">
                            <h3>👋 Welcome to AI Mentor!</h3>
                            <p>Create personalized mentors based on GitHub profiles to get tailored coding guidance.</p>
                            <div class="setup-instructions">
                                <h4>🚀 Getting Started:</h4>
                                <ol>
                                    <li>Use the Command Palette (Ctrl+Shift+P) and search for "AI Mentor: Create GitHub Profile"</li>
                                    <li>Enter a GitHub username to analyze their coding style and expertise</li>
                                    <li>Your new mentor will provide personalized feedback based on their profile</li>
                                </ol>
                            </div>
                        </div>
                    </div>

                    <div class="input-section">
                        <textarea id="codeInput" placeholder="Paste code here for explanation..."></textarea>
                        <button id="explainBtn" class="btn btn-primary">Explain Code</button>
                    </div>
                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
 