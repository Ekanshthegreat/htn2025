import * as vscode from 'vscode';
import * as WebSocket from 'ws';

export interface TerminalSession {
    id: string;
    name: string;
    cwd: string;
    language: string;
    isActive: boolean;
}

export interface CommandExecution {
    command: string;
    output: string;
    exitCode: number;
    duration: number;
    timestamp: Date;
}

export class TerminalIntegration {
    private terminals: Map<string, TerminalSession> = new Map();
    private commandHistory: CommandExecution[] = [];
    private warpSocket: WebSocket | null = null;
    private isWarpConnected = false;

    constructor() {
        this.setupTerminalWatching();
        this.attemptWarpConnection();
    }

    private setupTerminalWatching() {
        // Watch for new terminals
        vscode.window.onDidOpenTerminal(terminal => {
            const session: TerminalSession = {
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

    private attemptWarpConnection() {
        // Try to connect to Warp's WebSocket API if available
        try {
            // Warp typically runs on localhost with a specific port
            const warpPort = 8080; // This would need to be configured
            this.warpSocket = new WebSocket(`ws://localhost:${warpPort}/ai-mentor`);
            
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

        } catch (error) {
            console.log('Warp integration not available');
            this.isWarpConnected = false;
        }
    }

    private detectLanguageFromCwd(): string {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) return 'unknown';

        // Check for common project files
        const files = vscode.workspace.findFiles('**/{package.json,requirements.txt,Cargo.toml,go.mod}', null, 10);
        // This is simplified - in reality you'd check the actual files
        return 'javascript'; // Default assumption
    }

    private onTerminalOpened(session: TerminalSession) {
        vscode.window.showInformationMessage(
            `AI Mentor: Now monitoring terminal "${session.name}"`
        );

        if (this.isWarpConnected) {
            this.sendWarpMessage({
                type: 'terminal-opened',
                sessionId: session.id,
                name: session.name,
                cwd: session.cwd
            });
        }
    }

    private onTerminalClosed(session: TerminalSession) {
        if (this.isWarpConnected) {
            this.sendWarpMessage({
                type: 'terminal-closed',
                sessionId: session.id
            });
        }
    }

    private sendWarpMessage(message: any) {
        if (this.warpSocket && this.isWarpConnected) {
            this.warpSocket.send(JSON.stringify(message));
        }
    }

    private handleWarpMessage(message: any) {
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

    private handleCommandExecution(message: any) {
        const execution: CommandExecution = {
            command: message.command,
            output: message.output,
            exitCode: message.exitCode,
            duration: message.duration,
            timestamp: new Date(message.timestamp)
        };

        this.commandHistory.push(execution);
        this.analyzeCommand(execution);
    }

    private analyzeCommand(execution: CommandExecution) {
        // Analyze the command for potential issues or suggestions
        const insights = this.getCommandInsights(execution);
        
        if (insights.length > 0) {
            this.showTerminalInsights(execution.command, insights);
        }
    }

    private getCommandInsights(execution: CommandExecution): string[] {
        const insights: string[] = [];
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
            insights.push(`Command took ${execution.duration/1000}s. Consider optimizing or using alternatives.`);
        }

        // Security insights
        if (cmd.includes('sudo') && cmd.includes('curl')) {
            insights.push('⚠️ Security warning: Running curl with sudo can be dangerous.');
        }

        return insights;
    }

    private showTerminalInsights(command: string, insights: string[]) {
        const message = `AI Mentor insights for "${command}":\n${insights.join('\n')}`;
        
        vscode.window.showInformationMessage(
            'Terminal Command Analysis',
            'View Details'
        ).then(selection => {
            if (selection === 'View Details') {
                vscode.window.showInformationMessage(message);
            }
        });
    }

    private handleErrorDetection(message: any) {
        const errorAnalysis = this.analyzeError(message.error, message.context);
        
        vscode.window.showErrorMessage(
            `Terminal Error Detected: ${message.error}`,
            'Get Help',
            'Ignore'
        ).then(selection => {
            if (selection === 'Get Help') {
                this.showErrorGuidance(message.error, errorAnalysis);
            }
        });
    }

    private analyzeError(error: string, context: any): string {
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

    private showErrorGuidance(error: string, analysis: string) {
        const panel = vscode.window.createWebviewPanel(
            'terminalErrorGuidance',
            'Terminal Error Guidance',
            vscode.ViewColumn.Beside,
            { enableScripts: true }
        );

        panel.webview.html = this.getErrorGuidanceHTML(error, analysis);
    }

    private getErrorGuidanceHTML(error: string, analysis: string): string {
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

    private handleDirectoryChange(message: any) {
        const session = this.terminals.get(message.sessionId);
        if (session) {
            session.cwd = message.newPath;
            session.language = this.detectLanguageFromPath(message.newPath);
        }
    }

    private detectLanguageFromPath(path: string): string {
        if (path.includes('node_modules') || path.includes('package.json')) return 'javascript';
        if (path.includes('venv') || path.includes('requirements.txt')) return 'python';
        if (path.includes('target') || path.includes('Cargo.toml')) return 'rust';
        if (path.includes('go.mod')) return 'go';
        return 'unknown';
    }

    // Public methods for integration
    public getActiveTerminals(): TerminalSession[] {
        return Array.from(this.terminals.values()).filter(t => t.isActive);
    }

    public getCommandHistory(): CommandExecution[] {
        return this.commandHistory.slice(-50); // Last 50 commands
    }

    public isConnectedToWarp(): boolean {
        return this.isWarpConnected;
    }

    public async executeCommand(command: string, terminal?: vscode.Terminal): Promise<void> {
        const activeTerminal = terminal || vscode.window.activeTerminal;
        
        if (!activeTerminal) {
            const newTerminal = vscode.window.createTerminal('AI Mentor');
            newTerminal.sendText(command);
            newTerminal.show();
        } else {
            activeTerminal.sendText(command);
        }
    }

    public dispose() {
        if (this.warpSocket) {
            this.warpSocket.close();
        }
    }
}
