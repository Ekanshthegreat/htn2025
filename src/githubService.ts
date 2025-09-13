import * as vscode from 'vscode';
import { MentorProfile, MentorPersonality, CodeStylePreferences } from './profileManager';

export interface GitHubUser {
    login: string;
    name: string;
    avatar_url: string;
    bio: string;
    public_repos: number;
    followers: number;
    following: number;
    created_at: string;
}

export interface GitHubRepo {
    name: string;
    language: string;
    size: number;
    stargazers_count: number;
    forks_count: number;
    description: string;
    topics: string[];
    updated_at: string;
}

export interface GitHubCommit {
    message: string;
    author: {
        name: string;
        date: string;
    };
    stats: {
        additions: number;
        deletions: number;
    };
}

export interface ProfileAnalysis {
    personality: MentorPersonality;
    codeStylePreferences: CodeStylePreferences;
    expertise: string[];
    communicationPatterns: {
        avgCommitMessageLength: number;
        usesConventionalCommits: boolean;
        commitFrequency: 'high' | 'medium' | 'low';
        documentationStyle: 'detailed' | 'concise' | 'minimal';
    };
}

export class GitHubService {
    private apiToken: string | undefined;

    constructor() {
        this.loadApiToken();
    }

    private loadApiToken() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        this.apiToken = config.get<string>('githubToken');
    }

    private async makeGitHubRequest(url: string): Promise<any> {
        if (!this.apiToken) {
            throw new Error('GitHub token not configured. Please set aiMentor.githubToken in settings.');
        }

        const response = await fetch(`https://api.github.com${url}`, {
            headers: {
                'Authorization': `token ${this.apiToken}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'AI-Debugger-Mentor'
            }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    public async getUserProfile(username: string): Promise<GitHubUser> {
        return this.makeGitHubRequest(`/users/${username}`);
    }

    public async getUserRepos(username: string, limit: number = 30): Promise<GitHubRepo[]> {
        return this.makeGitHubRequest(`/users/${username}/repos?sort=updated&per_page=${limit}`);
    }

    public async getRepoCommits(username: string, repoName: string, limit: number = 50): Promise<GitHubCommit[]> {
        return this.makeGitHubRequest(`/repos/${username}/${repoName}/commits?per_page=${limit}`);
    }

    public async analyzeProfile(username: string): Promise<ProfileAnalysis> {
        try {
            const [user, repos] = await Promise.all([
                this.getUserProfile(username),
                this.getUserRepos(username, 20)
            ]);

            // Analyze repositories for expertise and language preferences
            const languageStats = this.analyzeLanguageUsage(repos);
            const expertise = this.extractExpertise(repos, languageStats);
            
            // Analyze a few recent repositories for commit patterns
            const commitAnalysis = await this.analyzeCommitPatterns(username, repos.slice(0, 5));
            
            // Determine personality traits based on analysis
            const personality = this.inferPersonality(user, repos, commitAnalysis);
            
            // Infer code style preferences
            const codeStylePreferences = this.inferCodeStyle(languageStats, commitAnalysis);

            return {
                personality,
                codeStylePreferences,
                expertise,
                communicationPatterns: commitAnalysis
            };

        } catch (error) {
            console.error('Error analyzing GitHub profile:', error);
            throw error;
        }
    }

    private analyzeLanguageUsage(repos: GitHubRepo[]): Map<string, number> {
        const languageStats = new Map<string, number>();
        
        repos.forEach(repo => {
            if (repo.language) {
                const current = languageStats.get(repo.language) || 0;
                languageStats.set(repo.language, current + repo.size);
            }
        });

        return languageStats;
    }

    private extractExpertise(repos: GitHubRepo[], languageStats: Map<string, number>): string[] {
        const expertise: string[] = [];
        
        // Add top programming languages
        const sortedLanguages = Array.from(languageStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang]) => lang.toLowerCase());
        
        expertise.push(...sortedLanguages);

        // Extract expertise from repository topics and descriptions
        const topics = new Set<string>();
        const frameworks = new Set<string>();
        
        repos.forEach(repo => {
            repo.topics?.forEach(topic => topics.add(topic));
            
            // Look for common frameworks/technologies in descriptions
            const description = repo.description?.toLowerCase() || '';
            const commonTech = ['react', 'vue', 'angular', 'node', 'express', 'django', 'flask', 
                             'spring', 'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'tensorflow', 
                             'pytorch', 'mongodb', 'postgresql', 'redis', 'graphql'];
            
            commonTech.forEach(tech => {
                if (description.includes(tech)) {
                    frameworks.add(tech);
                }
            });
        });

        // Add most common topics and frameworks
        expertise.push(...Array.from(topics).slice(0, 8));
        expertise.push(...Array.from(frameworks).slice(0, 5));

        return [...new Set(expertise)]; // Remove duplicates
    }

    private async analyzeCommitPatterns(username: string, repos: GitHubRepo[]): Promise<any> {
        const commitMessages: string[] = [];
        let totalCommits = 0;
        
        for (const repo of repos.slice(0, 3)) { // Analyze top 3 repos to avoid rate limits
            try {
                const commits = await this.getRepoCommits(username, repo.name, 20);
                commitMessages.push(...commits.map(c => c.message));
                totalCommits += commits.length;
            } catch (error) {
                console.warn(`Could not fetch commits for ${repo.name}:`, error);
            }
        }

        const avgCommitMessageLength = commitMessages.length > 0 
            ? commitMessages.reduce((sum, msg) => sum + msg.length, 0) / commitMessages.length 
            : 50;

        const usesConventionalCommits = commitMessages.some(msg => 
            /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?: /.test(msg)
        );

        const commitFrequency = totalCommits > 100 ? 'high' : totalCommits > 30 ? 'medium' : 'low';

        const documentationStyle = avgCommitMessageLength > 100 ? 'detailed' 
            : avgCommitMessageLength > 50 ? 'concise' : 'minimal';

        return {
            avgCommitMessageLength,
            usesConventionalCommits,
            commitFrequency,
            documentationStyle
        };
    }

    private inferPersonality(user: GitHubUser, repos: GitHubRepo[], commitAnalysis: any): MentorPersonality {
        // Infer communication style
        let communicationStyle: MentorPersonality['communicationStyle'] = 'supportive';
        if (commitAnalysis.avgCommitMessageLength > 80) {
            communicationStyle = 'detailed';
        } else if (commitAnalysis.avgCommitMessageLength < 30) {
            communicationStyle = 'concise';
        }

        // Infer feedback approach based on repo activity and documentation
        let feedbackApproach: MentorPersonality['feedbackApproach'] = 'encouraging';
        if (commitAnalysis.usesConventionalCommits && repos.some(r => r.description?.includes('test'))) {
            feedbackApproach = 'analytical';
        } else if (user.public_repos > 50 && user.followers > 100) {
            feedbackApproach = 'pragmatic';
        }

        // Determine response length preference
        const responseLength: MentorPersonality['responseLength'] = 
            commitAnalysis.documentationStyle === 'detailed' ? 'detailed' :
            commitAnalysis.documentationStyle === 'minimal' ? 'brief' : 'moderate';

        // Extract focus areas from repository patterns
        const focusAreas: string[] = ['code quality'];
        if (repos.some(r => r.topics?.includes('testing') || r.name.includes('test'))) {
            focusAreas.push('testing');
        }
        if (repos.some(r => r.topics?.includes('documentation') || r.description?.includes('docs'))) {
            focusAreas.push('documentation');
        }
        if (repos.some(r => r.topics?.includes('performance') || r.description?.includes('optimization'))) {
            focusAreas.push('performance');
        }

        return {
            communicationStyle,
            feedbackApproach,
            expertise: [], // Will be filled by extractExpertise
            focusAreas,
            responseLength
        };
    }

    private inferCodeStyle(languageStats: Map<string, number>, commitAnalysis: any): CodeStylePreferences {
        const topLanguage = Array.from(languageStats.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0]?.toLowerCase();

        // Set defaults based on most used language
        let indentStyle: 'tabs' | 'spaces' = 'spaces';
        let indentSize = 2;
        let maxLineLength = 80;
        let preferredQuotes: 'single' | 'double' = 'single';
        let semicolons = true;
        let trailingCommas = true;
        let bracketSpacing = true;

        // Adjust based on language preferences
        switch (topLanguage) {
            case 'javascript':
            case 'typescript':
                indentSize = 2;
                maxLineLength = 100;
                preferredQuotes = 'single';
                break;
            case 'python':
                indentSize = 4;
                maxLineLength = 88;
                preferredQuotes = 'double';
                semicolons = false;
                break;
            case 'java':
            case 'c#':
                indentSize = 4;
                maxLineLength = 120;
                preferredQuotes = 'double';
                break;
            case 'go':
                indentStyle = 'tabs';
                maxLineLength = 100;
                preferredQuotes = 'double';
                break;
        }

        // Adjust based on commit patterns (more structured commits = more structured code style)
        if (commitAnalysis.usesConventionalCommits) {
            trailingCommas = true;
            bracketSpacing = true;
        }

        return {
            indentStyle,
            indentSize,
            maxLineLength,
            preferredQuotes,
            semicolons,
            trailingCommas,
            bracketSpacing
        };
    }

    public async createProfileFromGitHub(
        username: string, 
        role: MentorProfile['role'], 
        customName?: string
    ): Promise<Partial<MentorProfile>> {
        const analysis = await this.analyzeProfile(username);
        const user = await this.getUserProfile(username);

        const rolePrompts = this.generateRoleSpecificPrompts(role, username, analysis);

        return {
            name: customName || `${user.name || username} (${role})`,
            role,
            githubUsername: username,
            avatar: user.avatar_url,
            personality: {
                ...analysis.personality,
                expertise: analysis.expertise
            },
            codeStylePreferences: analysis.codeStylePreferences,
            prompts: rolePrompts
        };
    }

    private generateRoleSpecificPrompts(
        role: MentorProfile['role'], 
        username: string, 
        analysis: ProfileAnalysis
    ): MentorProfile['prompts'] {
        const basePersonality = `You are a coding mentor based on ${username}'s GitHub profile. ` +
            `Your communication style is ${analysis.personality.communicationStyle} and you provide ` +
            `${analysis.personality.feedbackApproach} feedback. Your expertise includes: ${analysis.expertise.join(', ')}.`;

        const roleSpecificTraits = {
            'boss': 'Focus on business impact, delivery timelines, and team productivity. Be direct and results-oriented.',
            'staff-engineer': 'Emphasize architectural decisions, scalability, and long-term technical strategy. Think systems-level.',
            'senior-dev': 'Mentor with patience, focus on clean code practices, and help others learn and grow.',
            'tech-lead': 'Balance technical excellence with team coordination and project delivery.',
            'mentor': 'Be supportive and educational, focusing on learning opportunities and skill development.',
            'custom': 'Adapt your mentoring style based on the specific context and needs.'
        };

        const roleContext = roleSpecificTraits[role];

        return {
            systemPrompt: `${basePersonality} ${roleContext}`,
            reviewPrompt: `Review this code as a ${role} would, considering ${analysis.personality.focusAreas.join(', ')}. ` +
                `Provide ${analysis.personality.responseLength} feedback in a ${analysis.personality.communicationStyle} manner.`,
            debuggingPrompt: `Help debug this issue with the approach of a ${role}. ${roleContext} ` +
                `Focus on ${analysis.personality.focusAreas.join(' and ')}.`,
            explanationPrompt: `Explain this code as a ${role} would, using your ${analysis.personality.communicationStyle} ` +
                `communication style and ${analysis.personality.responseLength} explanations.`
        };
    }
}
