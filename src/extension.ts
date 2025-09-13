import * as vscode from 'vscode';
import { AIMentorProvider } from './aiMentorProvider';
import { CodeWatcher } from './codeWatcher';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import { VoiceService } from './voiceService';
import { GraphiteService } from './graphiteService';
import { RealtimeAnalyzer } from './realtimeAnalyzer';

let aiMentorProvider: AIMentorProvider;
let codeWatcher: CodeWatcher;
let astAnalyzer: ASTAnalyzer;
let llmService: LLMService;
let voiceService: VoiceService;
let graphiteService: GraphiteService;
let realtimeAnalyzer: RealtimeAnalyzer;

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 AI Debugger Mentor is now active!');

    // Initialize services
    llmService = new LLMService();
    astAnalyzer = new ASTAnalyzer();
    voiceService = new VoiceService();
    graphiteService = new GraphiteService();
    realtimeAnalyzer = new RealtimeAnalyzer(llmService, voiceService);
    codeWatcher = new CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new AIMentorProvider(context.extensionUri, codeWatcher, llmService);
    
    // Debug: Confirm all services initialized
    console.log('🔧 All services initialized, including Nikola real-time analyzer');

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('aiMentorPanel', aiMentorProvider)
    );

    // Register commands
    const activateCommand = vscode.commands.registerCommand('aiMentor.activate', () => {
        codeWatcher.activate();
        vscode.commands.executeCommand('setContext', 'aiMentor.active', true);
        vscode.window.showInformationMessage('AI Mentor activated! I\'m now watching your code.');
    });

    const deactivateCommand = vscode.commands.registerCommand('aiMentor.deactivate', () => {
        codeWatcher.deactivate();
        vscode.commands.executeCommand('setContext', 'aiMentor.active', false);
        vscode.window.showInformationMessage('AI Mentor deactivated.');
    });

    const startDebuggingCommand = vscode.commands.registerCommand('aiMentor.startDebugging', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor found. Please open a file to debug.');
            return;
        }

        const document = activeEditor.document;
        const selection = activeEditor.selection;
        
        // Get selected text or entire document
        const code = selection.isEmpty ? document.getText() : document.getText(selection);
        
        await codeWatcher.startGuidedDebugging(code, document.languageId);
    });

    const traceExecutionCommand = vscode.commands.registerCommand('aiMentor.traceExecution', async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor found. Please open a file to trace.');
            return;
        }

        const document = activeEditor.document;
        await codeWatcher.startExecutionTrace(document.getText(), document.languageId);
    });

    // New VAPI Voice AI Commands
    const startVoiceConversationCommand = vscode.commands.registerCommand('aiMentor.startVoiceConversation', async () => {
        await voiceService.startConversationalDebugging();
    });

    const startMultiModalAgentCommand = vscode.commands.registerCommand('aiMentor.startMultiModalAgent', async () => {
        await voiceService.startMultiModalAgent();
    });

    const toggleVoiceCommand = vscode.commands.registerCommand('aiMentor.toggleVoice', async () => {
        await voiceService.toggleVoice();
    });

    const toggleConversationalModeCommand = vscode.commands.registerCommand('aiMentor.toggleConversationalMode', async () => {
        await voiceService.toggleConversationalMode();
    });

    // Register real-time analysis toggle
    const toggleRealtimeAnalysisCommand = vscode.commands.registerCommand('aiMentor.toggleRealtimeAnalysis', () => {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const enabled = config.get<boolean>('realtimeAnalysis', true);
        config.update('realtimeAnalysis', !enabled, vscode.ConfigurationTarget.Global);
        
        if (!enabled) {
            // Enable real-time analysis
            realtimeAnalyzer.enable();
            vscode.window.showInformationMessage('🤖 AI Mentor real-time analysis ENABLED - watching your code!');
        } else {
            // Disable real-time analysis
            realtimeAnalyzer.disable();
            vscode.window.showInformationMessage('⏸️ AI Mentor real-time analysis DISABLED');
        }
    });

    // Register engineering practices commands
    const showEngineeringReportCommand = vscode.commands.registerCommand('aiMentor.showEngineeringReport', async () => {
        try {
            const report = await graphiteService.generateEngineeringReport();
            const panel = vscode.window.createWebviewPanel(
                'engineeringReport',
                '📊 Engineering Practices Report',
                vscode.ViewColumn.One,
                { enableScripts: true }
            );
            panel.webview.html = report;
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate engineering report: ${error}`);
        }
    });

    const analyzeEngineeringPracticesCommand = vscode.commands.registerCommand('aiMentor.analyzeEngineeringPractices', async () => {
        const practices = await graphiteService.analyzeEngineeringPractices();
        const implementedCount = practices.filter(p => p.implemented).length;
        vscode.window.showInformationMessage(
            `Engineering Analysis: ${implementedCount}/${practices.length} practices implemented. Use "Show Engineering Report" for details.`
        );
    });

    const narrateEngineeringPracticesCommand = vscode.commands.registerCommand('aiMentor.narrateEngineeringPractices', async () => {
        const narrations = await graphiteService.narrateEngineeringPractices();
        for (const narration of narrations) {
            await voiceService.narrateCodeFlow(narration, 'explanation');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between narrations
        }
    });

    context.subscriptions.push(
        activateCommand,
        deactivateCommand,
        startDebuggingCommand,
        traceExecutionCommand,
        startVoiceConversationCommand,
        startMultiModalAgentCommand,
        toggleVoiceCommand,
        toggleConversationalModeCommand,
        toggleRealtimeAnalysisCommand,
        showEngineeringReportCommand,
        analyzeEngineeringPracticesCommand
    );
    context.subscriptions.push(narrateEngineeringPracticesCommand);

    // Auto-activate on supported languages
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isSupportedLanguage(activeEditor.document.languageId)) {
        vscode.commands.executeCommand('aiMentor.activate');
    }
}

function isSupportedLanguage(languageId: string): boolean {
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
    return supportedLanguages.includes(languageId);
}

export function deactivate() {
    if (codeWatcher) {
        codeWatcher.deactivate();
    }
}
