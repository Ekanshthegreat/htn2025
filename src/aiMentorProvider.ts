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
        if (!activeEditor) return;

        const response = await this.llmService.sendMessage({
            type: 'start_debugging',
            code: code,
            language: activeEditor.document.languageId
        });

        if (response) {
            this.addMessage(response);
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
