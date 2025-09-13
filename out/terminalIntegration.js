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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalIntegration = void 0;
const vscode = __importStar(require("vscode"));
const ws_1 = __importDefault(require("ws"));
class TerminalIntegration {
    constructor() {
        this.terminals = new Map();
        this.commandHistory = [];
        this.warpSocket = null;
        this.isWarpConnected = false;
        this.setupTerminalWatching();
        this.attemptWarpConnection();
    }
    setupTerminalWatching() {
        // Watch for new terminals
        vscode.window.onDidOpenTerminal(terminal => {
            const session = {
                id: terminal.name + Date.now(),
                name: terminal.name,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '',
                language: this.detectLanguageFromCwd(),
                isActive: true
            };
            this.terminals.set(session.id, session);
            this.onTerminalOpened(session);
        });
        // Watch for terminal closure
        vscode.window.onDidCloseTerminal(terminal => {
            const session = Array.from(this.terminals.values())
                .find(s => s.name === terminal.name);
            if (session) {
                session.isActive = false;
                this.onTerminalClosed(session);
            }
        });
    }
    attemptWarpConnection() {
        // Try to connect to Warp's WebSocket API if available
        try {
            // Warp typically runs on localhost with a specific port
            const warpPort = 8080; // This would need to be configured
            this.warpSocket = new ws_1.default(`ws://localhost:${warpPort}/ai-mentor`);
            this.warpSocket.on('open', () => {
                this.isWarpConnected = true;
                console.log('Connected to Warp terminal');
                this.sendWarpMessage({
                    type: 'register',
                    service: 'ai-mentor',
                    capabilities: ['command-analysis', 'error-detection', 'suggestion']
                });
            });
            this.warpSocket.on('message', (data) => {
                this.handleWarpMessage(JSON.parse(data.toString()));
            });
            this.warpSocket.on('close', () => {
                this.isWarpConnected = false;
                console.log('Disconnected from Warp terminal');
            });
            this.warpSocket.on('error', (error) => {
                console.log('Warp connection not available:', error.message);
                this.isWarpConnected = false;
            });
        }
        catch (error) {
            console.log('Warp integration not available');
            this.isWarpConnected = false;
        }
    }
    detectLanguageFromCwd() {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace)
            return 'unknown';
        // Check for common project files
        const files = vscode.workspace.findFiles('**/{package.json,requirements.txt,Cargo.toml,go.mod}', null, 10);
        // This is simplified - in reality you'd check the actual files
        return 'javascript'; // Default assumption
    }
    onTerminalOpened(session) {
        vscode.window.showInformationMessage(`AI Mentor: Now monitoring terminal "${session.name}"`);
        if (this.isWarpConnected) {
            this.sendWarpMessage({
                type: 'terminal-opened',
                sessionId: session.id,
                name: session.name,
                cwd: session.cwd
            });
        }
    }
    onTerminalClosed(session) {
        if (this.isWarpConnected) {
            this.sendWarpMessage({
                type: 'terminal-closed',
                sessionId: session.id
            });
        }
    }
    sendWarpMessage(message) {
        if (this.warpSocket && this.isWarpConnected) {
            this.warpSocket.send(JSON.stringify(message));
        }
    }
    handleWarpMessage(message) {
        switch (message.type) {
            case 'command-executed':
                this.handleCommandExecution(message);
                break;
            case 'error-detected':
                this.handleErrorDetection(message);
                break;
            case 'directory-changed':
                this.handleDirectoryChange(message);
                break;
        }
    }
    handleCommandExecution(message) {
        const execution = {
            command: message.command,
            output: message.output,
            exitCode: message.exitCode,
            duration: message.duration,
            timestamp: new Date(message.timestamp)
        };
        this.commandHistory.push(execution);
        this.analyzeCommand(execution);
    }
    analyzeCommand(execution) {
        // Analyze the command for potential issues or suggestions
        const insights = this.getCommandInsights(execution);
        if (insights.length > 0) {
            this.showTerminalInsights(execution.command, insights);
        }
    }
    getCommandInsights(execution) {
        const insights = [];
        const cmd = execution.command.toLowerCase();
        // Common command analysis
        if (cmd.includes('npm install') && execution.exitCode !== 0) {
            insights.push('npm install failed. Check for network issues or package conflicts.');
        }
        if (cmd.includes('git push') && execution.output.includes('rejected')) {
            insights.push('Git push rejected. You may need to pull latest changes first.');
        }
        if (cmd.includes('python') && execution.output.includes('ModuleNotFoundError')) {
            insights.push('Python module not found. Consider using a virtual environment.');
        }
        if (cmd.includes('node') && execution.output.includes('ENOENT')) {
            insights.push('File not found error. Check if the file path is correct.');
        }
        // Performance insights
        if (execution.duration > 30000) { // 30 seconds
            insights.push(`Command took ${execution.duration / 1000}s. Consider optimizing or using alternatives.`);
        }
        // Security insights
        if (cmd.includes('sudo') && cmd.includes('curl')) {
            insights.push('⚠️ Security warning: Running curl with sudo can be dangerous.');
        }
        return insights;
    }
    showTerminalInsights(command, insights) {
        const message = `AI Mentor insights for "${command}":\n${insights.join('\n')}`;
        vscode.window.showInformationMessage('Terminal Command Analysis', 'View Details').then(selection => {
            if (selection === 'View Details') {
                vscode.window.showInformationMessage(message);
            }
        });
    }
    handleErrorDetection(message) {
        const errorAnalysis = this.analyzeError(message.error, message.context);
        vscode.window.showErrorMessage(`Terminal Error Detected: ${message.error}`, 'Get Help', 'Ignore').then(selection => {
            if (selection === 'Get Help') {
                this.showErrorGuidance(message.error, errorAnalysis);
            }
        });
    }
    analyzeError(error, context) {
        // Analyze common terminal errors and provide guidance
        if (error.includes('command not found')) {
            return 'The command is not installed or not in your PATH. Try installing it or check the spelling.';
        }
        if (error.includes('permission denied')) {
            return 'Permission error. You may need to use sudo or check file permissions.';
        }
        if (error.includes('No such file or directory')) {
            return 'File or directory not found. Check the path and ensure the file exists.';
        }
        if (error.includes('port') && error.includes('already in use')) {
            return 'Port is already in use. Try using a different port or kill the process using that port.';
        }
        return 'An error occurred. Check the command syntax and try again.';
    }
    showErrorGuidance(error, analysis) {
        const panel = vscode.window.createWebviewPanel('terminalErrorGuidance', 'Terminal Error Guidance', vscode.ViewColumn.Beside, { enableScripts: true });
        panel.webview.html = this.getErrorGuidanceHTML(error, analysis);
    }
    getErrorGuidanceHTML(error, analysis) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: var(--vscode-font-family); padding: 20px; }
                .error { background: #ff6b6b; color: white; padding: 10px; border-radius: 5px; }
                .analysis { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 10px 0; }
                .suggestions { background: #e3f2fd; padding: 15px; border-radius: 5px; }
            </style>
        </head>
        <body>
            <h2>🔧 Terminal Error Analysis</h2>
            <div class="error">
                <strong>Error:</strong> ${error}
            </div>
            <div class="analysis">
                <strong>Analysis:</strong> ${analysis}
            </div>
            <div class="suggestions">
                <strong>Suggestions:</strong>
                <ul>
                    <li>Double-check your command syntax</li>
                    <li>Verify file paths and permissions</li>
                    <li>Check if required dependencies are installed</li>
                    <li>Consider using the integrated terminal for better error handling</li>
                </ul>
            </div>
        </body>
        </html>`;
    }
    handleDirectoryChange(message) {
        const session = this.terminals.get(message.sessionId);
        if (session) {
            session.cwd = message.newPath;
            session.language = this.detectLanguageFromPath(message.newPath);
        }
    }
    detectLanguageFromPath(path) {
        if (path.includes('node_modules') || path.includes('package.json'))
            return 'javascript';
        if (path.includes('venv') || path.includes('requirements.txt'))
            return 'python';
        if (path.includes('target') || path.includes('Cargo.toml'))
            return 'rust';
        if (path.includes('go.mod'))
            return 'go';
        return 'unknown';
    }
    // Public methods for integration
    getActiveTerminals() {
        return Array.from(this.terminals.values()).filter(t => t.isActive);
    }
    getCommandHistory() {
        return this.commandHistory.slice(-50); // Last 50 commands
    }
    isConnectedToWarp() {
        return this.isWarpConnected;
    }
    async executeCommand(command, terminal) {
        const activeTerminal = terminal || vscode.window.activeTerminal;
        if (!activeTerminal) {
            const newTerminal = vscode.window.createTerminal('AI Mentor');
            newTerminal.sendText(command);
            newTerminal.show();
        }
        else {
            activeTerminal.sendText(command);
        }
    }
    dispose() {
        if (this.warpSocket) {
            this.warpSocket.close();
        }
    }
}
exports.TerminalIntegration = TerminalIntegration;
//# sourceMappingURL=terminalIntegration.js.map