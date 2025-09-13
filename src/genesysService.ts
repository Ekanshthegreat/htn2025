import * as vscode from 'vscode';

export interface UserBehaviorAnalysis {
    sentiment: 'positive' | 'negative' | 'neutral' | 'frustrated' | 'confused';
    emotionalState: 'calm' | 'stressed' | 'excited' | 'overwhelmed' | 'focused';
    engagementLevel: 'high' | 'medium' | 'low';
    topics: string[];
    patterns: {
        typingSpeed: 'fast' | 'normal' | 'slow';
        errorFrequency: 'high' | 'medium' | 'low';
        sessionDuration: number;
        codeComplexity: 'beginner' | 'intermediate' | 'advanced';
    };
    empathyScore: number; // 0-100, how much empathy the user needs
    suggestedApproach: 'encouraging' | 'direct' | 'detailed' | 'patient';
}

export interface GenesysAnalyticsData {
    conversationId: string;
    userId: string;
    sentiment: {
        overall: number; // -1 to 1
        trend: 'improving' | 'declining' | 'stable';
    };
    topics: Array<{
        name: string;
        confidence: number;
        sentiment: number;
    }>;
    emotionalMarkers: Array<{
        emotion: string;
        intensity: number;
        timestamp: string;
    }>;
}

export class GenesysService {
    private apiKey: string | undefined;
    private environment: string | undefined;
    private baseUrl: string = '';
    private accessToken: string | undefined;

    constructor() {
        this.loadConfiguration();
    }

    private loadConfiguration() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        this.apiKey = config.get<string>('genesysApiKey');
        this.environment = config.get<string>('genesysEnvironment', 'mypurecloud.com');
        this.baseUrl = `https://api.${this.environment}`;
    }

    private async authenticate(): Promise<string> {
        if (!this.apiKey) {
            throw new Error('Genesys API key not configured. Please set aiMentor.genesysApiKey in settings.');
        }

        if (this.accessToken) {
            return this.accessToken;
        }

        try {
            const response = await fetch(`${this.baseUrl}/oauth/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(this.apiKey).toString('base64')}`
                },
                body: 'grant_type=client_credentials'
            });

            if (!response.ok) {
                throw new Error(`Genesys authentication failed: ${response.status}`);
            }

            const data = await response.json();
            this.accessToken = data.access_token;
            
            // Refresh token before expiry
            setTimeout(() => {
                this.accessToken = undefined;
            }, (data.expires_in - 60) * 1000);

            return this.accessToken;
        } catch (error) {
            console.error('Genesys authentication error:', error);
            throw error;
        }
    }

    private async makeGenesysRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
        const token = await this.authenticate();
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });

        if (!response.ok) {
            throw new Error(`Genesys API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    public async analyzeSentiment(text: string): Promise<{ sentiment: number; confidence: number }> {
        try {
            const response = await this.makeGenesysRequest('/api/v2/textbots/sentiment', {
                method: 'POST',
                body: JSON.stringify({
                    text: text,
                    language: 'en-us'
                })
            });

            return {
                sentiment: response.sentiment || 0,
                confidence: response.confidence || 0.5
            };
        } catch (error) {
            console.warn('Genesys sentiment analysis failed, using fallback:', error);
            return this.fallbackSentimentAnalysis(text);
        }
    }

    public async detectTopics(text: string): Promise<Array<{ topic: string; confidence: number }>> {
        try {
            const response = await this.makeGenesysRequest('/api/v2/textbots/topics', {
                method: 'POST',
                body: JSON.stringify({
                    text: text,
                    language: 'en-us'
                })
            });

            return response.topics || [];
        } catch (error) {
            console.warn('Genesys topic detection failed, using fallback:', error);
            return this.fallbackTopicDetection(text);
        }
    }

    public async analyzeGitHubProfileForEmpathy(
        githubProfile: {
            user: any;
            repositories: any[];
            commits: any[];
            languages: Record<string, number>;
            experience: string;
            workingStyle: string;
            expertise: string[];
        }
    ): Promise<{
        empathyPrompt: string;
        developerPersona: string;
        suggestedTone: 'supportive' | 'direct' | 'encouraging' | 'patient';
        empathyScore: number;
    }> {
        try {
            // Create analysis text from GitHub profile data
            const profileText = this.createGitHubAnalysisText(githubProfile);
            
            // Get sentiment and topics from Genesys APIs
            const [sentimentResult, topics] = await Promise.all([
                this.analyzeSentiment(profileText),
                this.detectTopics(profileText)
            ]);

            // Analyze developer characteristics
            const developerLevel = this.assessDeveloperLevel(githubProfile);
            const workingPattern = this.analyzeWorkingPattern(githubProfile);
            const empathyScore = this.calculateGitHubEmpathyScore(githubProfile, sentimentResult);
            
            // Generate empathy-driven prompt
            const empathyPrompt = this.generateEmpathyPrompt(
                githubProfile, 
                sentimentResult, 
                topics, 
                developerLevel,
                empathyScore
            );
            
            return {
                empathyPrompt,
                developerPersona: this.createDeveloperPersona(githubProfile, workingPattern),
                suggestedTone: this.suggestToneFromProfile(empathyScore, developerLevel),
                empathyScore
            };

        } catch (error) {
            console.error('Genesys GitHub analysis failed:', error);
            return this.fallbackGitHubAnalysis(githubProfile);
        }
    }

    private createBehaviorText(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): string {
        const recentActions = userActions.slice(-10).map(a => a.action).join('. ');
        const codeSnippet = codeContent.slice(0, 500); // First 500 chars
        
        return `User coding session: ${recentActions}. Code context: ${codeSnippet}. Session stats: ${sessionData.errorCount} errors, ${sessionData.completions} completions in ${Math.round(sessionData.duration / 60)} minutes.`;
    }

    private analyzePatterns(
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis['patterns'] {
        const typingEvents = userActions.filter(a => a.action.includes('typing') || a.action.includes('edit'));
        const avgTypingInterval = typingEvents.length > 1 
            ? (typingEvents[typingEvents.length - 1].timestamp.getTime() - typingEvents[0].timestamp.getTime()) / typingEvents.length
            : 1000;

        return {
            typingSpeed: avgTypingInterval < 500 ? 'fast' : avgTypingInterval > 2000 ? 'slow' : 'normal',
            errorFrequency: sessionData.errorCount > 10 ? 'high' : sessionData.errorCount > 3 ? 'medium' : 'low',
            sessionDuration: sessionData.duration,
            codeComplexity: this.assessCodeComplexity(userActions)
        };
    }

    private assessCodeComplexity(userActions: Array<{ action: string; timestamp: Date; context?: any }>): 'beginner' | 'intermediate' | 'advanced' {
        const complexPatterns = userActions.filter(a => 
            a.action.includes('async') || 
            a.action.includes('class') || 
            a.action.includes('interface') ||
            a.action.includes('generic')
        ).length;

        return complexPatterns > 5 ? 'advanced' : complexPatterns > 2 ? 'intermediate' : 'beginner';
    }

    private determineEmotionalState(
        sentiment: { sentiment: number; confidence: number },
        patterns: UserBehaviorAnalysis['patterns']
    ): UserBehaviorAnalysis['emotionalState'] {
        if (sentiment.sentiment < -0.5 && patterns.errorFrequency === 'high') return 'stressed';
        if (sentiment.sentiment > 0.5 && patterns.typingSpeed === 'fast') return 'excited';
        if (patterns.errorFrequency === 'high' && patterns.typingSpeed === 'slow') return 'overwhelmed';
        if (sentiment.sentiment > 0.3) return 'focused';
        return 'calm';
    }

    private calculateEmpathyScore(
        sentiment: { sentiment: number; confidence: number },
        patterns: UserBehaviorAnalysis['patterns'],
        sessionData: { duration: number; errorCount: number; completions: number }
    ): number {
        let score = 50; // Base empathy score

        // Increase empathy for negative sentiment
        if (sentiment.sentiment < -0.3) score += 30;
        else if (sentiment.sentiment < 0) score += 15;

        // Increase empathy for high error frequency
        if (patterns.errorFrequency === 'high') score += 25;
        else if (patterns.errorFrequency === 'medium') score += 10;

        // Increase empathy for long struggling sessions
        if (sessionData.duration > 3600 && sessionData.completions < 3) score += 20;

        // Decrease empathy for positive, productive sessions
        if (sentiment.sentiment > 0.3 && patterns.errorFrequency === 'low') score -= 20;

        return Math.max(0, Math.min(100, score));
    }

    private suggestApproach(
        sentiment: { sentiment: number; confidence: number },
        emotionalState: UserBehaviorAnalysis['emotionalState'],
        empathyScore: number
    ): UserBehaviorAnalysis['suggestedApproach'] {
        if (empathyScore > 70 || emotionalState === 'stressed' || emotionalState === 'overwhelmed') {
            return 'patient';
        }
        if (sentiment.sentiment > 0.3 && emotionalState === 'focused') {
            return 'direct';
        }
        if (empathyScore > 40 || sentiment.sentiment < 0) {
            return 'encouraging';
        }
        return 'detailed';
    }

    private mapSentimentToCategory(sentiment: number): UserBehaviorAnalysis['sentiment'] {
        if (sentiment < -0.5) return 'frustrated';
        if (sentiment < -0.2) return 'negative';
        if (sentiment > 0.3) return 'positive';
        if (sentiment < -0.1) return 'confused';
        return 'neutral';
    }

    private determineEngagementLevel(
        patterns: UserBehaviorAnalysis['patterns'],
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis['engagementLevel'] {
        const actionsPerMinute = sessionData.completions / (sessionData.duration / 60);
        
        if (actionsPerMinute > 5 && patterns.typingSpeed !== 'slow') return 'high';
        if (actionsPerMinute > 2 || patterns.typingSpeed === 'fast') return 'medium';
        return 'low';
    }

    // Fallback methods for when Genesys API is unavailable
    private fallbackSentimentAnalysis(text: string): { sentiment: number; confidence: number } {
        const negativeWords = ['error', 'bug', 'fail', 'wrong', 'issue', 'problem', 'stuck'];
        const positiveWords = ['work', 'good', 'success', 'complete', 'fix', 'solve'];
        
        const words = text.toLowerCase().split(/\s+/);
        const negCount = words.filter(w => negativeWords.some(neg => w.includes(neg))).length;
        const posCount = words.filter(w => positiveWords.some(pos => w.includes(pos))).length;
        
        const sentiment = (posCount - negCount) / Math.max(words.length / 10, 1);
        return { sentiment: Math.max(-1, Math.min(1, sentiment)), confidence: 0.6 };
    }

    private fallbackTopicDetection(text: string): Array<{ topic: string; confidence: number }> {
        const topics = [
            { keywords: ['function', 'method', 'call'], topic: 'functions' },
            { keywords: ['variable', 'const', 'let', 'var'], topic: 'variables' },
            { keywords: ['class', 'object', 'instance'], topic: 'object-oriented' },
            { keywords: ['async', 'await', 'promise'], topic: 'asynchronous' },
            { keywords: ['error', 'exception', 'try', 'catch'], topic: 'error-handling' },
            { keywords: ['test', 'spec', 'assert'], topic: 'testing' }
        ];

        const lowerText = text.toLowerCase();
        return topics
            .map(({ keywords, topic }) => ({
                topic,
                confidence: keywords.filter(k => lowerText.includes(k)).length / keywords.length
            }))
            .filter(t => t.confidence > 0)
            .sort((a, b) => b.confidence - a.confidence)
            .slice(0, 3);
    }

    private fallbackBehaviorAnalysis(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): UserBehaviorAnalysis {
        const behaviorText = this.createBehaviorText(codeContent, userActions, sessionData);
        const sentiment = this.fallbackSentimentAnalysis(behaviorText);
        const patterns = this.analyzePatterns(userActions, sessionData);
        
        return {
            sentiment: this.mapSentimentToCategory(sentiment.sentiment),
            emotionalState: this.determineEmotionalState(sentiment, patterns),
            engagementLevel: this.determineEngagementLevel(patterns, sessionData),
            topics: this.fallbackTopicDetection(behaviorText).map(t => t.topic),
            patterns,
            empathyScore: this.calculateEmpathyScore(sentiment, patterns, sessionData),
            suggestedApproach: this.suggestApproach(
                sentiment, 
                this.determineEmotionalState(sentiment, patterns),
                this.calculateEmpathyScore(sentiment, patterns, sessionData)
            )
        };
    }

    // GitHub Profile Analysis Methods
    private createGitHubAnalysisText(githubProfile: {
        user: any;
        repositories: any[];
        commits: any[];
        languages: Record<string, number>;
        experience: string;
        workingStyle: string;
        expertise: string[];
    }): string {
        const topLanguages = Object.entries(githubProfile.languages)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([lang]) => lang)
            .join(', ');

        const recentCommits = githubProfile.commits.slice(0, 10)
            .map(c => c.commit?.message || 'commit')
            .join('. ');

        return `Developer profile: ${githubProfile.experience} level with ${githubProfile.workingStyle} working style. 
                Primary languages: ${topLanguages}. 
                Expertise areas: ${githubProfile.expertise.join(', ')}. 
                Recent activity: ${recentCommits}. 
                Repository count: ${githubProfile.repositories.length}.`;
    }

    private assessDeveloperLevel(githubProfile: {
        repositories: any[];
        commits: any[];
        experience: string;
    }): 'junior' | 'mid' | 'senior' | 'expert' {
        const repoCount = githubProfile.repositories.length;
        const commitCount = githubProfile.commits.length;
        
        if (githubProfile.experience.toLowerCase().includes('expert') || 
            (repoCount > 20 && commitCount > 500)) return 'expert';
        if (githubProfile.experience.toLowerCase().includes('senior') || 
            (repoCount > 10 && commitCount > 200)) return 'senior';
        if (repoCount > 5 && commitCount > 50) return 'mid';
        return 'junior';
    }

    private analyzeWorkingPattern(githubProfile: {
        commits: any[];
        workingStyle: string;
    }): 'consistent' | 'burst' | 'sporadic' | 'methodical' {
        if (githubProfile.workingStyle.toLowerCase().includes('methodical')) return 'methodical';
        if (githubProfile.workingStyle.toLowerCase().includes('consistent')) return 'consistent';
        
        // Analyze commit patterns
        const commitDates = githubProfile.commits.map(c => new Date(c.commit?.author?.date || Date.now()));
        const daysBetweenCommits = commitDates.slice(1).map((date, i) => 
            Math.abs(date.getTime() - commitDates[i].getTime()) / (1000 * 60 * 60 * 24)
        );
        
        const avgDaysBetween = daysBetweenCommits.reduce((a, b) => a + b, 0) / daysBetweenCommits.length;
        
        if (avgDaysBetween < 2) return 'burst';
        if (avgDaysBetween > 7) return 'sporadic';
        return 'consistent';
    }

    private calculateGitHubEmpathyScore(
        githubProfile: {
            repositories: any[];
            commits: any[];
            experience: string;
        },
        sentiment: { sentiment: number; confidence: number }
    ): number {
        let score = 50; // Base empathy score

        // Adjust based on developer level (newer developers need more empathy)
        const level = this.assessDeveloperLevel(githubProfile);
        if (level === 'junior') score += 30;
        else if (level === 'mid') score += 15;
        else if (level === 'expert') score -= 10;

        // Adjust based on repository activity
        if (githubProfile.repositories.length < 3) score += 20;
        if (githubProfile.commits.length < 20) score += 15;

        // Adjust based on sentiment from profile analysis
        if (sentiment.sentiment < -0.2) score += 25;
        else if (sentiment.sentiment > 0.3) score -= 15;

        return Math.max(0, Math.min(100, score));
    }

    private generateEmpathyPrompt(
        githubProfile: any,
        sentiment: { sentiment: number; confidence: number },
        topics: Array<{ topic: string; confidence: number }>,
        developerLevel: 'junior' | 'mid' | 'senior' | 'expert',
        empathyScore: number
    ): string {
        const topTopics = topics.slice(0, 3).map(t => t.topic).join(', ');
        const languages = Object.keys(githubProfile.languages).slice(0, 3).join(', ');

        let basePrompt = `You are mentoring a ${developerLevel}-level developer who primarily works with ${languages}.`;
        
        if (empathyScore > 70) {
            basePrompt += ` This developer may be new to some concepts, so be extra patient and supportive. 
                           Break down complex ideas into digestible steps. Use encouraging language and acknowledge their efforts.
                           Focus areas: ${topTopics}. Remember they're learning and growing.`;
        } else if (empathyScore > 40) {
            basePrompt += ` This developer has some experience but may benefit from gentle guidance. 
                           Provide clear explanations with examples. Be encouraging while being informative.
                           Focus areas: ${topTopics}. Balance support with technical depth.`;
        } else {
            basePrompt += ` This developer appears experienced and confident. You can be more direct and technical.
                           Focus on advanced concepts and best practices. Focus areas: ${topTopics}.
                           Provide concise, expert-level guidance.`;
        }

        if (sentiment.sentiment < -0.2) {
            basePrompt += ` Note: Recent activity suggests some frustration or challenges. Be extra supportive and patient.`;
        }

        return basePrompt;
    }

    private createDeveloperPersona(
        githubProfile: any,
        workingPattern: 'consistent' | 'burst' | 'sporadic' | 'methodical'
    ): string {
        const level = this.assessDeveloperLevel(githubProfile);
        const topLang = Object.keys(githubProfile.languages)[0] || 'JavaScript';
        
        return `${level.charAt(0).toUpperCase() + level.slice(1)} ${topLang} developer with ${workingPattern} working patterns. 
                Expertise in ${githubProfile.expertise.slice(0, 2).join(' and ')}.`;
    }

    private suggestToneFromProfile(
        empathyScore: number,
        developerLevel: 'junior' | 'mid' | 'senior' | 'expert'
    ): 'supportive' | 'direct' | 'encouraging' | 'patient' {
        if (empathyScore > 70 || developerLevel === 'junior') return 'patient';
        if (empathyScore > 50) return 'supportive';
        if (developerLevel === 'expert') return 'direct';
        return 'encouraging';
    }

    private fallbackGitHubAnalysis(githubProfile: any): {
        empathyPrompt: string;
        developerPersona: string;
        suggestedTone: 'supportive' | 'direct' | 'encouraging' | 'patient';
        empathyScore: number;
    } {
        const level = this.assessDeveloperLevel(githubProfile);
        const empathyScore = level === 'junior' ? 75 : level === 'mid' ? 50 : 25;
        
        return {
            empathyPrompt: `You are mentoring a ${level}-level developer. Adjust your approach based on their experience level.`,
            developerPersona: `${level} developer`,
            suggestedTone: this.suggestToneFromProfile(empathyScore, level),
            empathyScore
        };
    }

    // Keep the original method for backward compatibility
    public async analyzeUserBehavior(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): Promise<UserBehaviorAnalysis> {
        try {
            const behaviorText = this.createBehaviorText(codeContent, userActions, sessionData);
            const [sentimentResult, topics] = await Promise.all([
                this.analyzeSentiment(behaviorText),
                this.detectTopics(behaviorText)
            ]);

            const patterns = this.analyzePatterns(userActions, sessionData);
            const emotionalState = this.determineEmotionalState(sentimentResult, patterns);
            const empathyScore = this.calculateEmpathyScore(sentimentResult, patterns, sessionData);
            
            return {
                sentiment: this.mapSentimentToCategory(sentimentResult.sentiment),
                emotionalState,
                engagementLevel: this.determineEngagementLevel(patterns, sessionData),
                topics: topics.map(t => t.topic),
                patterns,
                empathyScore,
                suggestedApproach: this.suggestApproach(sentimentResult, emotionalState, empathyScore)
            };

        } catch (error) {
            console.error('Genesys behavior analysis failed:', error);
            return this.fallbackBehaviorAnalysis(codeContent, userActions, sessionData);
        }
    }
}
