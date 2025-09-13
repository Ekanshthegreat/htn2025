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

    public async analyzeUserBehavior(
        codeContent: string,
        userActions: Array<{ action: string; timestamp: Date; context?: any }>,
        sessionData: { duration: number; errorCount: number; completions: number }
    ): Promise<UserBehaviorAnalysis> {
        try {
            // Combine user actions into text for analysis
            const behaviorText = this.createBehaviorText(codeContent, userActions, sessionData);
            
            // Get sentiment and topics from Genesys
            const [sentimentResult, topics] = await Promise.all([
                this.analyzeSentiment(behaviorText),
                this.detectTopics(behaviorText)
            ]);

            // Analyze patterns
            const patterns = this.analyzePatterns(userActions, sessionData);
            
            // Determine emotional state and empathy needs
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
}
