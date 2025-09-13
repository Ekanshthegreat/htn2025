import * as vscode from 'vscode';
import { GitHubService } from './githubService';

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
    private activeProfileId: string | null = null;
    private context: vscode.ExtensionContext;
    private githubService: GitHubService;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.githubService = new GitHubService();
        this.loadProfiles();
    }

    private loadProfiles() {
        const savedProfiles = this.context.globalState.get<MentorProfile[]>('mentorProfiles', []);
        const savedActiveId = this.context.globalState.get<string>('activeProfileId');
        
        // Load GitHub-based profiles from storage
        savedProfiles.forEach(profile => {
            if (profile.githubUsername) { // Only load GitHub-based profiles
                this.profiles.set(profile.id, profile);
            }
        });
        
        // Set active profile if it exists and is GitHub-based
        if (savedActiveId && this.profiles.has(savedActiveId)) {
            this.activeProfileId = savedActiveId;
        }
    }

    private async saveProfiles() {
        const profileArray = Array.from(this.profiles.values());
        await this.context.globalState.update('mentorProfiles', profileArray);
        await this.context.globalState.update('activeProfileId', this.activeProfileId);
    }


    public addProfile(profile: MentorProfile): void {
        this.profiles.set(profile.id, profile);
        this.saveProfiles();
    }

    public getProfile(id: string): MentorProfile | undefined {
        return this.profiles.get(id);
    }

    public getActiveProfile(): MentorProfile | null {
        if (!this.activeProfileId) {
            return null;
        }
        return this.profiles.get(this.activeProfileId) || null;
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
        if (this.profiles.delete(id)) {
            if (this.activeProfileId === id) {
                // Set to first available profile or null
                const remainingProfiles = Array.from(this.profiles.keys());
                this.activeProfileId = remainingProfiles.length > 0 ? remainingProfiles[0] : null;
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




    public async createMentorFromGitHub(githubUsername: string): Promise<MentorProfile> {
        try {
            // Use GitHubService for all GitHub operations
            const partialProfile = await this.githubService.createProfileFromGitHub(githubUsername);
            
            // Create complete mentor profile
            const mentorProfile: MentorProfile = {
                id: `github_${githubUsername}`,
                name: partialProfile.name || githubUsername,
                githubUsername: partialProfile.githubUsername!,
                avatar: partialProfile.avatar,
                personality: partialProfile.personality!,
                codeStylePreferences: partialProfile.codeStylePreferences!,
                prompts: partialProfile.prompts!,
                lastUpdated: new Date(),
                isActive: false
            };
            
            // Add to profiles
            this.addProfile(mentorProfile);
            
            return mentorProfile;
        } catch (error) {
            console.error('Error creating GitHub mentor:', error);
            throw new Error(`Failed to create mentor from GitHub profile: ${error.message}`);
        }
    }

    // Get available mentor profiles for UI selection
    public getAvailableMentors(): Array<{id: string, name: string, avatar?: string, personality: string, isGitHubBased?: boolean}> {
        const allProfiles = Array.from(this.profiles.values());
        
        return allProfiles.map(profile => ({
            id: profile.id,
            name: profile.name,
            avatar: profile.avatar,
            personality: this.getPersonalityDescription(profile),
            isGitHubBased: !!profile.githubUsername
        }));
    }


    private getPersonalityDescription(profile: MentorProfile): string {
        if (profile.githubUsername) {
            const expertise = profile.personality.expertise.slice(0, 3).join(', ');
            
            let description = `GitHub-based mentor specializing in ${expertise || 'software development'}`;
            
            // Add personality-specific details
            if (profile.githubUsername === 'torvalds') {
                description += ' - Creator of Linux & Git, known for direct technical leadership';
            }
            
            return description;
        }
        
        return `${profile.personality.communicationStyle} mentor focusing on ${profile.personality.focusAreas.join(', ')}`;
    }

    // Fix profile deletion functionality
    public async deleteProfileWithConfirmation(id: string): Promise<boolean> {
        const profile = this.profiles.get(id);
        if (!profile) {
            return false;
        }
        
        const result = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the mentor profile "${profile.name}"?`,
            { modal: true },
            'Delete'
        );
        
        if (result === 'Delete') {
            return this.deleteProfile(id);
        }
        
        return false;
    }

    // Enhanced profile management for UI
    public async handleProfileDeletion(profileId: string): Promise<void> {
        const deleted = await this.deleteProfileWithConfirmation(profileId);
        if (deleted) {
            vscode.window.showInformationMessage('Mentor profile deleted successfully.');
        }
    }
}
