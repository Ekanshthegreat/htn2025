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
import { MentorHoverProvider } from './hoverProvider';

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
let hoverProvider: MentorHoverProvider;

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
    realtimeAnalyzer = new RealtimeAnalyzer(llmService, voiceService, profileManager);
    codeWatcher = new CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new AIMentorProvider(context.extensionUri, codeWatcher, llmService, profileManager);
    hoverProvider = new MentorHoverProvider(profileManager, astAnalyzer);
    
    // Connect codeWatcher to aiMentorProvider for UI updates
    codeWatcher.setAIMentorProvider(aiMentorProvider);

    // Register the webview provider
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('aiMentorPanel', aiMentorProvider)
    );

    // Register hover provider for all supported languages
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
    supportedLanguages.forEach(language => {
        context.subscriptions.push(
            vscode.languages.registerHoverProvider(language, hoverProvider)
        );
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

    const createGitHubMentorCommand = vscode.commands.registerCommand('aiMentor.createGitHubMentor', async () => {
        const githubUsername = await vscode.window.showInputBox({
            prompt: 'Enter GitHub username to create mentor from',
            placeHolder: 'e.g., torvalds, gaearon, sindresorhus'
        });

        if (!githubUsername) return;

        try {
            vscode.window.showInformationMessage(`🔍 Analyzing GitHub profile: ${githubUsername}...`);
            
            const mentorProfile = await profileManager.createMentorFromGitHub(githubUsername);
            
            vscode.window.showInformationMessage(
                `✅ Created GitHub-based mentor: ${mentorProfile.name}!`,
                'Switch to Mentor'
            ).then(choice => {
                if (choice === 'Switch to Mentor') {
                    profileManager.setActiveProfile(mentorProfile.id);
                    vscode.window.showInformationMessage(`🎯 Now mentoring with ${mentorProfile.name}!`);
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create GitHub mentor: ${error.message}`);
        }
    });

    const createProfileCommand = vscode.commands.registerCommand('aiMentor.createProfile', async () => {
        const options = [
            {
                label: '$(github) Create from GitHub Profile',
                description: 'Analyze a GitHub profile to create a personalized mentor',
                action: 'github'
            },
            {
                label: '$(person) Create Custom Profile',
                description: 'Manually create a custom mentor profile',
                action: 'custom'
            }
        ];

        const selection = await vscode.window.showQuickPick(options, {
            placeHolder: 'How would you like to create a mentor profile?'
        });

        if (selection?.action === 'github') {
            vscode.commands.executeCommand('aiMentor.createGitHubMentor');
        } else if (selection?.action === 'custom') {
            const name = await vscode.window.showInputBox({
                prompt: 'Enter a name for the new mentor profile',
                placeHolder: 'e.g., Senior React Developer'
            });

            if (!name) return;

            const profileId = `custom-${Date.now()}`;
            const defaultProfile = profileManager.getProfile('marcus')!;
            
            profileManager.addProfile({
                ...defaultProfile,
                id: profileId,
                name: name,
                lastUpdated: new Date(),
                isActive: false
            });

            vscode.window.showInformationMessage(`Created new mentor profile: ${name}`);
        }
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
            
            vscode.window.showInformationMessage(
                `🎯 Mentor switched to ${selectedMentor?.name}! ${selectedMentor?.personality}`,
                'Start Mentoring'
            ).then(choice => {
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

    context.subscriptions.push(
        activateCommand,
        deactivateCommand,
        startDebuggingCommand,
        traceExecutionCommand,
        selectProfileCommand,
        createProfileCommand,
        createGitHubMentorCommand,
        selectMentorCommand,
        manageProfilesCommand
    );

    // Show welcome message with mentor selection
    vscode.window.showInformationMessage(
        'Welcome to AI Debugger Mentor! Choose your mentor personality to get started.',
        'Select Mentor'
    ).then(selection => {
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

function isSupportedLanguage(languageId: string): boolean {
    const supportedLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp'];
    return supportedLanguages.includes(languageId);
}

export function deactivate() {
    if (codeWatcher) {
        codeWatcher.deactivate();
    }
}
