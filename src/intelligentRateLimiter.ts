import * as vscode from 'vscode';

export interface TriggerCondition {
    priority: 'immediate' | 'high' | 'medium' | 'low';
    triggers: string[];
    cooldown: number; // milliseconds
    aiCallRequired: boolean;
    description: string;
}

export interface CodeChange {
    content: string;
    previousContent: string;
    fileName: string;
    language: string;
    changeType: 'addition' | 'deletion' | 'modification';
    linesChanged: number;
    signature: string; // Hash for caching
}

export interface AnalysisRequest {
    change: CodeChange;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    timestamp: number;
    mentorId?: string;
}

export interface CachedAnalysis {
    result: any;
    timestamp: number;
    mentorId: string;
    expiresAt: number;
}

export class TokenBucket {
    private tokens: number;
    private lastRefill: number;
    private readonly capacity: number;
    private readonly refillRate: number; // tokens per second

    constructor(capacity: number = 10, refillRate: number = 2) {
        this.capacity = capacity;
        this.refillRate = refillRate;
        this.tokens = capacity;
        this.lastRefill = Date.now();
    }

    hasTokens(priority: string): boolean {
        this.refill();
        
        const tokensRequired = this.getTokensRequired(priority);
        if (this.tokens >= tokensRequired) {
            this.tokens -= tokensRequired;
            return true;
        }
        return false;
    }

    private refill(): void {
        const now = Date.now();
        const timePassed = (now - this.lastRefill) / 1000;
        const tokensToAdd = timePassed * this.refillRate;
        
        this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
        this.lastRefill = now;
    }

    private getTokensRequired(priority: string): number {
        switch (priority) {
            case 'immediate': return 1;
            case 'high': return 2;
            case 'medium': return 3;
            case 'low': return 4;
            default: return 3;
        }
    }

    getStatus(): { tokens: number; capacity: number } {
        this.refill();
        return { tokens: Math.floor(this.tokens), capacity: this.capacity };
    }
}

export class PriorityQueue<T extends AnalysisRequest> {
    private items: T[] = [];

    enqueue(item: T): void {
        const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
        const priority = priorityOrder[item.priority];
        
        let inserted = false;
        for (let i = 0; i < this.items.length; i++) {
            if (priorityOrder[this.items[i].priority] > priority) {
                this.items.splice(i, 0, item);
                inserted = true;
                break;
            }
        }
        
        if (!inserted) {
            this.items.push(item);
        }
    }

    dequeue(): T | undefined {
        return this.items.shift();
    }

    size(): number {
        return this.items.length;
    }

    clear(): void {
        this.items = [];
    }
}

export class IntelligentRateLimiter {
    private tokenBucket: TokenBucket;
    private analysisQueue: PriorityQueue<AnalysisRequest>;
    private patternCache: Map<string, CachedAnalysis>;
    private cooldownTimers: Map<string, number>;
    private triggerRules: Map<string, TriggerCondition>;
    private userActivityPattern: Map<string, number>;

    constructor() {
        this.tokenBucket = new TokenBucket(15, 3); // 15 tokens, refill 3/second
        this.analysisQueue = new PriorityQueue<AnalysisRequest>();
        this.patternCache = new Map();
        this.cooldownTimers = new Map();
        this.userActivityPattern = new Map();
        this.initializeTriggerRules();
        
        // Start queue processor
        this.startQueueProcessor();
        
        // Clean up cache every 5 minutes
        setInterval(() => this.cleanupCache(), 5 * 60 * 1000);
    }

    private initializeTriggerRules(): void {
        this.triggerRules = new Map([
            ['syntax_error', {
                priority: 'immediate',
                triggers: ['SyntaxError', 'ParseError', 'unexpected token'],
                cooldown: 0,
                aiCallRequired: true,
                description: 'Critical syntax errors that prevent code execution'
            }],
            ['null_reference', {
                priority: 'immediate',
                triggers: ['null', 'undefined', 'Cannot read property'],
                cooldown: 0,
                aiCallRequired: true,
                description: 'Potential null/undefined access patterns'
            }],
            ['security_vulnerability', {
                priority: 'high',
                triggers: ['eval(', 'innerHTML =', 'document.write', 'setTimeout(string'],
                cooldown: 5000,
                aiCallRequired: true,
                description: 'Security vulnerabilities and dangerous patterns'
            }],
            ['performance_issue', {
                priority: 'high',
                triggers: ['nested loops', 'O(n²)', 'synchronous file', 'blocking operation'],
                cooldown: 10000,
                aiCallRequired: true,
                description: 'Performance bottlenecks and inefficient algorithms'
            }],
            ['memory_leak', {
                priority: 'high',
                triggers: ['addEventListener without remove', 'setInterval without clear', 'closure retention'],
                cooldown: 15000,
                aiCallRequired: true,
                description: 'Potential memory leaks and resource management issues'
            }],
            ['code_smell', {
                priority: 'medium',
                triggers: ['long function', 'deep nesting', 'duplicate code', 'magic number'],
                cooldown: 20000,
                aiCallRequired: false,
                description: 'Code quality issues and maintainability concerns'
            }],
            ['best_practice_violation', {
                priority: 'medium',
                triggers: ['var usage', '== instead of ===', 'missing error handling'],
                cooldown: 25000,
                aiCallRequired: false,
                description: 'Violations of coding best practices'
            }],
            ['refactor_opportunity', {
                priority: 'medium',
                triggers: ['extract method', 'extract variable', 'simplify condition'],
                cooldown: 30000,
                aiCallRequired: false,
                description: 'Opportunities for code refactoring and improvement'
            }],
            ['style_suggestion', {
                priority: 'low',
                triggers: ['indentation', 'naming convention', 'formatting'],
                cooldown: 45000,
                aiCallRequired: false,
                description: 'Code style and formatting suggestions'
            }],
            ['naming_convention', {
                priority: 'low',
                triggers: ['variable naming', 'function naming', 'camelCase', 'snake_case'],
                cooldown: 60000,
                aiCallRequired: false,
                description: 'Naming convention recommendations'
            }]
        ]);
    }

    async shouldTriggerAI(change: CodeChange, mentorId?: string): Promise<{
        shouldTrigger: boolean;
        priority: 'immediate' | 'high' | 'medium' | 'low';
        reason: string;
        useCache: boolean;
    }> {
        const priority = this.calculatePriority(change);
        const cacheKey = this.generateCacheKey(change, mentorId);
        const isCached = this.patternCache.has(cacheKey);
        const isInCooldown = this.isInCooldown(priority);
        
        // Always allow immediate priority
        if (priority === 'immediate') {
            return {
                shouldTrigger: true,
                priority,
                reason: 'Critical issue detected',
                useCache: false
            };
        }
        
        // Check cache first
        if (isCached && !this.isCacheExpired(cacheKey)) {
            return {
                shouldTrigger: false,
                priority,
                reason: 'Using cached analysis',
                useCache: true
            };
        }
        
        // Check cooldown
        if (isInCooldown) {
            return {
                shouldTrigger: false,
                priority,
                reason: 'In cooldown period',
                useCache: false
            };
        }
        
        // Check token availability
        const hasTokens = this.tokenBucket.hasTokens(priority);
        if (!hasTokens) {
            return {
                shouldTrigger: false,
                priority,
                reason: 'Rate limit exceeded',
                useCache: false
            };
        }
        
        // Update cooldown
        this.setCooldown(priority);
        
        return {
            shouldTrigger: true,
            priority,
            reason: 'Analysis approved',
            useCache: false
        };
    }

    calculatePriority(change: CodeChange): 'immediate' | 'high' | 'medium' | 'low' {
        const content = change.content.toLowerCase();
        
        // Check each trigger rule
        for (const [ruleId, rule] of this.triggerRules) {
            for (const trigger of rule.triggers) {
                if (content.includes(trigger.toLowerCase())) {
                    console.log(`Triggered rule: ${ruleId} (${rule.description})`);
                    return rule.priority;
                }
            }
        }
        
        // Analyze change characteristics
        if (change.linesChanged > 50) return 'high';
        if (change.linesChanged > 20) return 'medium';
        if (change.changeType === 'deletion') return 'low';
        
        return 'medium';
    }

    enqueueAnalysis(request: AnalysisRequest): void {
        this.analysisQueue.enqueue(request);
        this.trackUserActivity(request.change.fileName);
    }

    getCachedAnalysis(change: CodeChange, mentorId?: string): CachedAnalysis | null {
        const cacheKey = this.generateCacheKey(change, mentorId);
        const cached = this.patternCache.get(cacheKey);
        
        if (cached && !this.isCacheExpired(cacheKey)) {
            return cached;
        }
        
        return null;
    }

    setCachedAnalysis(change: CodeChange, result: any, mentorId?: string): void {
        const cacheKey = this.generateCacheKey(change, mentorId);
        const expiresAt = Date.now() + (30 * 60 * 1000); // 30 minutes
        
        this.patternCache.set(cacheKey, {
            result,
            timestamp: Date.now(),
            mentorId: mentorId || 'default',
            expiresAt
        });
    }

    private generateCacheKey(change: CodeChange, mentorId?: string): string {
        const content = change.content.slice(0, 200); // First 200 chars
        const hash = this.simpleHash(content + (mentorId || ''));
        return `${change.language}_${hash}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private isInCooldown(priority: string): boolean {
        const cooldownKey = `priority_${priority}`;
        const lastTrigger = this.cooldownTimers.get(cooldownKey) || 0;
        const rule = Array.from(this.triggerRules.values()).find(r => r.priority === priority);
        const cooldownPeriod = rule?.cooldown || 10000;
        
        return Date.now() - lastTrigger < cooldownPeriod;
    }

    private setCooldown(priority: string): void {
        const cooldownKey = `priority_${priority}`;
        this.cooldownTimers.set(cooldownKey, Date.now());
    }

    private isCacheExpired(cacheKey: string): boolean {
        const cached = this.patternCache.get(cacheKey);
        return !cached || Date.now() > cached.expiresAt;
    }

    private cleanupCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.patternCache) {
            if (now > cached.expiresAt) {
                this.patternCache.delete(key);
            }
        }
        console.log(`Cache cleanup: ${this.patternCache.size} entries remaining`);
    }

    private trackUserActivity(fileName: string): void {
        const count = this.userActivityPattern.get(fileName) || 0;
        this.userActivityPattern.set(fileName, count + 1);
    }

    private async startQueueProcessor(): Promise<void> {
        setInterval(async () => {
            if (this.analysisQueue.size() > 0) {
                const request = this.analysisQueue.dequeue();
                if (request) {
                    // Process the queued request
                    console.log(`Processing queued analysis: ${request.priority} priority`);
                    // This would trigger the actual analysis
                }
            }
        }, 1000);
    }

    getStatus(): {
        tokens: { tokens: number; capacity: number };
        queueSize: number;
        cacheSize: number;
        activeRules: string[];
    } {
        return {
            tokens: this.tokenBucket.getStatus(),
            queueSize: this.analysisQueue.size(),
            cacheSize: this.patternCache.size,
            activeRules: Array.from(this.triggerRules.keys())
        };
    }

    // Adaptive learning - adjust cooldowns based on user response
    adjustCooldown(ruleId: string, wasHelpful: boolean): void {
        const rule = this.triggerRules.get(ruleId);
        if (rule) {
            if (wasHelpful) {
                rule.cooldown = Math.max(1000, rule.cooldown * 0.9); // Reduce cooldown
            } else {
                rule.cooldown = Math.min(120000, rule.cooldown * 1.2); // Increase cooldown
            }
            console.log(`Adjusted cooldown for ${ruleId}: ${rule.cooldown}ms`);
        }
    }
}
