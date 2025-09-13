import * as vscode from 'vscode';
import { AIMentorProvider } from './aiMentorProvider';
import { CodeWatcher } from './codeWatcher';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import { VoiceService } from './voiceService';
import { GraphiteService } from './graphiteService';
import { RealtimeAnalyzer } from './realtimeAnalyzer';
import { ProfileManager } from './profileManager';
import { GitHubService } from './githubService';
import { GenesysService } from './genesysService';

let aiMentorProvider: AIMentorProvider;
let codeWatcher: CodeWatcher;
let astAnalyzer: ASTAnalyzer;
let llmService: LLMService;
let voiceService: VoiceService;
let graphiteService: GraphiteService;
let realtimeAnalyzer: RealtimeAnalyzer;
let profileManager: ProfileManager;
let githubService: GitHubService;
let genesysService: GenesysService;

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 AI Debugger Mentor is now active!');

    // Initialize services
    profileManager = new ProfileManager(context);
    githubService = new GitHubService();
    genesysService = new GenesysService();
    llmService = new LLMService(profileManager);
    astAnalyzer = new ASTAnalyzer();
    voiceService = new VoiceService();
    graphiteService = new GraphiteService();
    realtimeAnalyzer = new RealtimeAnalyzer(llmService, voiceService);
    codeWatcher = new CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new AIMentorProvider(context.extensionUri, codeWatcher, llmService, profileManager);
    
    // Connect codeWatcher to aiMentorProvider for UI updates
    codeWatcher.setAIMentorProvider(aiMentorProvider);

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

        if (!name) return;

        const profileId = `custom-${Date.now()}`;
        const defaultProfile = profileManager.getProfile('default')!;
        
        profileManager.addProfile({
            ...defaultProfile,
            id: profileId,
            name: name,
            lastUpdated: new Date(),
            isActive: false
        });

        vscode.window.showInformationMessage(`Created new mentor profile: ${name}`);
    });

    const importGithubProfileCommand = vscode.commands.registerCommand('aiMentor.importGithubProfile', async () => {
        const username = await vscode.window.showInputBox({
            prompt: 'Enter GitHub username to import',
            placeHolder: 'e.g., octocat'
        });

        if (!username) return;

        try {
            vscode.window.showInformationMessage(`Analyzing GitHub profile: ${username}...`);
            
            // Get GitHub data from GitHubService
            const githubData = await githubService.analyzeProfile(username);
            console.log('Debug: GitHub data received:', githubData);
            
            // Use ProfileManager's new method that integrates with Genesys
            const profileId = await profileManager.createProfileFromGitHub(username, githubData);
            console.log('Debug: Profile created with ID:', profileId);
            
            // Verify profile was saved
            const savedProfile = profileManager.getProfile(profileId);
            console.log('Debug: Saved profile:', savedProfile ? 'Found' : 'Not found');
            
            vscode.window.showInformationMessage(
                `GitHub profile imported with empathy analysis! Profile ID: ${profileId}`,
                'Set as Active', 'View Profiles'
            ).then(selection => {
                if (selection === 'Set as Active') {
                    profileManager.setActiveProfile(profileId);
                    vscode.window.showInformationMessage(`Active profile set to: ${username}`);
                } else if (selection === 'View Profiles') {
                    vscode.commands.executeCommand('aiMentor.manageProfiles');
                }
            });
        } catch (error) {
            console.error('Debug: GitHub import error:', error);
            vscode.window.showErrorMessage(`Failed to import GitHub profile: ${error}`);
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

    context.subscriptions.push(
        activateCommand,
        deactivateCommand,
        startDebuggingCommand,
        traceExecutionCommand,
        selectProfileCommand,
        createProfileCommand,
        importGithubProfileCommand,
        manageProfilesCommand
    );

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
