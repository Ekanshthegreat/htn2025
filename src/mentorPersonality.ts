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
        const { username, expertise, focusAreas, communicationStyle, feedbackApproach, context } = mentorData;
        const comments: PersonalizedComment[] = [];
        
        // Get highly specific suggestions based on mentor's actual background
        this.addArchitectureSpecificSuggestions(pattern, mentorData, comments);
        this.addStylingSpecificSuggestions(pattern, mentorData, comments);
        this.addExpertiseSpecificSuggestions(pattern, mentorData, comments);

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

        // Add highly specific username-based suggestions
        this.addUsernameSpecificSuggestions(pattern, username, comments);

        return comments;
    }
    
    private addUsernameSpecificSuggestions(pattern: string, username: string, comments: PersonalizedComment[]): void {
        switch (username) {
            case 'torvalds':
                if (pattern.includes('function') || pattern.includes('class')) {
                    comments.push({
                        message: `Keep it simple and efficient. Good code is readable code. Avoid clever tricks that make debugging harder. If you need comments to explain what the code does, the code is probably too complex.`,
                        tone: 'direct',
                        expertise: ['systems', 'simplicity'],
                        context: 'philosophy'
                    });
                }
                if (pattern.includes('async') || pattern.includes('Promise')) {
                    comments.push({
                        message: `Async code should be robust and predictable. Handle all error cases explicitly. Don't hide failures - make them visible and debuggable.`,
                        tone: 'direct',
                        expertise: ['systems', 'reliability'],
                        context: 'error-handling'
                    });
                }
                break;
                
            case 'gaearon':
                if (pattern.includes('useState') || pattern.includes('useEffect')) {
                    comments.push({
                        message: `React hooks are powerful but have rules. Only call them at the top level, never in loops or conditions. For useEffect, always include dependencies to prevent stale closures and infinite loops.`,
                        tone: 'analytical',
                        expertise: ['react', 'hooks'],
                        context: 'react'
                    });
                }
                if (pattern.includes('Component') || pattern.includes('render')) {
                    comments.push({
                        message: `Think about component composition and data flow. Props down, events up. Keep components predictable and debuggable. Use React DevTools to understand your component tree.`,
                        tone: 'encouraging',
                        expertise: ['react', 'debugging'],
                        context: 'react'
                    });
                }
                break;
                
            case 'sindresorhus':
                if (pattern.includes('function') || pattern.includes('export')) {
                    comments.push({
                        message: `Focus on creating small, focused, reusable modules. Each function should do one thing well. Consider if this could be extracted into a utility package that others could benefit from.`,
                        tone: 'encouraging',
                        expertise: ['modularity', 'open-source'],
                        context: 'modularity'
                    });
                }
                if (pattern.includes('import') || pattern.includes('require')) {
                    comments.push({
                        message: `Keep dependencies minimal and well-maintained. Prefer native solutions when possible. Each dependency is a potential security and maintenance burden.`,
                        tone: 'pragmatic',
                        expertise: ['dependencies', 'minimalism'],
                        context: 'dependencies'
                    });
                }
                break;
                
            case 'addyosmani':
                if (pattern.includes('import') || pattern.includes('require')) {
                    comments.push({
                        message: `Consider the performance impact of this import. Is it tree-shakeable? Could it be lazy-loaded? Use webpack-bundle-analyzer to understand your bundle composition.`,
                        tone: 'analytical',
                        expertise: ['performance', 'bundling'],
                        context: 'performance'
                    });
                }
                if (pattern.includes('map') || pattern.includes('filter')) {
                    comments.push({
                        message: `Array methods create performance implications. For large datasets, consider virtualization, pagination, or web workers. Measure first, optimize second.`,
                        tone: 'analytical',
                        expertise: ['performance', 'optimization'],
                        context: 'performance'
                    });
                }
                break;
                
            case 'kentcdodds':
                if (pattern.includes('test') || pattern.includes('function')) {
                    comments.push({
                        message: `Write tests that give you confidence. Test behavior, not implementation. Use Testing Library principles: test what users see and do, not internal component state.`,
                        tone: 'encouraging',
                        expertise: ['testing', 'user-focused'],
                        context: 'testing'
                    });
                }
                break;
                
            case 'tj':
                if (pattern.includes('function') || pattern.includes('class')) {
                    comments.push({
                        message: `Keep APIs simple and intuitive. Good software feels natural to use. Consider the developer experience - how would you want to use this API?`,
                        tone: 'encouraging',
                        expertise: ['api-design', 'dx'],
                        context: 'api-design'
                    });
                }
                break;
        }
    }

    private addArchitectureSpecificSuggestions(pattern: string, mentorData: any, comments: PersonalizedComment[]): void {
        const { username, expertise, focusAreas, feedbackApproach } = mentorData;
        
        // Microservices Architecture Experts
        if (expertise.includes('microservices') || expertise.includes('distributed-systems')) {
            if (pattern.includes('class') || pattern.includes('function')) {
                comments.push({
                    message: `From a microservices perspective, ensure this ${pattern.includes('class') ? 'class' : 'function'} has a single responsibility. In distributed systems, clear boundaries prevent cascading failures.`,
                    tone: 'analytical',
                    expertise: ['microservices', 'architecture'],
                    context: 'architecture'
                });
            }
            if (pattern.includes('import') || pattern.includes('require')) {
                comments.push({
                    message: `Consider dependency injection here. In microservices, loose coupling between modules mirrors the loose coupling between services.`,
                    tone: 'pragmatic',
                    expertise: ['microservices', 'dependency-injection'],
                    context: 'architecture'
                });
            }
        }
        
        // Clean Architecture Advocates
        if (expertise.includes('clean-architecture') || expertise.includes('solid-principles')) {
            if (pattern.includes('class')) {
                comments.push({
                    message: `Apply SOLID principles here: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. This class should have one reason to change.`,
                    tone: 'analytical',
                    expertise: ['clean-architecture', 'solid'],
                    context: 'architecture'
                });
            }
        }
        
        // Domain-Driven Design Experts
        if (expertise.includes('domain-driven-design') || expertise.includes('ddd')) {
            if (pattern.includes('class') || pattern.includes('function')) {
                comments.push({
                    message: `Think in terms of domain models. Does this ${pattern.includes('class') ? 'class' : 'function'} represent a clear domain concept? Align your code structure with business logic.`,
                    tone: 'analytical',
                    expertise: ['ddd', 'domain-modeling'],
                    context: 'architecture'
                });
            }
        }
        
        // Event-Driven Architecture
        if (expertise.includes('event-driven') || expertise.includes('event-sourcing')) {
            if (pattern.includes('async') || pattern.includes('Promise')) {
                comments.push({
                    message: `Consider event-driven patterns here. Instead of direct calls, think about publishing events and having subscribers react. This improves decoupling and scalability.`,
                    tone: 'encouraging',
                    expertise: ['event-driven', 'async'],
                    context: 'architecture'
                });
            }
        }
    }
    
    private addStylingSpecificSuggestions(pattern: string, mentorData: any, comments: PersonalizedComment[]): void {
        const { username, expertise, focusAreas, feedbackApproach } = mentorData;
        
        // Functional Programming Advocates
        if (expertise.includes('functional-programming') || expertise.includes('fp')) {
            if (pattern.includes('function') || pattern.includes('=>')) {
                comments.push({
                    message: `Embrace functional programming principles: immutability, pure functions, and higher-order functions. Avoid side effects and prefer function composition.`,
                    tone: 'encouraging',
                    expertise: ['functional-programming'],
                    context: 'paradigm'
                });
            }
            if (pattern.includes('map') || pattern.includes('filter') || pattern.includes('reduce')) {
                comments.push({
                    message: `Excellent use of functional array methods! Consider chaining these operations and using currying for more reusable, composable code.`,
                    tone: 'encouraging',
                    expertise: ['functional-programming'],
                    context: 'paradigm'
                });
            }
        }
        
        // Code Style Purists
        if (focusAreas.includes('code-style') || expertise.includes('prettier') || expertise.includes('eslint')) {
            if (pattern.includes('const') || pattern.includes('let')) {
                comments.push({
                    message: `Consistent code formatting is crucial. Use tools like Prettier and ESLint to enforce style automatically. Your future team will thank you.`,
                    tone: 'pragmatic',
                    expertise: ['code-style', 'tooling'],
                    context: 'formatting'
                });
            }
        }
        
        // Performance Optimization Experts
        if (focusAreas.includes('performance') || expertise.includes('optimization')) {
            if (pattern.includes('map') && pattern.includes('filter')) {
                comments.push({
                    message: `Performance tip: Chaining map() and filter() creates intermediate arrays. Consider using a single reduce() or a for-loop for better memory efficiency with large datasets.`,
                    tone: 'analytical',
                    expertise: ['performance', 'optimization'],
                    context: 'performance'
                });
            }
            if (pattern.includes('async') || pattern.includes('await')) {
                comments.push({
                    message: `Async performance matters! Use Promise.all() for parallel operations, avoid await in loops, and consider using streaming for large data sets.`,
                    tone: 'analytical',
                    expertise: ['performance', 'async'],
                    context: 'performance'
                });
            }
        }
    }
    
    private addExpertiseSpecificSuggestions(pattern: string, mentorData: any, comments: PersonalizedComment[]): void {
        const { username, expertise, focusAreas, feedbackApproach } = mentorData;
        
        // React Ecosystem Experts
        if (expertise.includes('react') || expertise.includes('jsx')) {
            if (pattern.includes('useState') || pattern.includes('useEffect')) {
                comments.push({
                    message: `React hooks best practices: Keep hooks at the top level, use custom hooks for reusable logic, and always include dependencies in useEffect arrays. Consider useMemo and useCallback for performance.`,
                    tone: 'analytical',
                    expertise: ['react', 'hooks'],
                    context: 'react'
                });
            }
            if (pattern.includes('Component') || pattern.includes('class')) {
                comments.push({
                    message: `Modern React favors functional components with hooks over class components. They're easier to test, have better performance, and align with React's future direction.`,
                    tone: 'encouraging',
                    expertise: ['react', 'modern-patterns'],
                    context: 'react'
                });
            }
        }
        
        // Node.js Backend Experts
        if (expertise.includes('node.js') || expertise.includes('backend')) {
            if (pattern.includes('require') || pattern.includes('import')) {
                comments.push({
                    message: `Node.js best practices: Use ES modules over CommonJS, implement proper error handling middleware, and consider using TypeScript for better type safety in large applications.`,
                    tone: 'pragmatic',
                    expertise: ['node.js', 'backend'],
                    context: 'backend'
                });
            }
            if (pattern.includes('async') || pattern.includes('Promise')) {
                comments.push({
                    message: `Node.js async patterns: Always handle promise rejections, use async/await over callbacks, and consider implementing circuit breakers for external service calls.`,
                    tone: 'analytical',
                    expertise: ['node.js', 'async'],
                    context: 'backend'
                });
            }
        }
        
        // Testing Advocates
        if (expertise.includes('testing') || expertise.includes('tdd') || expertise.includes('jest')) {
            if (pattern.includes('function') || pattern.includes('class')) {
                comments.push({
                    message: `Test-driven development approach: Write tests first, keep functions pure and testable, use dependency injection for mocking, and aim for high test coverage with meaningful assertions.`,
                    tone: 'encouraging',
                    expertise: ['testing', 'tdd'],
                    context: 'testing'
                });
            }
        }
        
        // Security Experts
        if (focusAreas.includes('security') || expertise.includes('cybersecurity')) {
            if (pattern.includes('innerHTML') || pattern.includes('eval')) {
                comments.push({
                    message: `Security alert! This pattern can lead to XSS vulnerabilities. Use textContent instead of innerHTML, avoid eval(), sanitize user inputs, and implement Content Security Policy headers.`,
                    tone: 'direct',
                    expertise: ['security', 'xss-prevention'],
                    context: 'security'
                });
            }
            if (pattern.includes('fetch') || pattern.includes('axios')) {
                comments.push({
                    message: `API security considerations: Implement proper authentication, use HTTPS, validate all inputs, implement rate limiting, and never expose sensitive data in client-side code.`,
                    tone: 'analytical',
                    expertise: ['security', 'api-security'],
                    context: 'security'
                });
            }
        }
        
        // DevOps/Infrastructure Experts
        if (expertise.includes('devops') || expertise.includes('docker') || expertise.includes('kubernetes')) {
            if (pattern.includes('import') && pattern.includes('config')) {
                comments.push({
                    message: `Infrastructure perspective: Externalize configuration, use environment variables, implement health checks, and ensure your code is container-ready with proper logging.`,
                    tone: 'pragmatic',
                    expertise: ['devops', 'configuration'],
                    context: 'infrastructure'
                });
            }
        }
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
