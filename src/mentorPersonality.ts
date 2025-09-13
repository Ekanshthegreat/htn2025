import * as vscode from 'vscode';

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
    
    getProactiveComment(codePattern: string): string {
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
