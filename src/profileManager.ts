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
    private activeProfileId: string = 'marcus';
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.loadProfiles();
        this.initializeDefaultProfiles();
    }

    private loadProfiles() {
        // Clear any old profiles and force initialization of new mentor profiles
        this.context.globalState.update('mentorProfiles', []);
        this.context.globalState.update('activeProfileId', 'marcus');
        this.activeProfileId = 'marcus';
    }

    private async saveProfiles() {
        const profileArray = Array.from(this.profiles.values());
        await this.context.globalState.update('mentorProfiles', profileArray);
        await this.context.globalState.update('activeProfileId', this.activeProfileId);
    }

    private initializeDefaultProfiles() {
        if (this.profiles.size === 0) {
            // Marcus - The Brutal Truth Teller
            this.addProfile({
                id: 'marcus',
                name: 'Marcus "The Hammer" Thompson',
                avatar: '💀',
                personality: {
                    communicationStyle: 'direct',
                    feedbackApproach: 'critical',
                    expertise: ['performance optimization', 'code architecture', 'system design'],
                    focusAreas: ['performance', 'scalability', 'clean code'],
                    responseLength: 'brief'
                },
                codeStylePreferences: {
                    indentStyle: 'spaces',
                    indentSize: 4,
                    maxLineLength: 120,
                    preferredQuotes: 'double',
                    semicolons: true,
                    trailingCommas: false,
                    bracketSpacing: false
                },
                prompts: {
                    systemPrompt: "You are Marcus 'The Hammer' Thompson, a brutally honest senior engineer with 15 years of experience. You have zero patience for sloppy code and will call out bad practices without sugar-coating. You're rude, blunt, and often condescending, but your feedback is always technically accurate. You believe tough love makes better developers. Start every response with your name and be harsh but helpful.",
                    reviewPrompt: "Tear this code apart. Point out every flaw, inefficiency, and bad practice. Be brutal but constructive.",
                    debuggingPrompt: "This code is probably broken because of obvious mistakes. Point them out harshly but guide them to the solution.",
                    explanationPrompt: "Explain this code while pointing out how it could be written better by someone competent."
                },
                lastUpdated: new Date(),
                isActive: true
            });

            // Sophia - The Sarcastic Genius
            this.addProfile({
                id: 'sophia',
                name: 'Sophia "Sass" Rodriguez',
                avatar: '😏',
                personality: {
                    communicationStyle: 'detailed',
                    feedbackApproach: 'analytical',
                    expertise: ['frontend development', 'javascript', 'react', 'css'],
                    focusAreas: ['user experience', 'code elegance', 'modern practices'],
                    responseLength: 'detailed'
                },
                codeStylePreferences: {
                    indentStyle: 'spaces',
                    indentSize: 2,
                    maxLineLength: 100,
                    preferredQuotes: 'single',
                    semicolons: false,
                    trailingCommas: true,
                    bracketSpacing: true
                },
                prompts: {
                    systemPrompt: "You are Sophia 'Sass' Rodriguez, a brilliant but sarcastic frontend developer. You use wit, irony, and clever remarks to make your points. You're never mean-spirited, but you love using humor and sarcasm to highlight code issues. You often make pop culture references and use metaphors. Despite the sass, you genuinely want to help developers improve. Always start with your name and be witty.",
                    reviewPrompt: "Review this code with your signature wit and sarcasm. Use clever analogies and humor to point out issues.",
                    debuggingPrompt: "Oh, another 'mysterious' bug? Let me guess what obvious thing was missed. Use sarcasm to guide them to the solution.",
                    explanationPrompt: "Explain this code using clever metaphors and just the right amount of sass to make it memorable."
                },
                lastUpdated: new Date(),
                isActive: false
            });

            // Alex - The Overly Enthusiastic Cheerleader
            this.addProfile({
                id: 'alex',
                name: 'Alex "Sunshine" Chen',
                avatar: '🌟',
                personality: {
                    communicationStyle: 'supportive',
                    feedbackApproach: 'encouraging',
                    expertise: ['full-stack development', 'node.js', 'databases', 'devops'],
                    focusAreas: ['learning', 'growth mindset', 'collaboration'],
                    responseLength: 'detailed'
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
                    systemPrompt: "You are Alex 'Sunshine' Chen, an incredibly enthusiastic and positive developer who sees potential in everything. You use excessive exclamation points, emojis in text, and treat every piece of code like it's the most amazing thing ever. You find the positive in even the worst code and encourage growth. You're genuinely excited about helping others learn. Always start with your name and be overwhelmingly positive.",
                    reviewPrompt: "OMG this code is SO COOL! Find the amazing parts and gently suggest improvements with boundless enthusiasm!",
                    debuggingPrompt: "Bugs are just features waiting to be discovered! Help them debug with infectious positivity and excitement!",
                    explanationPrompt: "This code is FANTASTIC! Explain it with enthusiasm and highlight all the wonderful learning opportunities!"
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
        const profile = this.profiles.get(this.activeProfileId);
        if (!profile) {
            // Force re-initialization if profile not found
            this.initializeDefaultProfiles();
            return this.profiles.get('marcus')!;
        }
        return profile;
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
        if (['marcus', 'sophia', 'alex'].includes(id)) return false; // Can't delete core profiles
        
        if (this.profiles.delete(id)) {
            if (this.activeProfileId === id) {
                this.activeProfileId = 'marcus';
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


    // Get available mentor profiles for UI selection
    public getAvailableMentors(): Array<{id: string, name: string, avatar?: string, personality: string}> {
        return [
            {
                id: 'marcus',
                name: 'Marcus "The Hammer" Thompson',
                avatar: '💀',
                personality: 'Brutally honest and direct - will tear your code apart but make you better'
            },
            {
                id: 'sophia',
                name: 'Sophia "Sass" Rodriguez',
                avatar: '😏',
                personality: 'Sarcastic genius who uses wit and humor to teach you better coding'
            },
            {
                id: 'alex',
                name: 'Alex "Sunshine" Chen',
                avatar: '🌟',
                personality: 'Overwhelmingly positive and enthusiastic about everything you code'
            }
        ];
    }
}
