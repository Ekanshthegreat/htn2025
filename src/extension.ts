import * as vscode from 'vscode';
import { AIMentorProvider } from './aiMentorProvider';
import { CodeWatcher } from './codeWatcher';
import { ASTAnalyzer } from './astAnalyzer';
import { LLMService } from './llmService';
import { VoiceService } from './voiceService';
import { GraphiteService } from './graphiteService';
import { ProfileManager } from './profileManager';
import { GitHubService } from './githubService';

let aiMentorProvider: AIMentorProvider;
let codeWatcher: CodeWatcher;
let astAnalyzer: ASTAnalyzer;
let llmService: LLMService;
let voiceService: VoiceService;
let graphiteService: GraphiteService;
let profileManager: ProfileManager;
let githubService: GitHubService;

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 AI Debugger Mentor is now active!');

    // Initialize services
    profileManager = new ProfileManager(context);
    githubService = new GitHubService();
    llmService = new LLMService(profileManager);
    astAnalyzer = new ASTAnalyzer();
    voiceService = new VoiceService();
    graphiteService = new GraphiteService();
    realtimeAnalyzer = new RealtimeAnalyzer(llmService, voiceService);
    codeWatcher = new CodeWatcher(astAnalyzer, llmService);
    aiMentorProvider = new AIMentorProvider(context.extensionUri, codeWatcher, llmService, profileManager);

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

    // Profile Management Commands
    const selectProfileCommand = vscode.commands.registerCommand('aiMentor.selectProfile', async () => {
        const profiles = profileManager.getAllProfiles();
        const activeProfile = profileManager.getActiveProfile();
        
        const items = profiles.map(profile => ({
            label: profile.name,
            description: `${profile.role} - ${profile.githubUsername || 'Built-in'}`,
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

        const roleItems = [
            { label: 'Boss', value: 'boss' as const },
            { label: 'Staff Engineer', value: 'staff-engineer' as const },
            { label: 'Senior Developer', value: 'senior-dev' as const },
            { label: 'Tech Lead', value: 'tech-lead' as const },
            { label: 'Mentor', value: 'mentor' as const },
            { label: 'Custom', value: 'custom' as const }
        ];

        const selectedRole = await vscode.window.showQuickPick(roleItems, {
            placeHolder: 'Select the mentor role'
        });

        if (!selectedRole) return;

        const profileId = `custom-${Date.now()}`;
        const defaultProfile = profileManager.getProfile('default')!;
        
        profileManager.addProfile({
            ...defaultProfile,
            id: profileId,
            name: name,
            role: selectedRole.value,
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

        const roleItems = [
            { label: 'Boss', value: 'boss' as const },
            { label: 'Staff Engineer', value: 'staff-engineer' as const },
            { label: 'Senior Developer', value: 'senior-dev' as const },
            { label: 'Tech Lead', value: 'tech-lead' as const },
            { label: 'Mentor', value: 'mentor' as const }
        ];

        const selectedRole = await vscode.window.showQuickPick(roleItems, {
            placeHolder: 'What role should this mentor have?'
        });

        if (!selectedRole) return;

        try {
            vscode.window.showInformationMessage(`Analyzing GitHub profile: ${username}...`);
            
            const profileData = await githubService.createProfileFromGitHub(username, selectedRole.value);
            const profileId = `github-${username}-${Date.now()}`;
            
            profileManager.addProfile({
                id: profileId,
                lastUpdated: new Date(),
                isActive: false,
                ...profileData
            } as any);

            vscode.window.showInformationMessage(`Successfully imported GitHub profile: ${username}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import GitHub profile: ${error}`);
        }
    });

    const manageProfilesCommand = vscode.commands.registerCommand('aiMentor.manageProfiles', async () => {
        const profiles = profileManager.getAllProfiles();
        const activeProfile = profileManager.getActiveProfile();
        
        const items = profiles.map(profile => ({
            label: profile.name,
            description: `${profile.role} - ${profile.githubUsername || 'Built-in'}`,
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
        startVoiceConversationCommand,
        startMultiModalAgentCommand,
        toggleVoiceCommand,
        toggleConversationalModeCommand,
        toggleRealtimeAnalysisCommand,
        showEngineeringReportCommand,
        analyzeEngineeringPracticesCommand,
        narrateEngineeringPracticesCommand,
        selectProfileCommand,
        createProfileCommand,
        importGithubProfileCommand,
        manageProfilesCommand
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
