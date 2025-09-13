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



    private async fetchGitHubRepos(username: string): Promise<any[]> {
        const response = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=20`);
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        return response.json();
    }

    private async fetchRecentCommits(username: string, repos: any[]): Promise<any[]> {
        const commitPromises = repos.slice(0, 5).map(async (repo) => {
            try {
                const response = await fetch(`https://api.github.com/repos/${username}/${repo.name}/commits?per_page=20`);
                if (response.ok) {
                    const commits = await response.json();
                    return commits.map(commit => ({
                        repo: repo.name,
                        message: commit.commit.message,
                        author: commit.commit.author,
                        stats: commit.stats,
                        files: commit.files
                    }));
                }
                return [];
            } catch (error) {
                console.warn(`Failed to fetch commits for ${repo.name}:`, error);
                return [];
            }
        });
        
        const allCommits = await Promise.all(commitPromises);
        return allCommits.flat();
    }

    private async analyzeCodeStyle(username: string, repos: any[]): Promise<any> {
        const styleAnalysis = {
            indentationPattern: {},
            lineLength: [],
            commentStyle: {},
            namingConventions: {},
            functionLength: [],
            errorHandlingPatterns: [],
            commonPatterns: []
        };

        for (const repo of repos.slice(0, 3)) {
            try {
                // Fetch repository contents
                const contentsResponse = await fetch(`https://api.github.com/repos/${username}/${repo.name}/contents`);
                if (contentsResponse.ok) {
                    const contents = await contentsResponse.json();
                    
                    // Analyze code files
                    for (const file of contents.slice(0, 10)) {
                        if (file.type === 'file' && this.isCodeFile(file.name)) {
                            const fileContent = await this.fetchFileContent(file.download_url);
                            if (fileContent) {
                                this.analyzeFileStyle(fileContent, file.name, styleAnalysis);
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to analyze code style for ${repo.name}:`, error);
            }
        }

        return this.consolidateStyleAnalysis(styleAnalysis);
    }

    private isCodeFile(filename: string): boolean {
        const codeExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.c', '.h', '.cs', '.go', '.rs', '.rb', '.php'];
        return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
    }

    private inferLanguageFromFile(filename: string): string | null {
        const ext = filename.split('.').pop()?.toLowerCase();
        const langMap: { [key: string]: string } = {
            'js': 'javascript', 'ts': 'typescript', 'py': 'python',
            'java': 'java', 'cpp': 'c++', 'c': 'c', 'h': 'c',
            'cs': 'c#', 'go': 'go', 'rs': 'rust', 'rb': 'ruby'
        };
        return ext ? langMap[ext] || null : null;
    }

    private async fetchFileContent(url: string): Promise<string | null> {
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.text();
            }
        } catch (error) {
            console.warn('Failed to fetch file content:', error);
        }
        return null;
    }

    private analyzeFileStyle(content: string, filename: string, analysis: any): void {
        const lines = content.split('\n');
        
        // Analyze indentation
        lines.forEach(line => {
            if (line.trim()) {
                const leadingSpaces = line.match(/^\s*/)?.[0] || '';
                if (leadingSpaces.includes('\t')) {
                    analysis.indentationPattern.tabs = (analysis.indentationPattern.tabs || 0) + 1;
                } else if (leadingSpaces.length > 0) {
                    const spaceCount = leadingSpaces.length;
                    analysis.indentationPattern[`spaces_${spaceCount}`] = (analysis.indentationPattern[`spaces_${spaceCount}`] || 0) + 1;
                }
            }
        });

        // Analyze line length
        lines.forEach(line => {
            if (line.trim()) {
                analysis.lineLength.push(line.length);
            }
        });

        // Analyze comment style
        const singleLineComments = content.match(/\/\/.*$/gm) || [];
        const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
        analysis.commentStyle.singleLine = (analysis.commentStyle.singleLine || 0) + singleLineComments.length;
        analysis.commentStyle.multiLine = (analysis.commentStyle.multiLine || 0) + multiLineComments.length;

        // Analyze function patterns
        const functions = content.match(/function\s+\w+|\w+\s*=\s*\([^)]*\)\s*=>|def\s+\w+/g) || [];
        functions.forEach(() => {
            // Simple function length analysis (lines between function declaration and next function/end)
            analysis.functionLength.push(10); // Placeholder - would need more sophisticated parsing
        });
    }

    private consolidateStyleAnalysis(analysis: any): any {
        // Determine preferred indentation
        const indentEntries = Object.entries(analysis.indentationPattern);
        const preferredIndent = indentEntries.reduce((a, b) => 
            (analysis.indentationPattern[a[0]] > analysis.indentationPattern[b[0]]) ? a : b
        )?.[0] || 'spaces_4';

        // Calculate average line length
        const avgLineLength = analysis.lineLength.length > 0 
            ? Math.round(analysis.lineLength.reduce((a, b) => a + b, 0) / analysis.lineLength.length)
            : 80;

        return {
            indentStyle: preferredIndent.includes('tabs') ? 'tabs' : 'spaces',
            indentSize: preferredIndent.includes('spaces') ? parseInt(preferredIndent.split('_')[1]) || 4 : 4,
            averageLineLength: avgLineLength,
            maxLineLength: Math.min(Math.max(...analysis.lineLength), 120),
            commentRatio: (analysis.commentStyle.singleLine + analysis.commentStyle.multiLine) / Math.max(analysis.lineLength.length, 1),
            preferredCommentStyle: analysis.commentStyle.singleLine > analysis.commentStyle.multiLine ? 'single' : 'multi'
        };
    }

    public async createMentorFromGitHub(githubUsername: string): Promise<MentorProfile> {
        try {
            // Fetch comprehensive GitHub data
            const profileData = await this.fetchGitHubProfile(githubUsername);
            const repoData = await this.fetchGitHubRepos(githubUsername);
            const commitData = await this.fetchRecentCommits(githubUsername, repoData.slice(0, 5)); // Top 5 repos
            const codeStyleData = await this.analyzeCodeStyle(githubUsername, repoData.slice(0, 3)); // Top 3 repos
            
            // Deep analysis to create authentic mentor characteristics
            const mentorProfile = this.createRichMentorProfile(profileData, repoData, commitData, codeStyleData);
            
            // Add to profiles
            this.addProfile(mentorProfile);
            
            return mentorProfile;
        } catch (error) {
            console.error('Error creating GitHub mentor:', error);
            throw new Error(`Failed to create mentor from GitHub profile: ${error.message}`);
        }
    }

    private async fetchGitHubProfile(username: string): Promise<any> {
        const response = await fetch(`https://api.github.com/users/${username}`);
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        return response.json();
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

    private createRichMentorProfile(profileData: any, repoData: any[], commitData: any[], codeStyleData: any): MentorProfile {
        // Deep analysis of the developer's characteristics
        const languages = this.extractLanguageExpertise(repoData, commitData);
        const focusAreas = this.analyzeFocusAreas(repoData, commitData);
        const communicationStyle = this.analyzeCommunicationStyle(commitData, profileData);
        const technicalPatterns = this.extractTechnicalPatterns(commitData, repoData);
        const personalityTraits = this.inferPersonalityTraits(commitData, profileData, repoData);
        
        const profileId = `github_${profileData.login}`;
        
        return {
            id: profileId,
            name: profileData.name || profileData.login,
            githubUsername: profileData.login,
            avatar: profileData.avatar_url,
            personality: {
                communicationStyle: communicationStyle.style,
                feedbackApproach: communicationStyle.approach,
                expertise: languages.primary,
                focusAreas: focusAreas,
                responseLength: communicationStyle.verbosity
            },
            codeStylePreferences: {
                ...codeStyleData,
                preferredQuotes: 'single',
                semicolons: true,
                trailingCommas: true,
                bracketSpacing: true
            },
            prompts: this.generateAdvancedPrompts(profileData, communicationStyle, languages, technicalPatterns),
            lastUpdated: new Date(),
            isActive: false
        };
    }

    private extractLanguageExpertise(repoData: any[], commitData: any[]): { primary: string[], secondary: string[] } {
        const languageStats = new Map<string, { repos: number, commits: number, stars: number }>();
        
        // Analyze repository languages with weighting
        repoData.forEach(repo => {
            if (repo.language) {
                const lang = repo.language.toLowerCase();
                const current = languageStats.get(lang) || { repos: 0, commits: 0, stars: 0 };
                current.repos += 1;
                current.stars += repo.stargazers_count || 0;
                languageStats.set(lang, current);
            }
        });
        
        // Calculate expertise scores
        const languageScores = Array.from(languageStats.entries()).map(([lang, stats]) => {
            const score = (stats.repos * 2) + (stats.commits * 0.1) + (Math.log(stats.stars + 1) * 0.5);
            return { language: lang, score, ...stats };
        }).sort((a, b) => b.score - a.score);
        
        return {
            primary: languageScores.slice(0, 3).map(l => l.language),
            secondary: languageScores.slice(3, 6).map(l => l.language)
        };
    }

    private analyzeFocusAreas(repoData: any[], commitData: any[]): string[] {
        const areas = new Set<string>();
        
        // Analyze from repository topics and descriptions
        repoData.forEach(repo => {
            if (repo.topics) {
                repo.topics.forEach((topic: string) => {
                    if (this.isRelevantTopic(topic)) {
                        areas.add(topic);
                    }
                });
            }
            
            if (repo.description) {
                const desc = repo.description.toLowerCase();
                if (desc.includes('test') || desc.includes('testing')) areas.add('testing');
                if (desc.includes('performance')) areas.add('performance');
                if (desc.includes('security')) areas.add('security');
                if (desc.includes('api')) areas.add('API design');
            }
        });
        
        // Analyze from commit messages
        const messages = commitData.map(c => c.message).join(' ').toLowerCase();
        if (messages.includes('test')) areas.add('testing');
        if (messages.includes('performance') || messages.includes('optimize')) areas.add('performance');
        if (messages.includes('security')) areas.add('security');
        if (messages.includes('refactor')) areas.add('code quality');
        
        return Array.from(areas).slice(0, 4);
    }

    private isRelevantTopic(topic: string): boolean {
        const relevantTopics = [
            'testing', 'performance', 'security', 'api', 'framework',
            'library', 'tool', 'cli', 'web', 'mobile', 'desktop',
            'machine-learning', 'ai', 'blockchain', 'devops'
        ];
        return relevantTopics.includes(topic.toLowerCase());
    }

    private analyzeCommunicationStyle(commitData: any[], profileData: any): any {
        const messages = commitData.map(c => c.message).filter(Boolean);
        
        // Analyze commit message patterns
        const avgLength = messages.reduce((sum, msg) => sum + msg.length, 0) / Math.max(messages.length, 1);
        const formalLanguage = messages.filter(msg => msg.includes('Fix') || msg.includes('Add') || msg.includes('Update')).length / Math.max(messages.length, 1);
        
        // Determine style based on patterns
        let style = 'supportive';
        let approach = 'encouraging';
        let verbosity = 'moderate';
        
        if (profileData.login === 'torvalds') {
            // Special case for Linus - known for direct, sometimes harsh feedback
            style = 'direct';
            approach = 'critical';
            verbosity = 'brief';
        } else if (formalLanguage > 0.7) {
            style = 'detailed';
            approach = 'analytical';
        }
        
        if (avgLength > 100) verbosity = 'detailed';
        else if (avgLength < 30) verbosity = 'brief';
        
        return { style, approach, verbosity };
    }

    private extractTechnicalPatterns(commitData: any[], repoData: any[]): any {
        const patterns = {
            architectural: [],
            coding: [],
            reviewAreas: []
        };
        
        // Analyze commit messages for technical patterns
        const messages = commitData.map(c => c.message).join(' ').toLowerCase();
        
        // Architectural patterns
        if (messages.includes('refactor')) patterns.architectural.push('refactoring');
        if (messages.includes('performance') || messages.includes('optimize')) patterns.architectural.push('performance optimization');
        if (messages.includes('security') || messages.includes('vulnerability')) patterns.architectural.push('security');
        if (messages.includes('test') || messages.includes('testing')) patterns.architectural.push('testing');
        
        // Review focus areas
        patterns.reviewAreas = ['code quality', 'performance', 'maintainability'];
        if (patterns.architectural.includes('security')) patterns.reviewAreas.push('security');
        if (patterns.architectural.includes('testing')) patterns.reviewAreas.push('test coverage');
        
        return patterns;
    }

    private inferPersonalityTraits(commitData: any[], profileData: any, repoData: any[]): any {
        const traits = {
            technicalDepth: 'intermediate',
            mentoringStyle: 'collaborative',
            problemSolving: 'systematic'
        };
        
        // Analyze technical depth from repository complexity and commit patterns
        const totalStars = repoData.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
        const hasSystemsRepos = repoData.some(repo => 
            repo.name.includes('kernel') || 
            repo.name.includes('os') || 
            repo.description?.toLowerCase().includes('operating system')
        );
        
        if (totalStars > 10000 || hasSystemsRepos || profileData.login === 'torvalds') {
            traits.technicalDepth = 'expert';
            traits.problemSolving = 'architectural';
        } else if (totalStars > 1000) {
            traits.technicalDepth = 'advanced';
        }
        
        return traits;
    }

    private generateAdvancedPrompts(profileData: any, communicationStyle: any, languages: any, patterns: any): any {
        const name = profileData.name || profileData.login;
        const expertise = languages.primary.join(', ');
        
        let personalityDesc = '';
        if (profileData.login === 'torvalds') {
            personalityDesc = 'You are Linus Torvalds, creator of Linux and Git. You are known for your direct, no-nonsense approach to code review and your deep understanding of systems programming. You value performance, simplicity, and correctness above all else. You can be blunt but always focus on technical merit.';
        } else {
            personalityDesc = `You are a coding mentor based on ${name}'s GitHub profile and coding patterns. Your communication style is ${communicationStyle.style} and you provide ${communicationStyle.approach} feedback.`;
        }
        
        return {
            systemPrompt: `${personalityDesc} Your expertise includes: ${expertise}. You focus on ${patterns.reviewAreas.join(', ')}. Provide ${communicationStyle.verbosity} responses that reflect your authentic coding style and technical philosophy.`,
            reviewPrompt: `Review this code as ${name} would, focusing on ${patterns.reviewAreas.join(', ')}. Consider the architectural patterns and coding standards you're known for. Provide ${communicationStyle.approach} feedback in your characteristic ${communicationStyle.style} manner.`,
            debuggingPrompt: `Help debug this issue using ${name}'s systematic approach. Focus on ${patterns.architectural.join(', ')} and apply the problem-solving methodology you're known for.`,
            explanationPrompt: `Explain this code as ${name} would, using your ${communicationStyle.style} communication style with ${communicationStyle.verbosity} explanations. Draw from your experience with ${expertise} and ${patterns.coding.join(', ')}.`
        };
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
