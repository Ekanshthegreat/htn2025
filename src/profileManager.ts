import * as vscode from 'vscode';
import { GenesysService } from './genesysService';

export interface CodeStylePreferences {
    indentStyle: 'tabs' | 'spaces';
    indentSize: number;
    maxLineLength: number;
    preferredQuotes: 'single' | 'double';
    semicolons: boolean;
    trailingCommas: boolean;
    bracketSpacing: boolean;
}

export interface MentorPersonality {
    communicationStyle: 'direct' | 'supportive' | 'detailed' | 'concise';
    feedbackApproach: 'encouraging' | 'critical' | 'analytical' | 'pragmatic';
    expertise: string[];
    focusAreas: string[];
    responseLength: 'brief' | 'moderate' | 'detailed';
}

export interface MentorProfile {
    id: string;
    name: string;
    githubUsername?: string;
    avatar?: string;
    personality: MentorPersonality;
    codeStylePreferences: CodeStylePreferences;
    prompts: {
        systemPrompt: string;
        reviewPrompt: string;
        debuggingPrompt: string;
        explanationPrompt: string;
    };
    empathyData?: {
        empathyPrompt: string;
        developerPersona: string;
        suggestedTone: 'supportive' | 'direct' | 'encouraging' | 'patient';
        empathyScore: number;
    };
    lastUpdated: Date;
    isActive: boolean;
}

export class ProfileManager {
    private profiles: Map<string, MentorProfile> = new Map();
    private activeProfileId: string = 'default';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadProfiles();
        this.initializeDefaultProfiles();
    }

    private loadProfiles() {
        const savedProfiles = this.context.globalState.get<MentorProfile[]>('mentorProfiles', []);
        savedProfiles.forEach(profile => {
            this.profiles.set(profile.id, profile);
        });

        this.activeProfileId = this.context.globalState.get<string>('activeProfileId', 'default');
    }

    private async saveProfiles() {
        const profileArray = Array.from(this.profiles.values());
        await this.context.globalState.update('mentorProfiles', profileArray);
        await this.context.globalState.update('activeProfileId', this.activeProfileId);
    }

    private initializeDefaultProfiles() {
        if (this.profiles.size === 0) {
            // Default General Mentor
            this.addProfile({
                id: 'default',
                name: 'General Mentor',
                personality: {
                    communicationStyle: 'supportive',
                    feedbackApproach: 'encouraging',
                    expertise: ['general programming', 'best practices'],
                    focusAreas: ['code quality', 'learning'],
                    responseLength: 'moderate'
                },
                codeStylePreferences: {
                    indentStyle: 'spaces',
                    indentSize: 2,
                    maxLineLength: 80,
                    preferredQuotes: 'single',
                    semicolons: true,
                    trailingCommas: true,
                    bracketSpacing: true
                },
                prompts: {
                    systemPrompt: "You are a supportive coding mentor. Provide helpful, encouraging feedback while teaching best practices.",
                    reviewPrompt: "Review this code with a focus on learning opportunities and improvements.",
                    debuggingPrompt: "Help debug this issue by explaining the problem and guiding toward a solution.",
                    explanationPrompt: "Explain this code in a clear, educational way."
                },
                lastUpdated: new Date(),
                isActive: true
            });

        }
    }

    public addProfile(profile: MentorProfile): void {
        this.profiles.set(profile.id, profile);
        this.saveProfiles();
    }

    public getProfile(id: string): MentorProfile | undefined {
        return this.profiles.get(id);
    }

    public getActiveProfile(): MentorProfile {
        return this.profiles.get(this.activeProfileId) || this.profiles.get('default')!;
    }

    public getAllProfiles(): MentorProfile[] {
        return Array.from(this.profiles.values());
    }

    public async setActiveProfile(id: string): Promise<boolean> {
        if (this.profiles.has(id)) {
            this.activeProfileId = id;
            await this.saveProfiles();
            return true;
        }
        return false;
    }

    public deleteProfile(id: string): boolean {
        if (id === 'default') return false; // Can't delete default profile
        
        if (this.profiles.delete(id)) {
            if (this.activeProfileId === id) {
                this.activeProfileId = 'default';
            }
            this.saveProfiles();
            return true;
        }
        return false;
    }

    public updateProfile(id: string, updates: Partial<MentorProfile>): boolean {
        const profile = this.profiles.get(id);
        if (profile) {
            const updatedProfile = { ...profile, ...updates, lastUpdated: new Date() };
            this.profiles.set(id, updatedProfile);
            this.saveProfiles();
            return true;
        }
        return false;
    }


    public async createProfileFromGitHub(
        githubUsername: string, 
        githubData: any,
        name?: string
    ): Promise<string> {
        // Check if profile already exists for this user
        const existingProfile = Array.from(this.profiles.values()).find(
            profile => profile.name === githubUsername && profile.id.startsWith('github-')
        );
        
        if (existingProfile) {
            console.log(`Profile already exists for ${githubUsername}: ${existingProfile.id}`);
            return existingProfile.id;
        }
        
        const profileId = `github-${githubUsername}-${Date.now()}`;
        
        // Use Genesys to analyze GitHub profile for empathy-driven prompts
        const genesysService = new GenesysService();
        let empathyData;
        
        try {
            empathyData = await genesysService.analyzeGitHubProfileForEmpathy(githubData);
        } catch (error) {
            console.warn('Failed to analyze GitHub profile with Genesys:', error);
            empathyData = {
                empathyPrompt: `You are mentoring a developer. Adjust your approach based on their needs.`,
                developerPersona: `${githubUsername} developer`,
                suggestedTone: 'supportive' as const,
                empathyScore: 50
            };
        }

        // Create personalized prompts that make the AI act like the user
        const personalizedPrompts = {
            systemPrompt: `You are ${githubUsername}, an experienced developer. You're mentoring someone by sharing your coding knowledge and experience. ${empathyData.empathyPrompt} Use your personal coding style and preferences when giving advice. Speak as if you're the developer whose GitHub profile this is based on.`,
            reviewPrompt: `As ${githubUsername}, review this code based on your experience and coding standards. Share insights from your own development journey and suggest improvements that align with your coding philosophy.`,
            debuggingPrompt: `As ${githubUsername}, help debug this issue using your problem-solving approach. Draw from your experience with similar problems and guide them through your debugging methodology.`,
            explanationPrompt: `As ${githubUsername}, explain this code in your own style. Use examples and analogies that reflect your development experience and teaching approach.`
        };

        const newProfile: MentorProfile = {
            id: profileId,
            name: name || githubUsername,
            githubUsername: githubUsername,
            personality: {
                communicationStyle: empathyData.suggestedTone === 'direct' ? 'direct' : 'supportive',
                feedbackApproach: empathyData.empathyScore > 70 ? 'encouraging' : 'analytical',
                expertise: githubData.expertise || ['general programming'],
                focusAreas: githubData.focusAreas || ['code review', 'best practices'],
                responseLength: empathyData.empathyScore > 70 ? 'detailed' : 'moderate'
            },
            codeStylePreferences: githubData.codeStylePreferences || {
                indentStyle: 'spaces',
                indentSize: 2,
                maxLineLength: 80,
                preferredQuotes: 'single',
                semicolons: true,
                trailingCommas: true,
                bracketSpacing: true
            },
            prompts: personalizedPrompts,
            empathyData,
            lastUpdated: new Date(),
            isActive: false
        };

        this.addProfile(newProfile);
        return profileId;
    }
}
