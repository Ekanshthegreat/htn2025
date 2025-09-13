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
const realtimeAnalyzer_1 = require("./realtimeAnalyzer");
const profileManager_1 = require("./profileManager");
const githubService_1 = require("./githubService");
const genesysService_1 = require("./genesysService");
const hoverProvider_1 = require("./hoverProvider");
let aiMentorProvider;
let codeWatcher;
let astAnalyzer;
let llmService;
let voiceService;
let graphiteService;
let realtimeAnalyzer;
let profileManager;
let githubService;
let genesysService;
let hoverProvider;
function activate(context) {
    console.log('🚀 AI Debugger Mentor is now active!');
    // Initialize services
    profileManager = new profileManager_1.ProfileManager(context);
    githubService = new githubService_1.GitHubService();
    genesysService = new genesysService_1.GenesysService();
    llmService = new llmService_1.LLMService(profileManager);
    astAnalyzer = new astAnalyzer_1.ASTAnalyzer();
    voiceService = new voiceService_1.VoiceService();
    graphiteService = new graphiteService_1.GraphiteService();
    realtimeAnalyzer = new realtimeAnalyzer_1.RealtimeAnalyzer(llmService, voiceService, profileManager);
    codeWatcher = new codeWatcher_1.CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new aiMentorProvider_1.AIMentorProvider(context.extensionUri, codeWatcher, llmService, profileManager);
    hoverProvider = new hoverProvider_1.MentorHoverProvider(profileManager, astAnalyzer);
    // Connect codeWatcher to aiMentorProvider for UI updates
    codeWatcher.setAIMentorProvider(aiMentorProvider);
    // Register the webview provider
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('aiMentorPanel', aiMentorProvider));
    // Register hover provider for all supported languages
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
    supportedLanguages.forEach(language => {
        context.subscriptions.push(vscode.languages.registerHoverProvider(language, hoverProvider));
    });
    // Register commands
    const activateCommand = vscode.commands.registerCommand('aiMentor.activate', () => {
        const activeProfile = profileManager.getActiveProfile();
        codeWatcher.activate();
        vscode.window.showInformationMessage(`${activeProfile.name} is now mentoring you! I'm watching your code.`);
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
    // Profile Management Commands
    const selectProfileCommand = vscode.commands.registerCommand('aiMentor.selectProfile', async () => {
        const profiles = profileManager.getAllProfiles();
        const activeProfile = profileManager.getActiveProfile();
        const items = profiles.map(profile => ({
            label: profile.name,
            description: profile.githubUsername || 'Built-in',
            detail: profile.id === activeProfile.id ? '$(check) Currently Active' : '',
            profile: profile
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a mentor profile',
            matchOnDescription: true
        });
        if (selected && selected.profile.id !== activeProfile.id) {
            await profileManager.setActiveProfile(selected.profile.id);
            vscode.window.showInformationMessage(`Switched to mentor profile: ${selected.profile.name}`);
        }
    });
    const createProfileCommand = vscode.commands.registerCommand('aiMentor.createProfile', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for the new mentor profile',
            placeHolder: 'e.g., Senior React Developer'
        });
        if (!name)
            return;
        const profileId = `custom-${Date.now()}`;
        const defaultProfile = profileManager.getProfile('default');
        profileManager.addProfile({
            ...defaultProfile,
            id: profileId,
            name: name,
            lastUpdated: new Date(),
            isActive: false
        });
        vscode.window.showInformationMessage(`Created new mentor profile: ${name}`);
    });
    const selectMentorCommand = vscode.commands.registerCommand('aiMentor.selectMentor', async () => {
        const mentors = profileManager.getAvailableMentors();
        const activeProfile = profileManager.getActiveProfile();
        const items = mentors.map(mentor => ({
            label: `${mentor.avatar} ${mentor.name}`,
            description: mentor.personality,
            detail: mentor.id === activeProfile.id ? '✅ Currently Active' : '',
            mentorId: mentor.id
        }));
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: 'Choose your coding mentor',
            title: 'Select AI Mentor Personality'
        });
        if (selection) {
            await profileManager.setActiveProfile(selection.mentorId);
            const selectedMentor = mentors.find(m => m.id === selection.mentorId);
            vscode.window.showInformationMessage(`🎯 Mentor switched to ${selectedMentor?.name}! ${selectedMentor?.personality}`, 'Start Mentoring').then(choice => {
                if (choice === 'Start Mentoring') {
                    vscode.commands.executeCommand('aiMentor.activate');
                }
            });
        }
    });
    const manageProfilesCommand = vscode.commands.registerCommand('aiMentor.manageProfiles', async () => {
        const profiles = profileManager.getAllProfiles();
        const activeProfile = profileManager.getActiveProfile();
        console.log('Debug: Found profiles:', profiles.length);
        console.log('Debug: Profile details:', profiles.map(p => ({ id: p.id, name: p.name })));
        if (profiles.length === 0) {
            vscode.window.showInformationMessage('No profiles found. Try importing a GitHub profile first.');
            return;
        }
        const items = profiles.map(profile => ({
            label: profile.name,
            description: profile.githubUsername || 'Built-in',
            detail: profile.id === activeProfile.id ? '$(check) Active' : '',
            buttons: profile.id !== 'default' ? [
                {
                    iconPath: new vscode.ThemeIcon('trash'),
                    tooltip: 'Delete Profile'
                }
            ] : undefined,
            profile: profile
        }));
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Manage mentor profiles (Select to activate, click trash to delete)',
            matchOnDescription: true
        });
        if (selected) {
            if (selected.profile.id !== activeProfile.id) {
                await profileManager.setActiveProfile(selected.profile.id);
                vscode.window.showInformationMessage(`Activated profile: ${selected.profile.name}`);
            }
        }
    });
    context.subscriptions.push(activateCommand, deactivateCommand, startDebuggingCommand, traceExecutionCommand, selectProfileCommand, createProfileCommand, selectMentorCommand, manageProfilesCommand);
    // Show welcome message with mentor selection
    vscode.window.showInformationMessage('Welcome to AI Debugger Mentor! Choose your mentor personality to get started.', 'Select Mentor').then(selection => {
        if (selection === 'Select Mentor') {
            vscode.commands.executeCommand('aiMentor.selectMentor');
        }
    });
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