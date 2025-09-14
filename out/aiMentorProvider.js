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
exports.AIMentorProvider = void 0;
const vscode = __importStar(require("vscode"));
const interactionTracker_1 = require("./interactionTracker");
class AIMentorProvider {
    constructor(_extensionUri, codeWatcher, llmService, profileManager) {
        this._extensionUri = _extensionUri;
        this.codeWatcher = codeWatcher;
        this.llmService = llmService;
        this.profileManager = profileManager;
        this.messages = [];
        // Listen for mentor responses
        this.setupMessageListener();
    }
    resolveWebviewView(webviewView, context, _token) {
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
            }
        });
        // Send initial profile data when webview is ready
        setTimeout(() => {
            this.updateWebview();
        }, 100);
    }
    setupMessageListener() {
        // In a real implementation, you'd set up proper event listening
        // For now, we'll add a method to receive messages
    }
    addMessage(response) {
        console.log('=== AIMentorProvider.addMessage called ===');
        console.log('Response:', response);
        console.log('Current messages count:', this.messages.length);
        this.messages.push(response);
        console.log('Messages after push:', this.messages.length);
        const activeProfile = this.profileManager?.getActiveProfile();
        if (activeProfile) {
            interactionTracker_1.interactionTracker.logInteraction({
                mentorId: activeProfile.id,
                timestamp: new Date(),
                type: 'advice_provided',
                data: response
            });
        }
        this.updateWebview();
    }
    updateWebview() {
        console.log('=== AIMentorProvider.updateWebview called ===');
        console.log('View exists:', !!this._view);
        console.log('Messages to send:', this.messages.length, this.messages);
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateMessages',
                messages: this.messages
            });
            console.log('Posted updateMessages to webview');
            // Also send profile data if available
            if (this.profileManager) {
                try {
                    const profiles = this.profileManager.getAllProfiles();
                    const activeProfile = this.profileManager.getActiveProfile();
                    console.log('=== BACKEND PROFILE UPDATE ===');
                    console.log('Total profiles found:', profiles.length);
                    console.log('Active profile:', activeProfile?.name || 'None');
                    if (profiles.length > 0) {
                        console.log('Profile details:');
                        profiles.forEach((profile, index) => {
                            console.log(`  ${index + 1}. ${profile.name} (${profile.id}) - GitHub: ${profile.githubUsername || 'N/A'}`);
                        });
                    }
                    const profilesForWebview = profiles.map(p => ({
                        id: p.id,
                        name: p.name,
                        githubUsername: p.githubUsername,
                        avatar: p.avatar,
                        personality: p.personality,
                        codeStylePreferences: p.codeStylePreferences,
                        prompts: p.prompts,
                        githubInsights: p.githubInsights,
                        lastUpdated: p.lastUpdated
                    }));
                    console.log('Sending to webview:', profilesForWebview);
                    this._view.webview.postMessage({
                        type: 'updateProfiles',
                        profiles: profilesForWebview,
                        activeProfileId: activeProfile?.id,
                        activeMentorName: activeProfile?.name || 'AI Mentor'
                    });
                    console.log('=== END BACKEND PROFILE UPDATE ===');
                }
                catch (error) {
                    console.error('Error updating webview with profiles:', error);
                }
            }
        }
    }
    clearHistory() {
        this.messages = [];
        this.llmService.clearHistory();
        this.updateWebview();
    }
    async requestExplanation(code) {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            this.sendErrorToWebview('No active editor found');
            return;
        }
        const activeProfile = this.profileManager?.getActiveProfile();
        if (activeProfile) {
            interactionTracker_1.interactionTracker.logInteraction({
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
            }
            else {
                // Fallback response if LLM fails
                const fallbackResponse = this.createFallbackResponse(code, activeEditor.document.languageId);
                this.addMessage(fallbackResponse);
            }
        }
        catch (error) {
            console.error('Request explanation failed:', error);
            const errorResponse = this.createErrorResponse(error);
            this.addMessage(errorResponse);
        }
    }
    createFallbackResponse(code, language) {
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
    createErrorResponse(error) {
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
        }
        else if (communicationStyle === 'detailed') {
            message = `${mentorName}: I encountered a technical issue while processing your request. This typically indicates a configuration or connectivity problem.`;
            suggestions.push('Review the error details below for more information');
        }
        else if (communicationStyle === 'supportive') {
            message = `${mentorName}: Don't worry, I'm having a small technical hiccup. Let's troubleshoot this together.`;
        }
        return {
            message,
            suggestions,
            warnings: [`Error: ${error.message || 'Unknown error'}`],
            type: 'warning'
        };
    }
    formatSuggestionByStyle(baseSuggestion, communicationStyle, feedbackApproach) {
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
    sendErrorToWebview(message) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'error',
                message: message
            });
        }
    }
    async switchProfile(profileId) {
        if (this.profileManager) {
            const success = await this.profileManager.setActiveProfile(profileId);
            if (success) {
                const profile = this.profileManager.getProfile(profileId);
                this.updateWebview();
                vscode.window.showInformationMessage(`Switched to mentor profile: ${profile?.name}`);
            }
        }
    }
    _getHtmlForWebview(webview) {
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
            }
            catch (error) {
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
                            <h2 id="mentorTitle">AI Mentor</h2>
                        </div>
                        <div class="header-controls">
                            <select id="mentorSelect" class="mentor-dropdown">
                                ${mentorOptions}
                            </select>
                            <button id="clearBtn" class="btn btn-secondary">Clear</button>
                        </div>
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

                </div>

                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
exports.AIMentorProvider = AIMentorProvider;
AIMentorProvider.viewType = 'aiMentorPanel';
//# sourceMappingURL=aiMentorProvider.js.map