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
exports.deactivate = exports.activate = void 0;
const vscode = __importStar(require("vscode"));
const aiMentorProvider_1 = require("./aiMentorProvider");
const codeWatcher_1 = require("./codeWatcher");
const astAnalyzer_1 = require("./astAnalyzer");
const llmService_1 = require("./llmService");
const voiceService_1 = require("./voiceService");
const graphiteService_1 = require("./graphiteService");
let aiMentorProvider;
let codeWatcher;
let astAnalyzer;
let llmService;
let voiceService;
let graphiteService;
function activate(context) {
    console.log('AI Debugger Mentor is now active!');
    // Initialize services
    llmService = new llmService_1.LLMService();
    astAnalyzer = new astAnalyzer_1.ASTAnalyzer();
    voiceService = new voiceService_1.VoiceService();
    graphiteService = new graphiteService_1.GraphiteService();
    codeWatcher = new codeWatcher_1.CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new aiMentorProvider_1.AIMentorProvider(context.extensionUri, codeWatcher, llmService);
    // Register the webview provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('aiMentorPanel', aiMentorProvider));
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
    // New Graphite Engineering Commands
    const showEngineeringReportCommand = vscode.commands.registerCommand('aiMentor.showEngineeringReport', async () => {
        await graphiteService.showEngineeringReport();
    });
    const analyzeEngineeringPracticesCommand = vscode.commands.registerCommand('aiMentor.analyzeEngineeringPractices', async () => {
        const practices = await graphiteService.analyzeEngineeringPractices();
        const implementedCount = practices.filter(p => p.implemented).length;
        vscode.window.showInformationMessage(`Engineering Analysis: ${implementedCount}/${practices.length} practices implemented. Use "Show Engineering Report" for details.`);
    });
    const narrateEngineeringPracticesCommand = vscode.commands.registerCommand('aiMentor.narrateEngineeringPractices', async () => {
        const narrations = await graphiteService.narrateEngineeringPractices();
        for (const narration of narrations) {
            await voiceService.narrateCodeFlow(narration, 'explanation');
            await new Promise(resolve => setTimeout(resolve, 2000)); // Pause between narrations
        }
    });
    context.subscriptions.push(activateCommand, deactivateCommand, startDebuggingCommand, traceExecutionCommand, startVoiceConversationCommand, startMultiModalAgentCommand, toggleVoiceCommand, toggleConversationalModeCommand, showEngineeringReportCommand, analyzeEngineeringPracticesCommand, narrateEngineeringPracticesCommand);
    // Auto-activate on supported languages
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && isSupportedLanguage(activeEditor.document.languageId)) {
        vscode.commands.executeCommand('aiMentor.activate');
    }
}
exports.activate = activate;
function isSupportedLanguage(languageId) {
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
    return supportedLanguages.includes(languageId);
}
function deactivate() {
    if (codeWatcher) {
        codeWatcher.deactivate();
    }
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map