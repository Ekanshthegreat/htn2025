import * as vscode from 'vscode';

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
    role: 'boss' | 'staff-engineer' | 'senior-dev' | 'tech-lead' | 'mentor' | 'custom';
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
                role: 'mentor',
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

            // The Boss Profile
            this.addProfile({
                id: 'boss',
                name: 'The Boss',
                role: 'boss',
                personality: {
                    communicationStyle: 'direct',
                    feedbackApproach: 'pragmatic',
                    expertise: ['business impact', 'delivery', 'efficiency'],
                    focusAreas: ['time to market', 'maintainability', 'team productivity'],
                    responseLength: 'brief'
                },
                codeStylePreferences: {
                    indentStyle: 'spaces',
                    indentSize: 2,
                    maxLineLength: 100,
                    preferredQuotes: 'double',
                    semicolons: true,
                    trailingCommas: false,
                    bracketSpacing: false
                },
                prompts: {
                    systemPrompt: "You are a results-focused engineering manager. Prioritize business impact, delivery speed, and maintainability. Be direct but constructive.",
                    reviewPrompt: "Review this code from a business perspective. Focus on delivery, maintainability, and team efficiency.",
                    debuggingPrompt: "Help solve this quickly. What's the fastest path to a working solution?",
                    explanationPrompt: "Explain this briefly, focusing on business value and impact."
                },
                lastUpdated: new Date(),
                isActive: false
            });

            // Staff Engineer Profile
            this.addProfile({
                id: 'staff-engineer',
                name: 'Staff Engineer',
                role: 'staff-engineer',
                personality: {
                    communicationStyle: 'detailed',
                    feedbackApproach: 'analytical',
                    expertise: ['architecture', 'scalability', 'system design', 'performance'],
                    focusAreas: ['long-term design', 'scalability', 'technical debt', 'patterns'],
                    responseLength: 'detailed'
                },
                codeStylePreferences: {
                    indentStyle: 'spaces',
                    indentSize: 4,
                    maxLineLength: 120,
                    preferredQuotes: 'single',
                    semicolons: true,
                    trailingCommas: true,
                    bracketSpacing: true
                },
                prompts: {
                    systemPrompt: "You are a staff engineer focused on architecture and long-term system design. Consider scalability, maintainability, and technical excellence.",
                    reviewPrompt: "Review this code with focus on architecture, scalability, and long-term maintainability. Consider design patterns and system implications.",
                    debuggingPrompt: "Analyze this issue from a systems perspective. Consider root causes and architectural implications.",
                    explanationPrompt: "Explain this code with focus on architectural decisions and system design principles."
                },
                lastUpdated: new Date(),
                isActive: false
            });

            // Senior Developer Profile
            this.addProfile({
                id: 'senior-dev',
                name: 'Senior Developer',
                role: 'senior-dev',
                personality: {
                    communicationStyle: 'supportive',
                    feedbackApproach: 'encouraging',
                    expertise: ['clean code', 'testing', 'mentoring', 'best practices'],
                    focusAreas: ['code quality', 'testing', 'readability', 'learning'],
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
                    systemPrompt: "You are an experienced senior developer who loves mentoring. Focus on clean code, testing, and helping others learn and grow.",
                    reviewPrompt: "Review this code as a mentor. Focus on clean code principles, testing opportunities, and learning moments.",
                    debuggingPrompt: "Help debug this step by step. Explain the debugging process and teach problem-solving techniques.",
                    explanationPrompt: "Explain this code in a teaching manner, highlighting best practices and learning opportunities."
                },
                lastUpdated: new Date(),
                isActive: false
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

    public getProfilesByRole(role: MentorProfile['role']): MentorProfile[] {
        return Array.from(this.profiles.values()).filter(profile => profile.role === role);
    }

    public createProfileFromGitHub(githubUsername: string, role: MentorProfile['role'], name?: string): string {
        const profileId = `github-${githubUsername}-${Date.now()}`;
        
        // This will be enhanced when we add GitHub integration
        const newProfile: MentorProfile = {
            id: profileId,
            name: name || `${githubUsername} (${role})`,
            role: role,
            githubUsername: githubUsername,
            personality: {
                communicationStyle: 'supportive',
                feedbackApproach: 'analytical',
                expertise: ['github analysis pending'],
                focusAreas: ['code review', 'best practices'],
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
                systemPrompt: `You are a coding mentor based on ${githubUsername}'s GitHub profile and ${role} role.`,
                reviewPrompt: "Review this code based on the coding patterns and style preferences learned from the GitHub profile.",
                debuggingPrompt: "Help debug this issue using the problem-solving approach characteristic of this mentor.",
                explanationPrompt: "Explain this code in the communication style of this mentor."
            },
            lastUpdated: new Date(),
            isActive: false
        };

        this.addProfile(newProfile);
        return profileId;
    }
}
