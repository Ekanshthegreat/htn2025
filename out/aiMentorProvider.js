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
class AIMentorProvider {
    constructor(_extensionUri, codeWatcher, llmService, profileManager, voiceService) {
        this._extensionUri = _extensionUri;
        this.codeWatcher = codeWatcher;
        this.llmService = llmService;
        this.profileManager = profileManager;
        this.voiceService = voiceService;
        this.messages = [];
        // Listen for mentor responses
        this.setupMessageListener();
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri],
            // Enable media access for microphone
            enableCommandUris: true,
            enableForms: true
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
                case 'startVoiceChat':
                    this.startVoiceChat();
                    break;
                case 'stopVoiceChat':
                    this.stopVoiceChat();
                    break;
                case 'vapiTranscript':
                    this.handleVapiTranscript(data.transcript, data.role);
                    break;
                case 'vapiConnectionStatus':
                    this.handleVapiConnectionStatus(data.status, data.message);
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
        this.messages.push(response);
        this.updateWebview();
    }
    updateWebview() {
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
        if (!activeEditor)
            return;
        const response = await this.llmService.sendMessage({
            type: 'start_debugging',
            code: code,
            language: activeEditor.document.languageId
        });
        if (response) {
            this.addMessage(response);
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
    async startVoiceChat() {
        if (this.voiceService) {
            const success = await this.voiceService.startConversationWithMentor();
            if (success) {
                // Update button state in webview
                this._view?.webview.postMessage({
                    type: 'voiceStateChanged',
                    isActive: true
                });
            }
        }
        else {
            vscode.window.showErrorMessage('Voice service not available');
        }
    }
    async stopVoiceChat() {
        if (this.voiceService) {
            await this.voiceService.stopConversation();
            // Update button state in webview
            this._view?.webview.postMessage({
                type: 'voiceStateChanged',
                isActive: false
            });
        }
    }
    addTranscript(transcript, role) {
        // Add transcript as a special message type
        const transcriptMessage = {
            message: transcript,
            type: 'narration',
            confidence: 1.0
        };
        this.addMessage(transcriptMessage);
    }
    startVoiceConnection(vapiPublicKey, assistantId) {
        // Send VAPI configuration to webview for initialization
        this._view?.webview.postMessage({
            type: 'startVAPIConnection',
            vapiPublicKey: vapiPublicKey,
            assistantId: assistantId
        });
    }
    stopVoiceConnection() {
        // Send stop message to webview
        this._view?.webview.postMessage({
            type: 'stopVAPIConnection'
        });
    }
    handleVapiTranscript(transcript, role) {
        // Add transcript to the chat
        this.addTranscript(transcript, role);
    }
    handleVapiConnectionStatus(status, message) {
        // Handle connection status updates from webview
        if (status === 'connected') {
            vscode.window.showInformationMessage('🎤 Voice connection established! Start speaking.');
        }
        else if (status === 'disconnected') {
            vscode.window.showInformationMessage('🔇 Voice connection ended.');
        }
        else if (status === 'error') {
            if (message.includes('Microphone access required') || message.includes('permission')) {
                vscode.window.showErrorMessage('Microphone permission required for voice chat. Please allow microphone access when prompted.', 'Try Again', 'Configure VAPI').then(choice => {
                    if (choice === 'Try Again') {
                        // Retry voice connection
                        this.startVoiceChat();
                    }
                    else if (choice === 'Configure VAPI') {
                        vscode.commands.executeCommand('aiMentor.configureVAPI');
                    }
                });
            }
            else {
                vscode.window.showErrorMessage(`Voice connection error: ${message}`, 'Configure VAPI').then(choice => {
                    if (choice === 'Configure VAPI') {
                        vscode.commands.executeCommand('aiMentor.configureVAPI');
                    }
                });
            }
        }
    }
    _getHtmlForWebview(webview) {
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
        const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.css'));
        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https: data: blob:; script-src ${webview.cspSource} https://esm.sh https://unpkg.com https://cdn.jsdelivr.net https://vapi.ai 'unsafe-inline' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline'; media-src * blob: data:; connect-src https: wss: ws: ${webview.cspSource} https://api.vapi.ai wss://api.vapi.ai; worker-src blob:; child-src blob:;">
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
                        <div class="button-row">
                            <button id="explainBtn" class="btn btn-primary">Explain Code</button>
                            <button id="speakBtn" class="btn btn-voice">🎤 Speak to your mentor</button>
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