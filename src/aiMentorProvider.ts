import * as vscode from 'vscode';
import { CodeWatcher } from './codeWatcher';
import { LLMService, MentorResponse } from './llmService';
import { ProfileManager } from './profileManager';

export class AIMentorProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'aiMentorPanel';
    private _view?: vscode.WebviewView;
    private messages: MentorResponse[] = [];

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
                case 'requestExplanation':
                    this.requestExplanation(data.code);
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

    private setupMessageListener() {
        // In a real implementation, you'd set up proper event listening
        // For now, we'll add a method to receive messages
    }

    public addMessage(response: MentorResponse) {
        this.messages.push(response);
        this.updateWebview();
    }

    private updateWebview() {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateMessages',
                messages: this.messages
            });

            // Also send profile data if available
            if (this.profileManager) {
                try {
                    const profiles = this.profileManager.getAllProfiles();
                    const activeProfile = this.profileManager.getActiveProfile();
                    
                    console.log('Sending profiles to webview:', profiles.length, 'profiles');
                    console.log('Active profile:', activeProfile?.name);
                    console.log('Profiles data:', profiles.map(p => ({ id: p.id, name: p.name, githubUsername: p.githubUsername })));
                    
                    this._view.webview.postMessage({
                        type: 'updateProfiles',
                        profiles: profiles,
                        activeProfileId: activeProfile?.id,
                        activeMentorName: activeProfile?.name || 'AI Mentor'
                    });
                } catch (error) {
                    console.error('Error updating webview with profiles:', error);
                }
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
        const mentorId = activeProfile?.id || 'marcus';
        const mentorName = activeProfile?.name || 'AI Mentor';
        
        // Pattern-based analysis with personality-specific responses
        let suggestions = [];
        let warnings = [];
        let message = '';
        
        // Analyze code patterns
        const hasConsoleLog = code.includes('console.log');
        const hasVar = code.includes('var ');
        const hasLooseEquality = code.includes('==') && !code.includes('===');
        const hasArrowFunctions = code.includes('=>');
        const hasAsync = code.includes('async') || code.includes('await');
        const hasComments = code.includes('//') || code.includes('/*');
        const lineCount = code.split('\n').length;
        
        // Generate personality-specific responses
        switch (mentorId) {
            case 'marcus':
                message = `${mentorName}: *cracks knuckles* Alright, let me tear this ${language} code apart...`;
                
                if (hasConsoleLog) {
                    warnings.push("Console.log? Really? What is this, amateur hour? Use a proper logging framework!");
                }
                if (hasVar) {
                    warnings.push("'var'? Did you time travel from 2010? Use 'let' or 'const' like a professional!");
                }
                if (hasLooseEquality) {
                    warnings.push("Loose equality (==)? That's how bugs are born. Use === and save yourself the headache!");
                }
                if (!hasComments && lineCount > 10) {
                    warnings.push("No comments? Good luck remembering what this mess does in 6 months!");
                }
                
                if (warnings.length === 0) {
                    suggestions.push("Fine, your code doesn't completely suck. But I'm watching you...");
                } else {
                    suggestions.push("Fix these rookie mistakes and maybe you'll write decent code someday.");
                }
                break;
                
            case 'sophia':
                message = `${mentorName}: *adjusts glasses with a smirk* Oh, this ${language} code is... interesting. Let me guess what happened here...`;
                
                if (hasConsoleLog) {
                    suggestions.push("Console.log everywhere? It's like leaving breadcrumbs, but less useful. Try a real logging library - your future self will thank you.");
                }
                if (hasVar) {
                    suggestions.push("Using 'var'? How charmingly retro! It's like using Internet Explorer by choice. Let's upgrade to 'let' or 'const', shall we?");
                }
                if (hasLooseEquality) {
                    warnings.push("Ah yes, loose equality - because who needs predictable behavior? Use === unless you enjoy debugging mysterious type coercion bugs.");
                }
                if (hasArrowFunctions) {
                    suggestions.push("Nice arrow functions! At least someone's keeping up with modern JavaScript. Gold star for you! ⭐");
                }
                
                if (warnings.length === 0 && suggestions.length <= 1) {
                    suggestions.push("Well well, look who actually knows how to write decent code. Color me impressed! 💅");
                }
                break;
                
            case 'alex':
                message = `${mentorName}: OMG! 🌟 Your ${language} code is SO COOL! I'm literally bouncing with excitement to help you make it even MORE AMAZING!`;
                
                if (hasConsoleLog) {
                    suggestions.push("I LOVE that you're debugging with console.log! 🐛 For production, maybe we could try a fancy logging library? It'll be AWESOME!");
                }
                if (hasVar) {
                    suggestions.push("Ooh, 'var'! Classic choice! 💫 But 'let' and 'const' are like the cool new kids - they have better scoping superpowers! ✨");
                }
                if (hasLooseEquality) {
                    suggestions.push("Loose equality is fun, but strict equality (===) is like a superhero cape for your code! 🦸‍♂️ It prevents sneaky bugs!");
                }
                if (hasAsync) {
                    suggestions.push("ASYNC CODE! 🚀 You're handling asynchronous operations like a CHAMPION! This is so exciting!");
                }
                if (hasComments) {
                    suggestions.push("YES! Comments! 📝 You're documenting your brilliant thoughts! Future you is going to be SO grateful!");
                }
                
                if (suggestions.length === 0) {
                    suggestions.push("This code is FANTASTIC! 🎉 You're doing AMAZING work! Keep being the coding superstar you are! ⭐✨🌟");
                }
                break;
                
            default:
                message = `${mentorName}: I've analyzed your ${language} code. Here's what I found:`;
                if (hasConsoleLog) suggestions.push('Consider using a proper logging library for production code');
                if (hasVar) suggestions.push('Use let or const instead of var for better scoping');
                if (hasLooseEquality) warnings.push('Use strict equality (===) instead of loose equality (==)');
        }
        
        // Ensure we always have at least one suggestion
        if (suggestions.length === 0 && warnings.length === 0) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("Your code doesn't make me want to throw my computer out the window. That's... progress.");
                    break;
                case 'sophia':
                    suggestions.push("Well, this is refreshingly competent. I was expecting much worse, honestly.");
                    break;
                case 'alex':
                    suggestions.push("Your code is PERFECT and BEAUTIFUL and makes me so HAPPY! 🌈✨💖");
                    break;
                default:
                    suggestions.push('Your code looks clean! Keep up the good work.');
            }
        }
        
        return {
            message,
            suggestions,
            warnings,
            type: 'explanation'
        };
    }

    private createErrorResponse(error: any): any {
        const activeProfile = this.profileManager?.getActiveProfile();
        const mentorId = activeProfile?.id || 'marcus';
        const mentorName = activeProfile?.name || 'AI Mentor';
        
        let message = '';
        let suggestions = [];
        
        switch (mentorId) {
            case 'marcus':
                message = `${mentorName}: Great. Just great. My AI brain is having a meltdown. This is what happens when you rely on technology!`;
                suggestions = [
                    'Check your API key - probably misconfigured like everything else',
                    'Make sure you have internet - basic stuff, really',
                    'Try again, but lower your expectations'
                ];
                break;
                
            case 'sophia':
                message = `${mentorName}: *rolls eyes* Oh wonderful, the AI is having an existential crisis. How very... predictable.`;
                suggestions = [
                    'Check your API key in settings - it\'s probably as confused as this error message',
                    'Verify internet connectivity - because apparently that\'s still a thing we need to do',
                    'Try again when the digital gods are feeling more cooperative'
                ];
                break;
                
            case 'alex':
                message = `${mentorName}: Oopsie! 😅 I'm having a tiny technical hiccup! But don't worry - we'll get through this TOGETHER! 💪✨`;
                suggestions = [
                    'Let\'s check that API key in VS Code settings! It\'ll be an adventure! 🔑',
                    'Make sure you\'re connected to the internet - we need those digital highways! 🌐',
                    'Try again! I believe in us! We\'ve got this! 🚀💖'
                ];
                break;
                
            default:
                message = `${mentorName}: Sorry, I'm having trouble analyzing your code right now. Please check your API configuration and try again.`;
                suggestions = ['Check your API key in VS Code settings', 'Ensure you have internet connectivity'];
        }
        
        return {
            message,
            suggestions,
            warnings: [`Error: ${error.message || 'Unknown error'}`],
            type: 'warning'
        };
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
                this.updateWebview();
                vscode.window.showInformationMessage(`Switched to mentor profile: ${profile?.name}`);
            }
        }
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));

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
                        <h2 id="mentorTitle">🤖 AI Mentor</h2>
                        <div class="header-controls">
                            <select id="mentorSelect" class="mentor-dropdown">
                                <option value="marcus">💀 Marcus "The Hammer" - Brutally Honest</option>
                                <option value="sophia">😏 Sophia "Sass" - Sarcastic Genius</option>
                                <option value="alex">🌟 Alex "Sunshine" - Overwhelmingly Positive</option>
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
                            <p>Your AI mentor will provide real-time guidance as you code. Switch mentors using the dropdown above:</p>
                            <ul>
                                <li>💀 <strong>Marcus:</strong> Harsh but accurate - will tear your code apart to make you better</li>
                                <li>😏 <strong>Sophia:</strong> Witty and sarcastic - uses humor to teach better coding</li>
                                <li>🌟 <strong>Alex:</strong> Super positive - finds the good in everything you write</li>
                            </ul>
                            <p>Start coding and your selected mentor will begin helping!</p>
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
