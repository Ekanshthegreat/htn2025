import * as vscode from 'vscode';
import { MentorProfile, MentorPersonality, CodingStylePreferences, ArchitecturalPreferences, ExperienceBasedTraits } from './profileManager';
import { GeminiService } from './geminiService';

export interface GitHubUser {
    login: string;
    name: string;
    email?: string | null;
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
    codeStylePreferences: CodingStylePreferences;
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
    private geminiService: GeminiService;

    constructor() {
        this.loadApiToken();
        this.geminiService = new GeminiService();
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
            const codeStylePreferences = this.inferCodeStylePreferences(repos || [], user, commitAnalysis);
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

        // Infer architectural preferences based on repository analysis
        const architecturalPrefs = this.inferArchitecturalPreferences(repos, user, commitAnalysis);
        
        // Infer experience traits based on GitHub activity
        const experienceTraits = this.inferExperienceTraits(user, repos, commitAnalysis);

        return {
            communicationStyle,
            feedbackApproach,
            expertise: [], // Will be filled by extractExpertise
            focusAreas,
            responseLength,
            architecturalPrefs,
            experienceTraits
        };
    }

    private inferArchitecturalPreferences(repos: GitHubRepo[], user: GitHubUser, commitAnalysis: any): ArchitecturalPreferences {
        const preferredPatterns: string[] = [];
        let codeOrganization: ArchitecturalPreferences['codeOrganization'] = 'modular';
        let dependencyManagement: ArchitecturalPreferences['dependencyManagement'] = 'selective';
        let errorHandling: ArchitecturalPreferences['errorHandling'] = 'explicit';
        let testingApproach: ArchitecturalPreferences['testingApproach'] = 'unit-focused';
        let performancePriority: ArchitecturalPreferences['performancePriority'] = 'maintainability';

        // Analyze repository structure patterns
        const hasLargeMonorepos = repos.some(r => r.size > 10000);
        const hasManySmallRepos = repos.filter(r => r.size < 1000).length > repos.length * 0.7;
        const hasTestingRepos = repos.some(r => r.topics?.includes('testing') || r.name.includes('test'));
        const hasPerformanceRepos = repos.some(r => r.topics?.includes('performance') || r.description?.includes('optimization'));
        const hasArchitectureRepos = repos.some(r => r.topics?.includes('architecture') || r.topics?.includes('microservices'));

        // Infer architectural patterns based on repo analysis
        if (hasArchitectureRepos || repos.some(r => r.topics?.includes('microservices'))) {
            preferredPatterns.push('microservices');
            codeOrganization = 'component-based';
        }
        if (repos.some(r => r.topics?.includes('mvc') || r.description?.includes('mvc'))) {
            preferredPatterns.push('mvc');
            codeOrganization = 'layered';
        }
        if (repos.some(r => r.topics?.includes('clean-architecture') || r.description?.includes('clean'))) {
            preferredPatterns.push('clean-architecture');
        }
        if (repos.some(r => r.topics?.includes('event-driven') || r.description?.includes('event'))) {
            preferredPatterns.push('event-driven');
        }

        // Infer code organization style
        if (hasManySmallRepos) {
            codeOrganization = 'modular';
            dependencyManagement = 'minimal';
        } else if (hasLargeMonorepos) {
            codeOrganization = 'monolithic';
            dependencyManagement = 'comprehensive';
        }

        // Infer testing approach
        if (hasTestingRepos) {
            if (repos.some(r => r.topics?.includes('tdd') || r.description?.includes('tdd'))) {
                testingApproach = 'tdd';
            } else if (repos.some(r => r.topics?.includes('bdd') || r.description?.includes('bdd'))) {
                testingApproach = 'bdd';
            } else if (repos.some(r => r.topics?.includes('integration') || r.description?.includes('integration'))) {
                testingApproach = 'integration-first';
            }
        }

        // Infer error handling style based on commit patterns
        if (commitAnalysis.usesConventionalCommits) {
            errorHandling = 'defensive';
        } else if (user.public_repos > 100) {
            errorHandling = 'fail-fast';
        }

        // Infer performance priority
        if (hasPerformanceRepos) {
            performancePriority = 'speed';
        } else if (repos.some(r => r.topics?.includes('scalability'))) {
            performancePriority = 'scalability';
        } else if (repos.some(r => r.topics?.includes('memory') || r.description?.includes('memory'))) {
            performancePriority = 'memory';
        }

        return {
            preferredPatterns,
            codeOrganization,
            dependencyManagement,
            errorHandling,
            testingApproach,
            performancePriority
        };
    }

    private inferExperienceTraits(user: GitHubUser, repos: GitHubRepo[], commitAnalysis: any): ExperienceBasedTraits {
        // Calculate years of experience based on account age
        const accountAge = new Date().getFullYear() - new Date(user.created_at).getFullYear();
        const yearsOfExperience = Math.max(1, accountAge);

        // Extract primary languages from repos
        const languageCount = new Map<string, number>();
        repos.forEach(repo => {
            if (repo.language) {
                languageCount.set(repo.language, (languageCount.get(repo.language) || 0) + 1);
            }
        });
        const primaryLanguages = Array.from(languageCount.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([lang]) => lang);

        // Infer architectural philosophy based on repo patterns
        let architecturalPhilosophy = 'Keep it simple and maintainable';
        if (repos.some(r => r.topics?.includes('microservices'))) {
            architecturalPhilosophy = 'Distributed systems with clear service boundaries';
        } else if (repos.some(r => r.topics?.includes('functional'))) {
            architecturalPhilosophy = 'Functional programming with immutable data structures';
        } else if (repos.some(r => r.topics?.includes('performance'))) {
            architecturalPhilosophy = 'Performance-first with optimized algorithms';
        } else if (repos.some(r => r.topics?.includes('clean-code'))) {
            architecturalPhilosophy = 'Clean code principles with SOLID design';
        }

        // Infer code review style based on activity and followers
        let codeReviewStyle: ExperienceBasedTraits['codeReviewStyle'] = 'collaborative';
        if (user.followers > 1000) {
            codeReviewStyle = 'mentoring';
        } else if (commitAnalysis.usesConventionalCommits) {
            codeReviewStyle = 'thorough';
        } else if (user.public_repos > 50) {
            codeReviewStyle = 'focused';
        }

        // Infer problem-solving approach
        let problemSolvingApproach: ExperienceBasedTraits['problemSolvingApproach'] = 'systematic';
        if (repos.some(r => r.topics?.includes('research') || r.description?.includes('research'))) {
            problemSolvingApproach = 'research-first';
        } else if (repos.some(r => r.topics?.includes('prototype') || r.description?.includes('experiment'))) {
            problemSolvingApproach = 'experimental';
        } else if (commitAnalysis.commitFrequency === 'high') {
            problemSolvingApproach = 'intuitive';
        }

        // Infer learning style
        let learningStyle: ExperienceBasedTraits['learningStyle'] = 'hands-on';
        if (repos.some(r => r.topics?.includes('documentation') || r.description?.includes('docs'))) {
            learningStyle = 'documentation-first';
        } else if (repos.some(r => r.topics?.includes('tutorial') || r.description?.includes('learn'))) {
            learningStyle = 'theoretical';
        } else if (user.following > user.followers) {
            learningStyle = 'community-driven';
        }

        return {
            yearsOfExperience,
            primaryLanguages,
            architecturalPhilosophy,
            codeReviewStyle,
            problemSolvingApproach,
            learningStyle
        };
    }

    private inferCodeStylePreferences(repos: GitHubRepo[], user: GitHubUser, commitAnalysis: any): CodingStylePreferences {
        // Analyze language usage to determine top language
        const languageCount = new Map<string, number>();
        repos.forEach(repo => {
            if (repo.language) {
                languageCount.set(repo.language, (languageCount.get(repo.language) || 0) + repo.size);
            }
        });
        const topLanguage = Array.from(languageCount.entries())
            .sort((a, b) => b[1] - a[1])[0]?.[0]?.toLowerCase();

        // Set defaults based on most used language
        let indentStyle: 'tabs' | 'spaces' = 'spaces';
        let indentSize = 2;
        let maxLineLength = 80;
        let preferredQuotes: 'single' | 'double' = 'single';
        let semicolons = true;
        let trailingCommas = true;
        let bracketSpacing = true;
        let functionStyle: 'arrow' | 'function' | 'mixed' = 'arrow';
        let variableNaming: 'camelCase' | 'snake_case' | 'kebab-case' = 'camelCase';
        let commentStyle: 'minimal' | 'descriptive' | 'verbose' = 'descriptive';
        let importOrganization: 'grouped' | 'alphabetical' | 'by-usage' = 'grouped';

        // Adjust based on language preferences
        switch (topLanguage) {
            case 'javascript':
            case 'typescript':
                indentSize = 2;
                maxLineLength = 100;
                preferredQuotes = 'single';
                functionStyle = 'arrow';
                variableNaming = 'camelCase';
                break;
            case 'python':
                indentSize = 4;
                maxLineLength = 88;
                preferredQuotes = 'double';
                semicolons = false;
                functionStyle = 'function';
                variableNaming = 'snake_case';
                break;
            case 'java':
            case 'c#':
                indentSize = 4;
                maxLineLength = 120;
                preferredQuotes = 'double';
                functionStyle = 'function';
                variableNaming = 'camelCase';
                break;
            case 'go':
                indentStyle = 'tabs';
                maxLineLength = 100;
                preferredQuotes = 'double';
                functionStyle = 'function';
                variableNaming = 'camelCase';
                break;
            case 'rust':
                indentSize = 4;
                maxLineLength = 100;
                preferredQuotes = 'double';
                functionStyle = 'function';
                variableNaming = 'snake_case';
                break;
        }

        // Adjust based on commit patterns and experience
        if (commitAnalysis.usesConventionalCommits) {
            trailingCommas = true;
            bracketSpacing = true;
            commentStyle = 'descriptive';
            importOrganization = 'grouped';
        }

        // Adjust based on repository patterns
        if (repos.some(r => r.topics?.includes('documentation'))) {
            commentStyle = 'verbose';
        } else if (repos.some(r => r.topics?.includes('minimal') || r.description?.includes('minimal'))) {
            commentStyle = 'minimal';
        }

        // Adjust function style based on modern practices
        if (user.created_at && new Date(user.created_at).getFullYear() > 2015 && topLanguage === 'javascript') {
            functionStyle = 'arrow';
        }

        return {
            indentStyle,
            indentSize,
            maxLineLength,
            preferredQuotes,
            semicolons,
            trailingCommas,
            bracketSpacing,
            functionStyle,
            variableNaming,
            commentStyle,
            importOrganization
        };
    }

    public async createProfileFromGitHub(
        username: string, 
        customName?: string,
        manualEmail?: string
    ): Promise<Partial<MentorProfile>> {
        try {
            console.log(`Creating profile from GitHub for: ${username}`);
            
            const analysis = await this.analyzeProfile(username);
            console.log(`Analysis completed:`, analysis);
            
            const user = await this.getUserProfile(username);
            console.log(`User data:`, user);

            const prompts = await this.generatePrompts(username, analysis);
            console.log(`Generated prompts:`, prompts);

            const profile: Partial<MentorProfile> = {
                name: customName || user.name || username,
                githubUsername: username,
                contactEmail: manualEmail || user.email,
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

    private async generatePrompts(
        username: string, 
        analysis: ProfileAnalysis
    ): Promise<MentorProfile['prompts']> {
        try {
            // Prepare comprehensive data for Gemini
            const user = await this.getUserProfile(username);
            const repos = await this.getUserRepos(username, 20);
            
            // Create rich context for Gemini
            const userProfile = {
                name: user.name,
                bio: user.bio,
                publicRepos: user.public_repos,
                followers: user.followers,
                following: user.following,
                createdAt: user.created_at
            };

            const topRepositories = repos.slice(0, 10).map(repo => ({
                name: repo.name,
                language: repo.language,
                description: repo.description,
                stars: repo.stargazers_count,
                topics: repo.topics
            }));

            // Use Gemini function calling for guaranteed JSON structure
            const customPrompts = await this.geminiService.generateMentorPrompts(
                username,
                userProfile,
                analysis,
                topRepositories
            );

            if (customPrompts) {
                console.log(`Generated custom prompts for ${username}:`, customPrompts);
                return customPrompts;
            }

            // Fallback to enhanced template-based generation
            return this.generateFallbackPrompts(username, analysis);

        } catch (error) {
            console.error('Error generating custom prompts:', error);
            return this.generateFallbackPrompts(username, analysis);
        }
    }

    private generateFallbackPrompts(
        username: string, 
        analysis: ProfileAnalysis
    ): MentorProfile['prompts'] {
        const expertise = analysis.expertise || [];
        const focusAreas = analysis.personality.focusAreas || ['code quality'];
        
        // Enhanced fallback with special cases
        let personalityDesc = '';
        const lowerUsername = username.toLowerCase();
        
        if (lowerUsername === 'torvalds') {
            personalityDesc = 'You are Linus Torvalds, creator of Linux and Git. You are known for your direct, no-nonsense approach to code review and your deep understanding of systems programming. You value performance, simplicity, and correctness above all else. You can be blunt but always focus on technical merit.';
        } else if (lowerUsername === 'gvanrossum') {
            personalityDesc = 'You are Guido van Rossum, creator of Python. You believe in code readability and elegant solutions. You prefer explicit over implicit and simple over complex. Your philosophy emphasizes that code is read more often than written.';
        } else if (lowerUsername === 'tj') {
            personalityDesc = 'You are TJ Holowaychuk, prolific Node.js developer and creator of Express.js. You focus on clean, minimalist code and rapid prototyping. You value simplicity and developer experience.';
        } else {
            personalityDesc = `You are a coding mentor based on ${username}'s GitHub profile and coding patterns. Your communication style is ${analysis.personality.communicationStyle} and you provide ${analysis.personality.feedbackApproach} feedback.`;
        }

        const basePersonality = personalityDesc + 
            (expertise.length > 0 ? ` Your expertise includes: ${expertise.join(', ')}.` : '') +
            ` You focus on ${focusAreas.join(', ')}.`;

        return {
            systemPrompt: `${basePersonality} Provide ${analysis.personality.responseLength} responses that reflect your authentic coding style and technical philosophy.`,
            reviewPrompt: `Review this code as ${username} would, focusing on ${focusAreas.join(', ')}. Consider your known standards and provide ${analysis.personality.feedbackApproach} feedback in your characteristic ${analysis.personality.communicationStyle} manner.`,
            debuggingPrompt: `Help debug this issue using ${username}'s systematic approach. Focus on ${focusAreas.join(' and ')} and apply your problem-solving methodology.`,
            explanationPrompt: `Explain this code as ${username} would, using your ${analysis.personality.communicationStyle} communication style with ${analysis.personality.responseLength} explanations. Draw from your experience with ${expertise.join(', ')}.`
        };
    }
}
