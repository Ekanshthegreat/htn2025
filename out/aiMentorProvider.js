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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIMentorProvider = void 0;
const vscode = __importStar(require("vscode"));
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
                case 'requestExplanation':
                    this.requestExplanation(data.code);
                    break;
                case 'switchProfile':
                    this.switchProfile(data.profileId);
                    break;
            }
        });
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
                const profiles = this.profileManager.getAllProfiles();
                const activeProfile = this.profileManager.getActiveProfile();
                this._view.webview.postMessage({
                    type: 'updateProfiles',
                    profiles: profiles,
                    activeProfileId: activeProfile.id
                });
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
    _getHtmlForWebview(webview) {
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
                        <h2>🤖 AI Mentor</h2>
                        <div class="header-controls">
                            <select id="profileSelect" class="profile-selector">
                                <!-- Profiles will be populated by JavaScript -->
                            </select>
                            <button id="clearBtn" class="btn btn-secondary">Clear History</button>
                        </div>
                    </div>
                    
                    <div id="status" class="status">
                        <span class="status-indicator"></span>
                        <span id="statusText">Ready to help</span>
                    </div>

                    <div id="messages" class="messages-container">
                        <div class="welcome-message">
                            <h3>👋 Welcome to AI Mentor!</h3>
                            <p>I'm here to help you code better. I'll watch your code changes and provide real-time guidance.</p>
                            <ul>
                                <li>🔍 <strong>Real-time Analysis:</strong> I analyze your code as you type</li>
                                <li>🐛 <strong>Proactive Debugging:</strong> I spot issues before they become problems</li>
                                <li>📚 <strong>Code Explanation:</strong> I explain what your code does in plain English</li>
                                <li>🎯 <strong>Best Practices:</strong> I suggest improvements and optimizations</li>
                            </ul>
                            <p>Start coding and I'll begin mentoring you!</p>
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
exports.AIMentorProvider = AIMentorProvider;
AIMentorProvider.viewType = 'aiMentorPanel';
//# sourceMappingURL=aiMentorProvider.js.map