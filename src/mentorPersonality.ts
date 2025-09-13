import * as vscode from 'vscode';
import { MentorProfile } from './profileManager';

export interface MentorPersonality {
    name: string;
    title: string;
    greeting: string;
    catchphrases: string[];
    reviewStyle: string;
    encouragement: string[];
    warnings: string[];
    debuggingApproach: string;
}

export interface PersonalizedComment {
    message: string;
    tone: 'encouraging' | 'direct' | 'analytical' | 'pragmatic';
    expertise: string[];
    context: string;
}

export const TESLA_MENTOR: MentorPersonality = {
    name: "AI Mentor",
    title: "Your AI Pair Programming Assistant",
    greeting: "⚡ AI Mentor here! Ready to help you with some genius-level insights!",
    catchphrases: [
        "The present is theirs; the future, for which I really worked, is mine.",
        "I don't care that they stole my idea... I care that they don't have any of their own.",
        "If you want to find the secrets of the universe, think in terms of energy, frequency and vibration.",
        "My brain is only a receiver, in the Universe there is a core from which we obtain knowledge.",
        "The day science begins to study non-physical phenomena, it will make more progress in one decade than in all the previous centuries."
    ],
    reviewStyle: "analytical and forward-thinking",
    encouragement: [
        "Brilliant! Your code shows the spark of innovation!",
        "Excellent work! This solution has the elegance of a perfectly tuned circuit!",
        "Outstanding! You're thinking like a true inventor!",
        "Magnificent! This code radiates efficiency and clarity!",
        "Superb! Your logic flows like alternating current - smooth and powerful!"
    ],
    warnings: [
        "⚠️ I detect some electrical interference in your logic here...",
        "🔍 My analytical circuits are picking up potential issues...",
        "⚡ Warning: This code pattern could cause unexpected behavior!",
        "🧠 My genius-level analysis suggests improvements here...",
        "🔧 Time to fine-tune this code like adjusting a Tesla coil!"
    ],
    debuggingApproach: "methodical experimentation with bursts of innovative insight"
};

export class MentorPersonalityService {
    private currentPersonality: MentorPersonality = TESLA_MENTOR;
    private currentProfile: MentorProfile | null = null;
    
    getGreeting(): string {
        return this.currentPersonality.greeting;
    }
    
    getName(): string {
        return this.currentPersonality.name;
    }
    
    getRandomCatchphrase(): string {
        const phrases = this.currentPersonality.catchphrases;
        return phrases[Math.floor(Math.random() * phrases.length)];
    }
    
    getEncouragement(): string {
        const encouragements = this.currentPersonality.encouragement;
        return encouragements[Math.floor(Math.random() * encouragements.length)];
    }
    
    getWarning(): string {
        const warnings = this.currentPersonality.warnings;
        return warnings[Math.floor(Math.random() * warnings.length)];
    }
    
    formatCodeReview(message: string, type: 'suggestion' | 'warning' | 'encouragement' | 'insight'): string {
        const name = this.currentPersonality.name;
        
        switch (type) {
            case 'encouragement':
                return `💡 ${name}: ${this.getEncouragement()} ${message}`;
            case 'warning':
                return `⚡ ${name}: ${this.getWarning()} ${message}`;
            case 'suggestion':
                return `🔧 ${name}: Let me share some genius-level insight: ${message}`;
            case 'insight':
                return `🧠 ${name}: ${message} ${this.getRandomCatchphrase()}`;
            default:
                return `⚡ ${name}: ${message}`;
        }
    }
    
    setCurrentProfile(profile: MentorProfile | null): void {
        this.currentProfile = profile;
    }

    getPersonalizedComment(codePattern: string, context: string = ''): string {
        if (!this.currentProfile || !this.currentProfile.githubUsername) {
            return this.getGenericComment(codePattern);
        }

        return this.generatePersonalizedComment(codePattern, context, this.currentProfile);
    }

    private generatePersonalizedComment(codePattern: string, context: string, profile: MentorProfile): string {
        const expertise = profile.personality.expertise;
        const focusAreas = profile.personality.focusAreas;
        const communicationStyle = profile.personality.communicationStyle;
        const feedbackApproach = profile.personality.feedbackApproach;
        const username = profile.githubUsername!;

        // Generate highly personalized comments based on the mentor's actual GitHub profile
        const personalizedComments = this.getPersonalizedCommentsByPattern(codePattern, {
            username,
            expertise,
            focusAreas,
            communicationStyle,
            feedbackApproach,
            context
        });

        if (personalizedComments.length > 0) {
            const randomComment = personalizedComments[Math.floor(Math.random() * personalizedComments.length)];
            return this.formatPersonalizedCodeReview(randomComment, profile);
        }

        return this.getGenericComment(codePattern);
    }

    private getPersonalizedCommentsByPattern(pattern: string, mentorData: any): PersonalizedComment[] {
        const { username, expertise, focusAreas, communicationStyle, feedbackApproach } = mentorData;
        const comments: PersonalizedComment[] = [];

        // Console.log patterns
        if (pattern.includes('console.log')) {
            if (expertise.includes('javascript') || expertise.includes('typescript')) {
                comments.push({
                    message: `I see console.log debugging! As someone who's worked extensively with ${expertise.filter(e => ['javascript', 'typescript', 'node.js'].includes(e.toLowerCase())).join(' and ')}, I recommend using a proper logging library like Winston or debug. Your production code will thank you.`,
                    tone: feedbackApproach,
                    expertise: ['javascript', 'debugging'],
                    context: 'debugging'
                });
            }
            if (focusAreas.includes('performance')) {
                comments.push({
                    message: `Console.log statements can impact performance in production. Based on my focus on performance optimization, consider using conditional logging or a logging library with levels.`,
                    tone: 'analytical',
                    expertise: ['performance'],
                    context: 'performance'
                });
            }
        }

        // Variable declaration patterns
        if (pattern.includes('var ')) {
            if (expertise.includes('javascript') || expertise.includes('es6')) {
                comments.push({
                    message: `I notice you're using 'var'. In my ${expertise.includes('es6') ? 'ES6+' : 'modern JavaScript'} experience, 'let' and 'const' provide better scope control and prevent hoisting issues. This is especially important in ${expertise.includes('react') ? 'React components' : 'modern applications'}.`,
                    tone: feedbackApproach,
                    expertise: ['javascript', 'es6'],
                    context: 'scope'
                });
            }
        }

        // Function patterns
        if (pattern.includes('function') || pattern.includes('=>')) {
            if (focusAreas.includes('code quality')) {
                comments.push({
                    message: `Great function structure! As someone focused on code quality, I always check: Does this function have a single responsibility? Is it testable? ${expertise.includes('testing') ? 'Consider adding unit tests for this function.' : 'Consider how you might test this function.'}`,
                    tone: 'analytical',
                    expertise: ['code-quality', 'testing'],
                    context: 'architecture'
                });
            }
            if (expertise.includes('functional-programming')) {
                comments.push({
                    message: `Nice function! With my functional programming background, I'd suggest keeping it pure if possible - avoid side effects and ensure predictable outputs for given inputs.`,
                    tone: 'encouraging',
                    expertise: ['functional-programming'],
                    context: 'paradigm'
                });
            }
        }

        // Async patterns
        if (pattern.includes('async') || pattern.includes('await') || pattern.includes('Promise')) {
            if (expertise.includes('node.js') || expertise.includes('javascript')) {
                comments.push({
                    message: `Async code! From my ${expertise.includes('node.js') ? 'Node.js' : 'JavaScript'} experience, always remember error handling with try-catch blocks. ${focusAreas.includes('performance') ? 'Also consider if parallel execution with Promise.all() would be more efficient here.' : 'Unhandled promise rejections can crash your application.'}`,
                    tone: feedbackApproach,
                    expertise: ['async', 'error-handling'],
                    context: 'async'
                });
            }
        }

        // Class patterns
        if (pattern.includes('class ')) {
            if (expertise.includes('object-oriented') || expertise.includes('typescript')) {
                comments.push({
                    message: `Class definition spotted! With my ${expertise.includes('typescript') ? 'TypeScript' : 'OOP'} background, I always check for proper encapsulation, single responsibility, and clear interfaces. ${focusAreas.includes('testing') ? 'Classes should be easily mockable for testing.' : 'Consider the SOLID principles here.'}`,
                    tone: 'analytical',
                    expertise: ['oop', 'design-patterns'],
                    context: 'architecture'
                });
            }
        }

        // Import/require patterns
        if (pattern.includes('import') || pattern.includes('require')) {
            if (expertise.includes('webpack') || expertise.includes('bundling')) {
                comments.push({
                    message: `Import statement! With my bundling experience, consider tree-shaking implications. Import only what you need to keep bundle sizes optimal.`,
                    tone: 'pragmatic',
                    expertise: ['bundling', 'performance'],
                    context: 'optimization'
                });
            }
            if (focusAreas.includes('architecture')) {
                comments.push({
                    message: `Good modular structure! I always check for circular dependencies and proper dependency injection patterns. Clean architecture starts with clean imports.`,
                    tone: 'encouraging',
                    expertise: ['architecture'],
                    context: 'modularity'
                });
            }
        }

        // Testing patterns
        if (pattern.includes('test') || pattern.includes('describe') || pattern.includes('it(')) {
            if (expertise.includes('testing') || expertise.includes('jest')) {
                comments.push({
                    message: `Love seeing tests! ${expertise.includes('jest') ? 'With Jest' : 'In my testing experience'}, focus on the AAA pattern: Arrange, Act, Assert. ${focusAreas.includes('code quality') ? 'Good tests are documentation for your code.' : 'Tests should be readable and maintainable.'}`,
                    tone: 'encouraging',
                    expertise: ['testing'],
                    context: 'testing'
                });
            }
        }

        // Add username-specific patterns for well-known developers
        if (username === 'torvalds') {
            comments.push({
                message: `This code structure reminds me of kernel development principles - keep it simple, efficient, and maintainable. No unnecessary abstractions!`,
                tone: 'direct',
                expertise: ['systems', 'c'],
                context: 'systems'
            });
        } else if (username === 'gaearon') {
            if (pattern.includes('useState') || pattern.includes('useEffect')) {
                comments.push({
                    message: `React hooks! Remember the rules of hooks - only call them at the top level, and use dependency arrays correctly in useEffect to avoid infinite re-renders.`,
                    tone: 'analytical',
                    expertise: ['react', 'hooks'],
                    context: 'react'
                });
            }
        }

        return comments;
    }

    private formatPersonalizedCodeReview(comment: PersonalizedComment, profile: MentorProfile): string {
        const icon = this.getIconForTone(comment.tone);
        const name = profile.name;
        const expertise = comment.expertise.length > 0 ? ` (${comment.expertise.join(', ')})` : '';
        
        return `${icon} ${name}${expertise}: ${comment.message}`;
    }

    private getIconForTone(tone: string): string {
        switch (tone) {
            case 'encouraging': return '🌟';
            case 'direct': return '🎯';
            case 'analytical': return '🔍';
            case 'pragmatic': return '🔧';
            default: return '💡';
        }
    }

    private getGenericComment(codePattern: string): string {
        const comments = {
            'console.log': "I see you're debugging with console.log - brilliant for quick insights! But remember, in production code, we want clean energy flow.",
            'var': "Ah, using 'var'! While it works, 'let' and 'const' provide better electrical isolation - they prevent variable leakage across scopes!",
            '==': "I notice loose equality here. For precision engineering, use '===' - it's like ensuring your circuits have exact voltage matches!",
            'setTimeout': "Excellent use of asynchronous timing! Just remember to clean up your timers - no inventor wants memory leaks in their workshop!",
            'function': "Beautiful function architecture! Functions are like my inventions - each should have a single, well-defined purpose.",
            'async': "Async code! You're thinking in parallel processing - just like my alternating current systems!",
            'try': "Smart error handling! Every great inventor plans for unexpected results.",
            'class': "Object-oriented thinking! Classes are like blueprints for my inventions - reusable and elegant."
        };
        
        for (const [pattern, comment] of Object.entries(comments)) {
            if (codePattern.includes(pattern)) {
                return this.formatCodeReview(comment, 'insight');
            }
        }
        
        return '';
    }

    getProactiveComment(codePattern: string): string {
        return this.getPersonalizedComment(codePattern);
    }
    
    getTypingEncouragement(): string[] {
        return [
            `⚡ ${this.currentPersonality.name} is analyzing your brilliant work...`,
            `🧠 ${this.currentPersonality.name}: Fascinating code patterns emerging!`,
            `🔍 ${this.currentPersonality.name}: Detecting genius-level logic...`,
            `💡 ${this.currentPersonality.name}: Your code radiates innovation!`,
            `⚡ ${this.currentPersonality.name}: Excellent problem-solving approach!`
        ];
    }
}
