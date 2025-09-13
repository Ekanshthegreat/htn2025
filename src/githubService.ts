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

        // Use Node.js https module instead of fetch
        const https = require('https');
        
        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.github.com',
                path: url,
                method: 'GET',
                headers: {
                    'Authorization': `token ${this.apiToken}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AI-Debugger-Mentor'
                }
            };

            const req = https.request(options, (res: any) => {
                let data = '';
                
                res.on('data', (chunk: any) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (error) {
                            reject(new Error('Invalid JSON response from GitHub API'));
                        }
                    } else {
                        reject(new Error(`GitHub API error: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
            });

            req.on('error', (error: any) => {
                reject(new Error(`GitHub API request failed: ${error.message}`));
            });

            req.end();
        });
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
            console.log(`Starting profile analysis for: ${username}`);
            
            const [user, repos] = await Promise.all([
                this.getUserProfile(username),
                this.getUserRepos(username, 20)
            ]);
            
            console.log(`Fetched user data and ${repos?.length || 0} repositories`);

            // Analyze repositories for expertise and language preferences
            const languageStats = this.analyzeLanguageUsage(repos || []);
            console.log(`Language stats:`, Array.from(languageStats.entries()));
            
            const expertise = this.extractExpertise(repos || [], languageStats);
            console.log(`Extracted expertise:`, expertise);
            
            // Analyze a few recent repositories for commit patterns
            const commitAnalysis = await this.analyzeCommitPatterns(username, (repos || []).slice(0, 5));
            console.log(`Commit analysis:`, commitAnalysis);
            
            // Determine personality traits based on analysis
            const personality = this.inferPersonality(user, repos || [], commitAnalysis);
            console.log(`Inferred personality:`, personality);
            
            // Infer code style preferences
            const codeStylePreferences = this.inferCodeStyle(languageStats, commitAnalysis);
            console.log(`Code style preferences:`, codeStylePreferences);

            return {
                personality,
                codeStylePreferences,
                expertise,
                communicationPatterns: commitAnalysis
            };

        } catch (error) {
            console.error('Error analyzing GitHub profile:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    private analyzeLanguageUsage(repos: GitHubRepo[]): Map<string, number> {
        console.log(`Analyzing language usage for ${repos?.length || 0} repos`);
        const languageStats = new Map<string, number>();
        
        if (!repos || !Array.isArray(repos)) {
            console.warn('No repos provided or repos is not an array');
            return languageStats;
        }
        
        repos.forEach((repo, index) => {
            console.log(`Processing repo ${index}: ${repo?.name}, language: ${repo?.language}`);
            if (repo && repo.language) {
                const current = languageStats.get(repo.language) || 0;
                languageStats.set(repo.language, current + (repo.size || 0));
            }
        });

        return languageStats;
    }

    private extractExpertise(repos: GitHubRepo[], languageStats: Map<string, number>): string[] {
        console.log(`Extracting expertise from ${repos?.length || 0} repos`);
        const expertise: string[] = [];
        
        if (!repos || !Array.isArray(repos)) {
            console.warn('No repos provided for expertise extraction');
            return expertise;
        }
        
        // Add top programming languages
        const sortedLanguages = Array.from(languageStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([lang]) => lang.toLowerCase());
        
        console.log(`Top languages:`, sortedLanguages);
        expertise.push(...sortedLanguages);

        // Extract expertise from repository topics and descriptions
        const topics = new Set<string>();
        const frameworks = new Set<string>();
        
        repos.forEach((repo, index) => {
            if (!repo) {
                console.warn(`Repo at index ${index} is null/undefined`);
                return;
            }
            
            if (repo.topics && Array.isArray(repo.topics)) {
                repo.topics.forEach(topic => topics.add(topic));
            }
            
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
        const topicsArray = Array.from(topics).slice(0, 8);
        const frameworksArray = Array.from(frameworks).slice(0, 5);
        
        console.log(`Topics found:`, topicsArray);
        console.log(`Frameworks found:`, frameworksArray);
        
        expertise.push(...topicsArray);
        expertise.push(...frameworksArray);

        const finalExpertise = [...new Set(expertise)]; // Remove duplicates
        console.log(`Final expertise array:`, finalExpertise);
        return finalExpertise;
    }

    private async analyzeCommitPatterns(username: string, repos: GitHubRepo[]): Promise<any> {
        const commitMessages: string[] = [];
        let totalCommits = 0;
        
        for (const repo of repos.slice(0, 3)) { // Analyze top 3 repos to avoid rate limits
            try {
                const commits = await this.getRepoCommits(username, repo.name, 20);
                if (commits && Array.isArray(commits)) {
                    commitMessages.push(...commits.map(c => c?.message).filter(msg => msg != null));
                    totalCommits += commits.length;
                }
            } catch (error) {
                console.warn(`Could not fetch commits for ${repo.name}:`, error);
            }
        }

        const avgCommitMessageLength = commitMessages.length > 0 
            ? commitMessages.reduce((sum, msg) => sum + (msg?.length || 0), 0) / commitMessages.length 
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
        customName?: string
    ): Promise<Partial<MentorProfile>> {
        try {
            console.log(`Creating profile from GitHub for: ${username}`);
            
            const analysis = await this.analyzeProfile(username);
            console.log(`Analysis completed:`, analysis);
            
            const user = await this.getUserProfile(username);
            console.log(`User data:`, user);

            const prompts = this.generatePrompts(username, analysis);
            console.log(`Generated prompts:`, prompts);

            const profile = {
                name: customName || user.name || username,
                githubUsername: username,
                avatar: user.avatar_url,
                personality: {
                    ...analysis.personality,
                    expertise: analysis.expertise || []
                },
                codeStylePreferences: analysis.codeStylePreferences,
                prompts: prompts
            };
            
            console.log(`Final profile created:`, profile);
            return profile;
        } catch (error) {
            console.error(`Error in createProfileFromGitHub for ${username}:`, error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }

    private generatePrompts(
        username: string, 
        analysis: ProfileAnalysis
    ): MentorProfile['prompts'] {
        const expertise = analysis.expertise || [];
        const focusAreas = analysis.personality.focusAreas || ['code quality'];
        
        const basePersonality = `You are a coding mentor based on ${username}'s GitHub profile. ` +
            `Your communication style is ${analysis.personality.communicationStyle} and you provide ` +
            `${analysis.personality.feedbackApproach} feedback.` +
            (expertise.length > 0 ? ` Your expertise includes: ${expertise.join(', ')}.` : '');

        return {
            systemPrompt: basePersonality,
            reviewPrompt: `Review this code considering ${focusAreas.join(', ')}. ` +
                `Provide ${analysis.personality.responseLength} feedback in a ${analysis.personality.communicationStyle} manner.`,
            debuggingPrompt: `Help debug this issue focusing on ${focusAreas.join(' and ')}.`,
            explanationPrompt: `Explain this code using your ${analysis.personality.communicationStyle} ` +
                `communication style with ${analysis.personality.responseLength} explanations.`
        };
    }
}
