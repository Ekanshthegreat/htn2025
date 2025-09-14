import * as vscode from 'vscode';
import { GitHubService } from './githubService';


export interface ArchitecturalPreferences {
    preferredPatterns: string[];           // ['mvc', 'microservices', 'clean-architecture']
    codeOrganization: 'modular' | 'monolithic' | 'layered' | 'component-based';
    dependencyManagement: 'minimal' | 'selective' | 'comprehensive';
    errorHandling: 'explicit' | 'graceful' | 'defensive' | 'fail-fast';
    testingApproach: 'tdd' | 'bdd' | 'integration-first' | 'unit-focused';
    performancePriority: 'memory' | 'speed' | 'scalability' | 'maintainability';
}

export interface CodingStylePreferences {
    indentStyle: 'tabs' | 'spaces';
    indentSize: number;
    maxLineLength: number;
    preferredQuotes: 'single' | 'double';
    semicolons: boolean;
    trailingCommas: boolean;
    bracketSpacing: boolean;
    functionStyle: 'arrow' | 'function' | 'mixed';
    variableNaming: 'camelCase' | 'snake_case' | 'kebab-case';
    commentStyle: 'minimal' | 'descriptive' | 'verbose';
    importOrganization: 'grouped' | 'alphabetical' | 'by-usage';
}

export interface ExperienceBasedTraits {
    yearsOfExperience: number;
    primaryLanguages: string[];
    architecturalPhilosophy: string;
    codeReviewStyle: 'thorough' | 'focused' | 'collaborative' | 'mentoring';
    problemSolvingApproach: 'systematic' | 'intuitive' | 'experimental' | 'research-first';
    learningStyle: 'hands-on' | 'theoretical' | 'community-driven' | 'documentation-first';
}

export interface MentorPersonality {
    communicationStyle: 'direct' | 'supportive' | 'detailed' | 'concise';
    feedbackApproach: 'encouraging' | 'critical' | 'analytical' | 'pragmatic';
    expertise: string[];
    focusAreas: string[];
    responseLength: 'brief' | 'moderate' | 'detailed';
    architecturalPrefs: ArchitecturalPreferences;
    experienceTraits: ExperienceBasedTraits;
}

export interface MentorProfile {
    id: string;
    name: string;
    githubUsername?: string;
    contactEmail?: string;
    avatar?: string;
    personality: MentorPersonality;
    codeStylePreferences: CodingStylePreferences;
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
        
        // Create default mentor profiles if none exist
        if (this.profiles.size === 0) {
            this.createDefaultProfiles();
        }
        
        // Set active profile if it exists and is GitHub-based
        if (savedActiveId && this.profiles.has(savedActiveId)) {
            this.activeProfileId = savedActiveId;
        } else if (this.profiles.size > 0) {
            // Set first available profile as active
            this.activeProfileId = Array.from(this.profiles.keys())[0];
        }
    }

    private createDefaultProfiles() {
        // Create Linus Torvalds profile
        const linusProfile: MentorProfile = {
            id: 'linus-torvalds',
            name: 'Linus Torvalds',
            githubUsername: 'torvalds',
            avatar: '👨‍💻',
            personality: {
                communicationStyle: 'direct',
                feedbackApproach: 'critical',
                expertise: ['systems programming', 'kernel development', 'performance optimization'],
                focusAreas: ['performance', 'simplicity', 'efficiency'],
                responseLength: 'brief',
                architecturalPrefs: {
                    preferredPatterns: ['minimal', 'efficient'],
                    codeOrganization: 'modular',
                    dependencyManagement: 'minimal',
                    errorHandling: 'fail-fast',
                    testingApproach: 'integration-first',
                    performancePriority: 'speed'
                },
                experienceTraits: {
                    yearsOfExperience: 30,
                    primaryLanguages: ['C', 'Assembly', 'Shell'],
                    architecturalPhilosophy: 'Keep it simple and efficient',
                    codeReviewStyle: 'thorough',
                    problemSolvingApproach: 'systematic',
                    learningStyle: 'hands-on'
                }
            },
            codeStylePreferences: {
                indentStyle: 'tabs',
                indentSize: 8,
                maxLineLength: 80,
                preferredQuotes: 'double',
                semicolons: true,
                trailingCommas: false,
                bracketSpacing: false,
                functionStyle: 'function',
                variableNaming: 'snake_case',
                commentStyle: 'minimal',
                importOrganization: 'grouped'
            },
            prompts: {
                systemPrompt: 'You are Linus Torvalds. Be direct, focus on efficiency and simplicity.',
                reviewPrompt: 'Review this code with focus on performance and maintainability.',
                debuggingPrompt: 'Help debug this issue with systematic approach.',
                explanationPrompt: 'Explain this concept clearly and concisely.'
            },
            lastUpdated: new Date(),
            isActive: true
        };

        // Create Marcus profile (Performance Expert)
        const marcusProfile: MentorProfile = {
            id: 'marcus-performance',
            name: 'Marcus',
            avatar: '⚡',
            personality: {
                communicationStyle: 'detailed',
                feedbackApproach: 'pragmatic',
                expertise: ['performance optimization', 'scalability', 'algorithms'],
                focusAreas: ['performance', 'efficiency', 'scalability'],
                responseLength: 'moderate',
                architecturalPrefs: {
                    preferredPatterns: ['microservices', 'clean-architecture'],
                    codeOrganization: 'modular',
                    dependencyManagement: 'selective',
                    errorHandling: 'defensive',
                    testingApproach: 'unit-focused',
                    performancePriority: 'speed'
                },
                experienceTraits: {
                    yearsOfExperience: 15,
                    primaryLanguages: ['JavaScript', 'TypeScript', 'Python'],
                    architecturalPhilosophy: 'Optimize for performance and maintainability',
                    codeReviewStyle: 'focused',
                    problemSolvingApproach: 'systematic',
                    learningStyle: 'theoretical'
                }
            },
            codeStylePreferences: {
                indentStyle: 'spaces',
                indentSize: 2,
                maxLineLength: 100,
                preferredQuotes: 'single',
                semicolons: true,
                trailingCommas: true,
                bracketSpacing: true,
                functionStyle: 'arrow',
                variableNaming: 'camelCase',
                commentStyle: 'descriptive',
                importOrganization: 'alphabetical'
            },
            prompts: {
                systemPrompt: 'You are Marcus, a performance optimization expert. Focus on efficiency and scalability.',
                reviewPrompt: 'Analyze this code for performance bottlenecks and optimization opportunities.',
                debuggingPrompt: 'Debug with focus on performance implications.',
                explanationPrompt: 'Explain with emphasis on performance considerations.'
            },
            lastUpdated: new Date(),
            isActive: false
        };

        // Create Sophia profile (Code Quality Guru)
        const sophiaProfile: MentorProfile = {
            id: 'sophia-quality',
            name: 'Sophia',
            avatar: '✨',
            personality: {
                communicationStyle: 'supportive',
                feedbackApproach: 'encouraging',
                expertise: ['code quality', 'best practices', 'maintainability'],
                focusAreas: ['code quality', 'readability', 'maintainability'],
                responseLength: 'detailed',
                architecturalPrefs: {
                    preferredPatterns: ['clean-architecture', 'mvc'],
                    codeOrganization: 'layered',
                    dependencyManagement: 'comprehensive',
                    errorHandling: 'graceful',
                    testingApproach: 'tdd',
                    performancePriority: 'maintainability'
                },
                experienceTraits: {
                    yearsOfExperience: 12,
                    primaryLanguages: ['JavaScript', 'TypeScript', 'React'],
                    architecturalPhilosophy: 'Clean, readable, and maintainable code',
                    codeReviewStyle: 'mentoring',
                    problemSolvingApproach: 'systematic',
                    learningStyle: 'community-driven'
                }
            },
            codeStylePreferences: {
                indentStyle: 'spaces',
                indentSize: 2,
                maxLineLength: 120,
                preferredQuotes: 'single',
                semicolons: true,
                trailingCommas: true,
                bracketSpacing: true,
                functionStyle: 'arrow',
                variableNaming: 'camelCase',
                commentStyle: 'verbose',
                importOrganization: 'grouped'
            },
            prompts: {
                systemPrompt: 'You are Sophia, a code quality expert. Focus on clean, maintainable code.',
                reviewPrompt: 'Review this code for quality, readability, and best practices.',
                debuggingPrompt: 'Help debug with focus on code clarity and maintainability.',
                explanationPrompt: 'Explain clearly with focus on best practices.'
            },
            lastUpdated: new Date(),
            isActive: false
        };

        this.profiles.set(linusProfile.id, linusProfile);
        this.profiles.set(marcusProfile.id, marcusProfile);
        this.profiles.set(sophiaProfile.id, sophiaProfile);
        
        // Set Linus as the default active profile
        this.activeProfileId = linusProfile.id;
        
        this.saveProfiles();
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




    public async createMentorFromGitHub(githubUsername: string, email?: string): Promise<MentorProfile> {
        try {
            // Use GitHubService for all GitHub operations
            const partialProfile = await this.githubService.createProfileFromGitHub(githubUsername, undefined, email);
            
            // Create complete mentor profile
            const mentorProfile: MentorProfile = {
                id: `github_${githubUsername}`,
                name: partialProfile.name || githubUsername,
                githubUsername: partialProfile.githubUsername!,
                contactEmail: partialProfile.contactEmail,
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
