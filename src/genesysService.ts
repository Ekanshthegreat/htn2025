import * as vscode from 'vscode';

export interface UserBehaviorAnalysis {
    sentiment: 'positive' | 'negative' | 'neutral';
    emotionalState: 'frustrated' | 'confident' | 'confused' | 'focused';
    engagementLevel: 'high' | 'medium' | 'low';
    topics: string[];
    patterns: {
        errorFrequency: number;
        debuggingTime: number;
        codeComplexity: 'simple' | 'moderate' | 'complex';
        workingPattern: 'consistent' | 'burst' | 'sporadic';
    };
    empathyScore: number;
    suggestedApproach: 'supportive' | 'direct' | 'encouraging' | 'patient';
}

export interface EmpathyAnalysisResult {
    empathyPrompt: string;
    developerPersona: string;
    suggestedTone: 'supportive' | 'direct' | 'encouraging' | 'patient';
    empathyScore: number;
}

export interface GitHubEmpathyData {
    empathyPrompt: string;
    developerPersona: string;
    suggestedTone: 'supportive' | 'direct' | 'encouraging' | 'patient';
    empathyScore: number;
    analysisMetadata: {
        profileAnalyzedAt: Date;
        sentimentScore: number;
        topicsDetected: string[];
        developerLevel: 'junior' | 'mid' | 'senior' | 'expert';
    };
}

export class GenesysService {
    private providedToken: string | undefined;
    private environment: string = 'mypurecloud.com';

    constructor() {
        this.loadConfiguration();
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        this.providedToken = config.get<string>('genesysAccessToken');
        this.environment = config.get<string>('genesysEnvironment', 'mypurecloud.com');
    }

    public async analyzeGitHubProfileForEmpathy(githubProfile: any): Promise<EmpathyAnalysisResult> {
        try {
            // Always use fallback analysis to prevent memory issues and API failures
            return this.fallbackGitHubAnalysis(githubProfile);
        } catch (error) {
            console.error('GitHub analysis failed:', error);
            return this.createDefaultAnalysis();
        }
    }

    public async analyzeUserBehavior(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): Promise<UserBehaviorAnalysis> {
        try {
            return this.fallbackBehaviorAnalysis(codeContent, userActions, sessionData);
        } catch (error) {
            console.error('Behavior analysis failed:', error);
            return this.createDefaultBehaviorAnalysis();
        }
    }

    private fallbackGitHubAnalysis(githubProfile: any): EmpathyAnalysisResult {
        const level = this.assessDeveloperLevel(githubProfile);
        const empathyScore = this.calculateGitHubEmpathyScore(githubProfile);
        const workingPattern = this.analyzeGitHubWorkingPattern(githubProfile);
        
        return {
            empathyPrompt: this.generateEmpathyPrompt(githubProfile, level, empathyScore),
            developerPersona: this.createDeveloperPersona(githubProfile, level, workingPattern),
            suggestedTone: this.suggestToneFromProfile(empathyScore, level),
            empathyScore
        };
    }

    private fallbackBehaviorAnalysis(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis {
        const behaviorText = `${codeContent.slice(0, 1000)} ${userActions.slice(-10).map(a => a.action).join(' ')}`;
        const sentiment = this.analyzeSentimentFallback(behaviorText);
        const patterns = this.analyzePatterns(userActions, sessionData);
        
        return {
            sentiment: this.mapSentimentToCategory(sentiment.sentiment),
            emotionalState: this.determineEmotionalState(sentiment, patterns),
            engagementLevel: this.determineEngagementLevel(patterns, sessionData),
            topics: this.detectTopicsFallback(behaviorText).map(t => t.topic),
            patterns,
            empathyScore: this.calculateBehaviorEmpathyScore(sentiment, patterns, sessionData),
            suggestedApproach: this.suggestApproach(sentiment, patterns, sessionData)
        };
    }

    private assessDeveloperLevel(githubProfile: any): 'junior' | 'mid' | 'senior' | 'expert' {
        const repoCount = githubProfile?.repositories?.length || 0;
        const commitCount = githubProfile?.commits?.length || 0;
        
        if (repoCount < 5 && commitCount < 50) return 'junior';
        if (repoCount < 15 && commitCount < 200) return 'mid';
        if (repoCount < 30 && commitCount < 500) return 'senior';
        return 'expert';
    }

    private calculateGitHubEmpathyScore(githubProfile: any): number {
        let score = 50;
        const level = this.assessDeveloperLevel(githubProfile);
        
        if (level === 'junior') score += 30;
        else if (level === 'mid') score += 15;
        else if (level === 'expert') score -= 10;

        const repositories = githubProfile?.repositories || [];
        const commits = githubProfile?.commits || [];
        if (repositories.length < 3) score += 20;
        if (commits.length < 20) score += 15;

        return Math.max(0, Math.min(100, score));
    }

    private analyzeGitHubWorkingPattern(githubProfile: any): 'consistent' | 'burst' | 'sporadic' | 'methodical' {
        const repoCount = githubProfile?.repositories?.length || 0;
        const commitCount = githubProfile?.commits?.length || 0;
        
        if (commitCount > repoCount * 20) return 'consistent';
        if (commitCount > repoCount * 10) return 'methodical';
        if (repoCount > 10 && commitCount < repoCount * 5) return 'burst';
        return 'sporadic';
    }

    private generateEmpathyPrompt(githubProfile: any, level: string, empathyScore: number): string {
        const languages = githubProfile?.languages ? Object.keys(githubProfile.languages).slice(0, 3).join(', ') : 'various technologies';
        let basePrompt = `You are mentoring a ${level}-level developer who primarily works with ${languages}.`;
        
        if (empathyScore > 70) {
            basePrompt += ` This developer may be new to some concepts, so be extra patient and supportive. Break down complex ideas into digestible steps.`;
        } else if (empathyScore > 40) {
            basePrompt += ` This developer has some experience but may benefit from gentle guidance. Provide clear explanations with examples.`;
        } else {
            basePrompt += ` This developer is experienced and prefers direct, technical guidance. Focus on efficiency and advanced concepts.`;
        }

        return basePrompt;
    }

    private createDeveloperPersona(githubProfile: any, level: string, workingPattern: string): string {
        const topLang = githubProfile?.languages ? Object.keys(githubProfile.languages)[0] || 'JavaScript' : 'JavaScript';
        const expertise = githubProfile?.expertise ? githubProfile.expertise.slice(0, 2).join(' and ') : 'various technologies';
        
        return `${level.charAt(0).toUpperCase() + level.slice(1)} ${topLang} developer with ${workingPattern} working patterns. Expertise in ${expertise}.`;
    }

    private suggestToneFromProfile(empathyScore: number, developerLevel: string): 'supportive' | 'direct' | 'encouraging' | 'patient' {
        if (empathyScore > 70 || developerLevel === 'junior') return 'patient';
        if (empathyScore > 50) return 'supportive';
        if (developerLevel === 'expert') return 'direct';
        return 'encouraging';
    }

    private analyzePatterns(
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis['patterns'] {
        return {
            errorFrequency: sessionData.errorCount,
            debuggingTime: sessionData.duration,
            codeComplexity: this.assessCodeComplexity(userActions),
            workingPattern: this.analyzeBehaviorWorkingPattern(userActions)
        };
    }

    private assessCodeComplexity(userActions: Array<{ action: string; timestamp: Date; context?: any }>): 'simple' | 'moderate' | 'complex' {
        const complexPatterns = userActions.filter(a => 
            a.action.includes('async') || 
            a.action.includes('class') || 
            a.action.includes('interface') ||
            a.action.includes('generic')
        ).length;

        return complexPatterns > 5 ? 'complex' : complexPatterns > 2 ? 'moderate' : 'simple';
    }

    private analyzeBehaviorWorkingPattern(userActions: Array<{ action: string; timestamp: Date; context?: any }>): 'consistent' | 'burst' | 'sporadic' {
        if (userActions.length < 2) return 'sporadic';
        
        const timeSpan = userActions[userActions.length - 1].timestamp.getTime() - userActions[0].timestamp.getTime();
        const actionsPerMinute = userActions.length / (timeSpan / 60000);
        
        if (actionsPerMinute > 5) return 'consistent';
        if (actionsPerMinute > 2) return 'burst';
        return 'sporadic';
    }

    private analyzeSentimentFallback(text: string): { sentiment: number; confidence: number } {
        const negativeWords = ['error', 'bug', 'fail', 'wrong', 'issue', 'problem', 'stuck'];
        const positiveWords = ['work', 'good', 'success', 'complete', 'fix', 'solve'];
        
        const words = text.toLowerCase().split(/\s+/).slice(0, 100); // Limit to prevent memory issues
        const negCount = words.filter(w => negativeWords.some(neg => w.includes(neg))).length;
        const posCount = words.filter(w => positiveWords.some(pos => w.includes(pos))).length;
        
        const sentiment = (posCount - negCount) / Math.max(words.length, 1);
        return { sentiment, confidence: 0.7 };
    }

    private detectTopicsFallback(text: string): Array<{ topic: string; confidence: number }> {
        const topics = [
            { keywords: ['javascript', 'js', 'node', 'react'], topic: 'JavaScript' },
            { keywords: ['python', 'django', 'flask'], topic: 'Python' },
            { keywords: ['typescript', 'ts'], topic: 'TypeScript' },
            { keywords: ['api', 'rest', 'endpoint'], topic: 'API Development' },
            { keywords: ['database', 'sql'], topic: 'Database' },
            { keywords: ['test', 'testing'], topic: 'Testing' },
            { keywords: ['debug', 'error', 'bug'], topic: 'Debugging' }
        ];

        return topics
            .map(({ keywords, topic }) => {
                const matches = keywords.filter(keyword => 
                    text.toLowerCase().includes(keyword)
                ).length;
                return { topic, confidence: matches / keywords.length };
            })
            .filter(t => t.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }

    private determineEmotionalState(
        sentiment: { sentiment: number; confidence: number },
        patterns: UserBehaviorAnalysis['patterns']
    ): UserBehaviorAnalysis['emotionalState'] {
        if (sentiment.sentiment < -0.5 && patterns.errorFrequency > 10) return 'frustrated';
        if (sentiment.sentiment > 0.5 && patterns.workingPattern === 'consistent') return 'confident';
        if (patterns.errorFrequency > 5 && patterns.workingPattern === 'sporadic') return 'confused';
        if (sentiment.sentiment > 0.3) return 'focused';
        return 'frustrated';
    }

    private calculateBehaviorEmpathyScore(
        sentiment: { sentiment: number; confidence: number },
        patterns: UserBehaviorAnalysis['patterns'],
        sessionData: { duration: number; errorCount: number; completions: number }
    ): number {
        let score = 50;

        if (sentiment.sentiment < -0.5) score += 30;
        else if (sentiment.sentiment < 0) score += 15;

        if (patterns.errorFrequency > 10) score += 25;
        else if (patterns.errorFrequency > 5) score += 10;

        if (sessionData.duration > 3600 && sessionData.completions < 3) score += 20;

        if (sentiment.sentiment > 0.3 && patterns.workingPattern === 'consistent') score -= 20;

        return Math.max(0, Math.min(100, score));
    }

    private suggestApproach(
        sentiment: { sentiment: number; confidence: number },
        patterns: UserBehaviorAnalysis['patterns'],
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis['suggestedApproach'] {
        const empathyScore = this.calculateBehaviorEmpathyScore(sentiment, patterns, sessionData);
        
        if (empathyScore > 70 || patterns.errorFrequency > 10) return 'patient';
        if (sentiment.sentiment > 0.3 && patterns.workingPattern === 'consistent') return 'direct';
        if (empathyScore > 40 || sentiment.sentiment < 0) return 'encouraging';
        return 'supportive';
    }

    private mapSentimentToCategory(sentiment: number): UserBehaviorAnalysis['sentiment'] {
        if (sentiment < -0.3) return 'negative';
        if (sentiment > 0.3) return 'positive';
        return 'neutral';
    }

    private determineEngagementLevel(
        patterns: UserBehaviorAnalysis['patterns'],
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis['engagementLevel'] {
        const actionsPerMinute = sessionData.completions / Math.max(sessionData.duration / 60, 1);
        
        if (actionsPerMinute > 5 && patterns.workingPattern !== 'sporadic') return 'high';
        if (actionsPerMinute > 2 || patterns.workingPattern === 'consistent') return 'medium';
        return 'low';
    }

    private createDefaultAnalysis(): EmpathyAnalysisResult {
        return {
            empathyPrompt: 'You are mentoring a developer. Be supportive and provide clear guidance.',
            developerPersona: 'Developer working on various technologies',
            suggestedTone: 'supportive',
            empathyScore: 50
        };
    }

    private createDefaultBehaviorAnalysis(): UserBehaviorAnalysis {
        return {
            sentiment: 'neutral',
            emotionalState: 'focused',
            engagementLevel: 'medium',
            topics: ['coding'],
            patterns: {
                errorFrequency: 0,
                debuggingTime: 0,
                codeComplexity: 'simple',
                workingPattern: 'consistent'
            },
            empathyScore: 50,
            suggestedApproach: 'supportive'
        };
    }
}
