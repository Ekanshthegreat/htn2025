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
import { notificationService } from './notificationService';
import { interactionTracker } from './interactionTracker';

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
    llmService = new LLMService(profileManager);
    astAnalyzer = new ASTAnalyzer();
    voiceService = new VoiceService();
    graphiteService = new GraphiteService();
    githubService = new GitHubService();
    genesysService = new GenesysService();
    hoverProvider = new MentorHoverProvider(profileManager, astAnalyzer);
    
    // Initialize RealtimeAnalyzer for blue squiggles with mentor persona
    realtimeAnalyzer = new RealtimeAnalyzer(profileManager);
    
    // Initialize CodeWatcher for chat panel messages only
    codeWatcher = new CodeWatcher(astAnalyzer, llmService, profileManager);
    
    // Initialize AI Mentor Provider with proper CodeWatcher connection
    aiMentorProvider = new AIMentorProvider(context.extensionUri, codeWatcher, llmService, profileManager);
    
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
        if (activeProfile) {
            vscode.window.showInformationMessage(`${activeProfile.name} is now mentoring you! I'm watching your code.`);
        } else {
            vscode.window.showInformationMessage('AI Mentor activated! Create a GitHub-based mentor profile for personalized guidance.');
        }
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
        
        if (profiles.length === 0) {
            const choice = await vscode.window.showInformationMessage(
                'No mentor profiles found. Would you like to create one from a GitHub profile?',
                'Create GitHub Mentor'
            );
            if (choice === 'Create GitHub Mentor') {
                vscode.commands.executeCommand('aiMentor.createGitHubMentor');
            }
            return;
        }
        
        const items = profiles.map(profile => ({
            label: profile.name,
            description: profile.githubUsername ? `GitHub: ${profile.githubUsername}` : 'Custom',
            detail: activeProfile && profile.id === activeProfile.id ? '$(check) Currently Active' : '',
            profile: profile
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a mentor profile',
            matchOnDescription: true
        });

        if (selected && (!activeProfile || selected.profile.id !== activeProfile.id)) {
            await profileManager.setActiveProfile(selected.profile.id);
            vscode.window.showInformationMessage(`Switched to mentor profile: ${selected.profile.name}`);
            // Update the webview
            aiMentorProvider.updateWebview();
        }
    });

    const createGitHubMentorCommand = vscode.commands.registerCommand('aiMentor.createGitHubMentor', async () => {
        const githubUsername = await vscode.window.showInputBox({
            prompt: 'Enter GitHub username to create mentor from',
            placeHolder: 'e.g., torvalds, gaearon, sindresorhus'
        });

        if (!githubUsername) return;

        const email = await vscode.window.showInputBox({
            prompt: 'Enter contact email for the mentor (optional)',
            placeHolder: 'e.g., mentor@example.com'
        });

        try {
            vscode.window.showInformationMessage(`🔍 Analyzing GitHub profile: ${githubUsername}...`);
            
            const mentorProfile = await profileManager.createMentorFromGitHub(githubUsername, email || undefined);
            
            vscode.window.showInformationMessage(
                `✅ Created GitHub-based mentor: ${mentorProfile.name}!`,
                'Switch to Mentor'
            ).then(choice => {
                if (choice === 'Switch to Mentor') {
                    profileManager.setActiveProfile(mentorProfile.id);
                    vscode.window.showInformationMessage(`🎯 Now mentoring with ${mentorProfile.name}!`);
                    // Update the webview
                    aiMentorProvider.updateWebview();
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create GitHub mentor: ${error.message}`);
        }
    });



    const manageProfilesCommand = vscode.commands.registerCommand('aiMentor.manageProfiles', async () => {
        const profiles = profileManager.getAllProfiles();
        const activeProfile = profileManager.getActiveProfile();
        
        console.log('Managing profiles. Found:', profiles.length, 'profiles');
        
        if (profiles.length === 0) {
            const choice = await vscode.window.showInformationMessage(
                'No mentor profiles found. Would you like to create one from a GitHub profile?',
                'Create GitHub Mentor'
            );
            if (choice === 'Create GitHub Mentor') {
                vscode.commands.executeCommand('aiMentor.createGitHubMentor');
            }
            return;
        }
        
        // Create management options
        const managementOptions = [
            {
                label: '$(add) Create New GitHub Mentor',
                description: 'Create a new mentor from a GitHub profile',
                action: 'create'
            },
            {
                label: '$(trash) Delete Mentor Profile',
                description: 'Delete an existing mentor profile',
                action: 'delete'
            },
            {
                label: '$(arrow-right) Switch Active Profile',
                description: 'Change the currently active mentor',
                action: 'switch'
            }
        ];
        
        const selectedAction = await vscode.window.showQuickPick(managementOptions, {
            placeHolder: 'What would you like to do?',
            title: 'Manage Mentor Profiles'
        });
        
        if (!selectedAction) return;
        
        switch (selectedAction.action) {
            case 'create':
                vscode.commands.executeCommand('aiMentor.createGitHubMentor');
                break;
                
            case 'delete':
                await handleProfileDeletion(profiles, profileManager, aiMentorProvider);
                break;
                
            case 'switch':
                await handleProfileSwitch(profiles, activeProfile, profileManager, aiMentorProvider);
                break;
        }
    });
    
    async function handleProfileDeletion(profiles: any[], profileManager: any, aiMentorProvider: any) {
        const deleteItems = profiles.map(profile => ({
            label: `$(trash) ${profile.name}`,
            description: profile.githubUsername ? `GitHub: ${profile.githubUsername}` : 'Custom',
            detail: profile.id,
            profile: profile
        }));
        
        const toDelete = await vscode.window.showQuickPick(deleteItems, {
            placeHolder: 'Select a mentor profile to delete',
            title: 'Delete Mentor Profile'
        });
        
        if (toDelete) {
            const confirmed = await vscode.window.showWarningMessage(
                `Are you sure you want to delete "${toDelete.profile.name}"?`,
                { modal: true },
                'Delete'
            );
            
            if (confirmed === 'Delete') {
                const success = profileManager.deleteProfile(toDelete.profile.id);
                if (success) {
                    vscode.window.showInformationMessage(`Deleted mentor profile: ${toDelete.profile.name}`);
                    aiMentorProvider.updateWebview();
                } else {
                    vscode.window.showErrorMessage('Failed to delete profile');
                }
            }
        }
    }
    
    const analyzeCodeCommand = vscode.commands.registerCommand('aiMentor.analyzeCode', () => {
        aiMentorProvider.addCodeAnalysis();
        vscode.window.showInformationMessage('Analyzing your code with AI...');
    });

    const sendSummaryCommand = vscode.commands.registerCommand('aiMentor.sendSummary', async () => {
        const activeProfile = profileManager.getActiveProfile();

        if (!activeProfile) {
            vscode.window.showWarningMessage('No active mentor profile. Cannot send summary.');
            return;
        }

        if (!activeProfile.contactEmail) {
            vscode.window.showWarningMessage(`Mentor profile '${activeProfile.name}' does not have a contact email configured.`);
            return;
        }

        const summary = interactionTracker.generateSummary(activeProfile.id);
        if (summary.includes('No interactions recorded')) {
            vscode.window.showInformationMessage('No interactions to summarize for the current session.');
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Sending interaction summary to ${activeProfile.name}...`,
            cancellable: false
        }, async (progress) => {
            const html = interactionTracker.generateSummaryHtml(activeProfile.id, activeProfile.name);
            const previewUrl = await notificationService.sendSummaryRich(activeProfile.contactEmail!, html, activeProfile.name);

            if (previewUrl) {
                if (previewUrl === 'success') {
                    vscode.window.showInformationMessage(`✅ Summary sent successfully to ${activeProfile.contactEmail}!`);
                } else {
                    vscode.window.showInformationMessage(`Summary sent! Preview it here: ${previewUrl}`, 'Open Preview').then(choice => {
                        if (choice === 'Open Preview') {
                            vscode.env.openExternal(vscode.Uri.parse(previewUrl));
                        }
                    });
                }
                interactionTracker.clearInteractionsForMentor(activeProfile.id);
            } else {
                vscode.window.showErrorMessage('Failed to send summary email. Check the console for details.');
            }
        });
    });

    async function handleProfileSwitch(profiles: any[], activeProfile: any, profileManager: any, aiMentorProvider: any) {
        const switchItems = profiles.map(profile => ({
            label: profile.name,
            description: profile.githubUsername ? `GitHub: ${profile.githubUsername}` : 'Custom',
            detail: activeProfile && profile.id === activeProfile.id ? '$(check) Currently Active' : '',
            profile: profile
        }));
        
        const selected = await vscode.window.showQuickPick(switchItems, {
            placeHolder: 'Select a mentor profile to activate',
            title: 'Switch Mentor Profile'
        });
        
        if (selected && (!activeProfile || selected.profile.id !== activeProfile.id)) {
            await profileManager.setActiveProfile(selected.profile.id);
            vscode.window.showInformationMessage(`Switched to mentor profile: ${selected.profile.name}`);
            aiMentorProvider.updateWebview();
        }
    }

    const configureEmailCommand = vscode.commands.registerCommand('aiMentor.configureEmail', async () => {
        // Auto-configure with provided credentials
        const email = 'kevkolyakov@gmail.com';
        const appPassword = 'ecia zhoz abwp disi';

        // Update VS Code settings
        const config = vscode.workspace.getConfiguration('aiMentor');
        await config.update('smtpHost', 'smtp.gmail.com', vscode.ConfigurationTarget.Global);
        await config.update('smtpPort', 587, vscode.ConfigurationTarget.Global);
        await config.update('smtpSecure', false, vscode.ConfigurationTarget.Global);
        await config.update('smtpUser', email, vscode.ConfigurationTarget.Global);
        await config.update('smtpPass', appPassword, vscode.ConfigurationTarget.Global);
        await config.update('smtpFrom', `"AI Mentor" <${email}>`, vscode.ConfigurationTarget.Global);

        vscode.window.showInformationMessage('✅ Gmail SMTP configured! Emails will now be sent to real recipients.');
        
        // Force recreate the transporter with new settings
        notificationService.setupTransporter();
    });

    context.subscriptions.push(
        activateCommand,
        deactivateCommand,
        startDebuggingCommand,
        traceExecutionCommand,
        selectProfileCommand,
        createGitHubMentorCommand,
        manageProfilesCommand,
        analyzeCodeCommand,
        sendSummaryCommand,
        configureEmailCommand
    );
    
    // Add logging for profile manager initialization
    console.log('ProfileManager initialized with', profileManager.getAllProfiles().length, 'profiles');
    const startupActiveProfile = profileManager.getActiveProfile();
    if (startupActiveProfile) {
        console.log('Active profile on startup:', startupActiveProfile.name, '(ID:', startupActiveProfile.id, ')');
    } else {
        console.log('No active profile on startup');
    }

    // Show welcome message with mentor creation
    if (!startupActiveProfile) {
        vscode.window.showInformationMessage(
            'Welcome to AI Debugger Mentor! Create a GitHub-based mentor to get started.',
            'Create GitHub Mentor'
        ).then(selection => {
            if (selection === 'Create GitHub Mentor') {
                vscode.commands.executeCommand('aiMentor.createGitHubMentor');
            }
        });
    }

    // Auto-activate CodeWatcher on extension startup
    console.log('🔧 Auto-activating CodeWatcher for comprehensive AI flow logging...');
    codeWatcher.activate();
    
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
