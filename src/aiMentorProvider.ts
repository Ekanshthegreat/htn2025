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
        console.log('=== AIMentorProvider.addMessage called ===');
        console.log('Response:', response);
        console.log('Current messages count:', this.messages.length);
        
        this.messages.push(response);
        console.log('Messages after push:', this.messages.length);
        
        this.updateWebview();
    }

    public updateWebview() {
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
                        githubInsights: (p as any).githubInsights,
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
