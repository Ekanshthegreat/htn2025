import * as vscode from 'vscode';
import { ProfileManager, MentorProfile } from './profileManager';
import { ASTAnalyzer } from './astAnalyzer';
import { MentorPersonalityService } from './mentorPersonality';

interface CodeElementAnalysis {
    type: 'function' | 'class' | 'variable' | 'method' | 'unknown';
    name: string;
    characteristics: string[];
    issues: string[];
    suggestions: string[];
}

interface FileAnalysis {
    imports: string[];
    exports: string[];
    functions: string[];
    classes: string[];
    variables: string[];
    dependencies: string[];
    patterns: string[];
    complexity: 'low' | 'medium' | 'high';
    architecture: string[];
    codeSmells: string[];
}

export class MentorHoverProvider implements vscode.HoverProvider {
    private personalityService: MentorPersonalityService;

    constructor(
        private profileManager: ProfileManager,
        private astAnalyzer: ASTAnalyzer
    ) {
        this.personalityService = new MentorPersonalityService();
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | undefined> {
        const activeProfile = this.profileManager.getActiveProfile();
        const wordRange = document.getWordRangeAtPosition(position);
        const line = document.lineAt(position.line);
        const lineText = line.text;
        
        if (!wordRange) return undefined;

        const word = document.getText(wordRange);
        
        // Get comprehensive file analysis
        const fileAnalysis = this.analyzeFullFile(document);
        const localContext = this.getContextAroundPosition(document, position);
        
        // Analyze the code context for architecture and styling suggestions
        const suggestions = await this.generateSuggestions(
            word,
            lineText,
            localContext,
            document.languageId,
            activeProfile,
            fileAnalysis,
            position
        );

        if (suggestions.length === 0) return undefined;

        // Show hover tooltip with suggestions directly
        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        
        // Add mentor header
        markdown.appendMarkdown(`**💡 ${activeProfile.name}** suggests:\n\n`);
        
        // Add suggestions to hover tooltip
        suggestions.forEach((suggestion, index) => {
            const cleanSuggestion = suggestion.replace(/\*\*/g, '').replace(/🔍|⚡|🧪|🏗️|🐧|⚛️|📦|🚀|🎨|🔥|🌟|✨|📏|📝|🎯/g, '').trim();
            markdown.appendMarkdown(`${index + 1}. ${cleanSuggestion}\n\n`);
        });

        return new vscode.Hover(markdown, wordRange);
    }


    private getContextAroundPosition(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 3);
        const endLine = Math.min(document.lineCount - 1, position.line + 3);
        
        let context = '';
        for (let i = startLine; i <= endLine; i++) {
            const line = document.lineAt(i);
            context += line.text + '\n';
        }
        
        return context;
    }

    private async generateSuggestions(
        word: string,
        lineText: string,
        context: string,
        languageId: string,
        profile: MentorProfile,
        fileAnalysis: FileAnalysis,
        position: vscode.Position
    ): Promise<string[]> {
        const suggestions: string[] = [];
        
        // First, check for specific code issues that are contextually relevant
        const contextualIssues = this.analyzeContextualIssues(word, lineText, context, languageId);
        if (contextualIssues.length > 0) {
            suggestions.push(...contextualIssues.map(issue => `**🔍 ${profile.name}:** ${issue}`));
        }
        
        // Only add generic suggestions if we don't have specific contextual ones
        if (suggestions.length === 0) {
            // Analyze specific code elements
            const elementAnalysis = this.analyzeCodeElement(word, lineText, context, languageId);
            
            // Generate targeted suggestions based on the specific element
            const customSuggestions = this.getTargetedSuggestions(elementAnalysis, profile, word, lineText, context);
            suggestions.push(...customSuggestions);
        }
        
        return suggestions.filter(s => s.length > 0);
    }

    private analyzeContextualIssues(word: string, lineText: string, context: string, languageId: string): string[] {
        const issues: string[] = [];
        
        // Check for infinite loop patterns
        if (lineText.includes('while') && context.includes('while')) {
            const whileBlock = this.extractWhileBlock(context, lineText);
            if (whileBlock && !this.hasLoopIncrement(whileBlock)) {
                issues.push("Potential infinite loop detected - missing loop variable increment/decrement");
            }
        }
        
        // Check for array access patterns
        if (word === 'arr' && lineText.includes('[')) {
            if (context.includes('function') && !context.includes('if (!arr') && !context.includes('if (arr')) {
                issues.push("Consider adding null/undefined check for array parameter before accessing");
            }
        }
        
        // Check for array length access
        if (lineText.includes('.length') && word === 'arr') {
            if (!context.includes('if (!arr') && !context.includes('if (arr')) {
                issues.push("Array length access without null check - consider defensive programming");
            }
        }
        
        // Check for missing semicolons in TypeScript/JavaScript
        if ((languageId === 'typescript' || languageId === 'javascript') && 
            !lineText.trim().endsWith(';') && 
            (lineText.includes('return') || lineText.includes('let') || lineText.includes('const'))) {
            issues.push("Missing semicolon - add ';' for explicit statement termination");
        }
        
        return issues;
    }

    private extractWhileBlock(context: string, currentLine: string): string | null {
        const lines = context.split('\n');
        const currentLineIndex = lines.findIndex(line => line.includes(currentLine.trim()));
        if (currentLineIndex === -1) return null;
        
        let whileBlock = '';
        let braceCount = 0;
        let inWhile = false;
        
        for (let i = currentLineIndex; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('while')) {
                inWhile = true;
            }
            if (inWhile) {
                whileBlock += line + '\n';
                braceCount += (line.match(/\{/g) || []).length;
                braceCount -= (line.match(/\}/g) || []).length;
                if (braceCount === 0 && line.includes('}')) {
                    break;
                }
            }
        }
        
        return whileBlock;
    }

    private hasLoopIncrement(whileBlock: string): boolean {
        return whileBlock.includes('++') || 
               whileBlock.includes('--') || 
               whileBlock.includes('+=') || 
               whileBlock.includes('-=') ||
               whileBlock.includes('i = i + 1') ||
               whileBlock.includes('i = i - 1');
    }

    private getTargetedSuggestions(analysis: CodeElementAnalysis, profile: MentorProfile, word: string, lineText: string, context: string): string[] {
        const suggestions: string[] = [];
        
        // Only provide suggestions that are directly relevant to the code being analyzed
        if (analysis.type === 'function' && lineText.includes('function')) {
            suggestions.push(`**🔧 ${profile.name}:** Function '${analysis.name}' - ensure it has a single responsibility and clear return behavior`);
        }
        
        if (analysis.type === 'variable' && word.length <= 3) {
            suggestions.push(`**📝 ${profile.name}:** Variable '${word}' could use a more descriptive name for better code readability`);
        }
        
        return suggestions;
    }

    private analyzeFullFile(document: vscode.TextDocument): FileAnalysis {
        const fullText = document.getText();
        const lines = fullText.split('\n');
        
        const analysis: FileAnalysis = {
            imports: [],
            exports: [],
            functions: [],
            classes: [],
            variables: [],
            dependencies: [],
            patterns: [],
            complexity: 'low',
            architecture: [],
            codeSmells: []
        };

        // Analyze imports and dependencies
        analysis.imports = this.extractImports(fullText);
        analysis.dependencies = this.extractDependencies(analysis.imports);
        
        // Analyze exports
        analysis.exports = this.extractExports(fullText);
        
        // Analyze code structure
        analysis.functions = this.extractFunctions(fullText);
        analysis.classes = this.extractClasses(fullText);
        analysis.variables = this.extractVariables(fullText);
        
        // Analyze patterns and architecture
        analysis.patterns = this.identifyPatterns(fullText);
        analysis.architecture = this.identifyArchitecturalPatterns(fullText, analysis);
        
        // Analyze complexity
        analysis.complexity = this.calculateComplexity(fullText, analysis);
        
        // Identify code smells
        analysis.codeSmells = this.identifyCodeSmells(fullText, analysis);
        
        return analysis;
    }

    private analyzeCodeElement(word: string, lineText: string, context: string, languageId: string): CodeElementAnalysis {
        const analysis: CodeElementAnalysis = {
            type: 'unknown',
            name: word,
            characteristics: [],
            issues: [],
            suggestions: []
        };

        // Analyze functions
        if (this.isFunctionDeclaration(lineText, context)) {
            analysis.type = 'function';
            analysis.name = this.extractFunctionName(lineText);
            analysis.characteristics = this.analyzeFunctionCharacteristics(lineText, context);
            analysis.issues = this.identifyFunctionIssues(lineText, context);
        }
        // Analyze classes
        else if (this.isClassDeclaration(lineText, context)) {
            analysis.type = 'class';
            analysis.name = this.extractClassName(lineText);
            analysis.characteristics = this.analyzeClassCharacteristics(lineText, context);
            analysis.issues = this.identifyClassIssues(lineText, context);
        }
        // Analyze variables
        else if (this.isVariableDeclaration(lineText)) {
            analysis.type = 'variable';
            analysis.name = this.extractVariableName(lineText);
            analysis.characteristics = this.analyzeVariableCharacteristics(lineText, context);
            analysis.issues = this.identifyVariableIssues(lineText, context);
        }
        // Analyze methods
        else if (this.isMethodDeclaration(lineText, context)) {
            analysis.type = 'method';
            analysis.name = this.extractMethodName(lineText);
            analysis.characteristics = this.analyzeMethodCharacteristics(lineText, context);
            analysis.issues = this.identifyMethodIssues(lineText, context);
        }

        return analysis;
    }

    private getCustomSuggestions(analysis: CodeElementAnalysis, profile: MentorProfile, fileAnalysis?: FileAnalysis): string[] {
        const suggestions: string[] = [];
        
        // Use GitHub profile-based suggestions when available
        if (profile.githubUsername) {
            const personalizedSuggestions = this.getGitHubProfileBasedSuggestions(analysis, profile, fileAnalysis);
            suggestions.push(...personalizedSuggestions);
        } else {
            // Fallback to generic suggestions
            const mentorId = profile.id;
            switch (analysis.type) {
                case 'function':
                    suggestions.push(...this.getFunctionSpecificAdvice(analysis, mentorId));
                    break;
                case 'class':
                    suggestions.push(...this.getClassSpecificAdvice(analysis, mentorId));
                    break;
                case 'variable':
                    suggestions.push(...this.getVariableSpecificAdvice(analysis, mentorId));
                    break;
                case 'method':
                    suggestions.push(...this.getMethodSpecificAdvice(analysis, mentorId));
                    break;
            }
        }

        return suggestions;
    }

    private getGitHubProfileBasedSuggestions(analysis: CodeElementAnalysis, profile: MentorProfile, fileAnalysis?: FileAnalysis): string[] {
        const suggestions: string[] = [];
        const expertise = profile.personality.expertise;
        const focusAreas = profile.personality.focusAreas;
        const username = profile.githubUsername!;
        const feedbackApproach = profile.personality.feedbackApproach;
        
        // Generate highly specific suggestions based on the mentor's actual expertise
        switch (analysis.type) {
            case 'function':
                if (expertise.includes('functional-programming')) {
                    suggestions.push(`**🔍 ${profile.name} (Functional Programming):** Consider making this function pure - avoid side effects and ensure it returns the same output for the same input. This makes testing and reasoning about your code much easier.`);
                }
                if (expertise.includes('performance') && analysis.characteristics.includes('long-function')) {
                    suggestions.push(`**⚡ ${profile.name} (Performance):** This function is quite long. From a performance perspective, consider breaking it into smaller functions - it improves both readability and allows for better optimization by the JavaScript engine.`);
                }
                if (expertise.includes('testing') && !analysis.characteristics.includes('has-return')) {
                    suggestions.push(`**🧪 ${profile.name} (Testing):** Functions without return values are harder to test. Consider returning a value or at least a success indicator to make this function more testable.`);
                }
                break;
                
            case 'class':
                if (expertise.includes('object-oriented') || expertise.includes('design-patterns')) {
                    suggestions.push(`**🏗️ ${profile.name} (OOP Design):** Great class structure! Make sure it follows the Single Responsibility Principle. ${focusAreas.includes('testing') ? 'Also consider dependency injection to make it more testable.' : 'Each class should have one reason to change.'}`);
                }
                if (expertise.includes('typescript') && analysis.characteristics.includes('inheritance')) {
                    suggestions.push(`**📝 ${profile.name} (TypeScript):** With inheritance, consider using interfaces for contracts and composition over inheritance when possible. TypeScript's type system really shines with well-defined interfaces.`);
                }
                break;
                
            case 'variable':
                if (expertise.includes('javascript') && analysis.issues.includes('use-var')) {
                    suggestions.push(`**🎯 ${profile.name} (Modern JS):** I see 'var' usage. In modern JavaScript, 'let' and 'const' provide block scoping which prevents many common bugs. ${expertise.includes('es6') ? 'ES6+ features like const/let are much safer.' : 'Consider the scope implications here.'}`);
                }
                if (expertise.includes('memory-management') && analysis.characteristics.includes('array')) {
                    suggestions.push(`**🧠 ${profile.name} (Memory):** Array detected! Consider the memory implications - are you creating unnecessary copies? Methods like map() create new arrays, while forEach() doesn't.`);
                }
                break;
        }
        
        // Add username-specific expertise
        if (username === 'torvalds') {
            suggestions.push(`**🐧 Linus Torvalds:** Keep it simple and efficient. Avoid over-engineering - good code is code that works reliably and can be understood by others. No unnecessary abstractions!`);
        } else if (username === 'gaearon') {
            if (fileAnalysis?.patterns.includes('react')) {
                suggestions.push(`**⚛️ Dan Abramov:** React patterns look good! Remember the principles: components should be predictable, debuggable, and have clear data flow. Avoid premature optimization.`);
            }
        } else if (username === 'sindresorhus') {
            if (expertise.includes('node.js')) {
                suggestions.push(`**📦 Sindre Sorhus:** Clean, focused modules are the way to go. Each function should do one thing well. Consider if this could be extracted into a reusable utility.`);
            }
        } else if (username === 'addyosmani') {
            if (focusAreas.includes('performance')) {
                suggestions.push(`**🚀 Addy Osmani:** Performance matters! Consider the bundle size impact, lazy loading opportunities, and whether this code is on the critical rendering path.`);
            }
        }
        
        return suggestions;
    }

    private getArchitectureSuggestions(
        word: string,
        lineText: string,
        context: string,
        languageId: string,
        profile: MentorProfile
    ): string[] {
        const suggestions: string[] = [];
        const personality = profile.personality;
        const communicationStyle = personality.communicationStyle;
        const expertise = personality.expertise;
        const focusAreas = personality.focusAreas;
        
        // Function architecture suggestions
        if (word === 'function' || lineText.includes('function') || lineText.includes('=>')) {
            const suggestion = this.generateArchitectureSuggestion(
                'function',
                profile,
                "Functions should follow the single responsibility principle",
                {
                    direct: "This function better have a single responsibility. Break it up if it's doing multiple things.",
                    supportive: "Let's make sure this function has one clear job - it'll be easier to test and maintain!",
                    detailed: "Consider the single responsibility principle here. Functions that do one thing well are easier to debug, test, and reuse.",
                    concise: "Single responsibility principle - one function, one job."
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        // Class architecture suggestions
        if (word === 'class' || lineText.includes('class ')) {
            const suggestion = this.generateArchitectureSuggestion(
                'class',
                profile,
                "Classes should be cohesive and loosely coupled",
                {
                    direct: "Classes should be cohesive and loosely coupled. Don't create dependencies you don't need.",
                    supportive: "Great class structure! Remember: high cohesion, low coupling works like a good team.",
                    detailed: "This class should follow object-oriented principles: high cohesion within the class, loose coupling with other classes.",
                    concise: "High cohesion, low coupling."
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        // Import/module architecture
        if (word === 'import' || word === 'require' || lineText.includes('import') || lineText.includes('require')) {
            const suggestion = this.generateArchitectureSuggestion(
                'imports',
                profile,
                "Keep imports organized and avoid circular dependencies",
                {
                    direct: "Keep imports organized and minimal. Circular dependencies will cause problems.",
                    supportive: "Nice modular approach! Just watch out for circular dependencies - they're tricky to debug.",
                    detailed: "Import organization is crucial for maintainability. Consider dependency injection patterns and avoid circular references.",
                    concise: "Organize imports, avoid circular deps."
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        // Async architecture
        if (word === 'async' || word === 'await' || lineText.includes('Promise')) {
            const suggestion = this.generateArchitectureSuggestion(
                'async',
                profile,
                "Async code needs proper error handling",
                {
                    direct: "Async code needs proper error handling. Unhandled rejections will crash your app.",
                    supportive: "Async operations are powerful! Don't forget error boundaries and proper promise chaining.",
                    detailed: "Asynchronous code requires careful error handling. Consider try-catch blocks, promise chains, and error boundaries.",
                    concise: "Handle async errors properly."
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        // Database/API architecture
        if (context.includes('fetch') || context.includes('axios') || context.includes('api') || context.includes('database')) {
            const suggestion = this.generateArchitectureSuggestion(
                'api',
                profile,
                "External calls need retry logic and error handling",
                {
                    direct: "API calls need retry logic, timeouts, and proper error handling. Networks aren't reliable.",
                    supportive: "External integrations! Consider the repository pattern - it's like having a translator for your app.",
                    detailed: "External API interactions should implement retry logic, timeout handling, and the repository pattern for clean separation.",
                    concise: "Add retry logic and timeouts."
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        return suggestions;
    }

    private generateArchitectureSuggestion(
        type: string,
        profile: MentorProfile,
        baseConcept: string,
        styleVariations: Record<string, string>
    ): string | null {
        const personality = profile.personality;
        const communicationStyle = personality.communicationStyle;
        const expertise = personality.expertise;
        
        // Get base message based on communication style
        const baseMessage = styleVariations[communicationStyle] || styleVariations.detailed;
        
        // Add expertise-specific insights
        let expertiseInsight = '';
        if (type === 'function' && expertise.includes('performance')) {
            expertiseInsight = ' Consider performance implications of function size and complexity.';
        } else if (type === 'class' && expertise.includes('design-patterns')) {
            expertiseInsight = ' Apply SOLID principles for better design.';
        } else if (type === 'async' && expertise.includes('node.js')) {
            expertiseInsight = ' In Node.js, unhandled promise rejections can crash the process.';
        } else if (type === 'api' && expertise.includes('microservices')) {
            expertiseInsight = ' Consider circuit breaker patterns for resilient service communication.';
        }
        
        return `**🏗️ ${profile.name} (Architecture):** ${baseMessage}${expertiseInsight}`;
    }

    private getCodeStylingSuggestions(
        word: string,
        lineText: string,
        context: string,
        languageId: string,
        profile: MentorProfile
    ): string[] {
        const suggestions: string[] = [];
        const stylePrefs = profile.codeStylePreferences;
        const personality = profile.personality;
        
        // Variable naming suggestions
        if (word.match(/^[a-z][a-zA-Z0-9]*$/) && lineText.includes('=')) {
            const suggestion = this.generateStyleSuggestion(
                'naming',
                profile,
                `Variable '${word}' naming`,
                {
                    direct: `Variable names should be descriptive, not cryptic. Make '${word}' more meaningful.`,
                    supportive: `'${word}' is a good start! Consider if the name clearly describes what it contains.`,
                    detailed: `Variable naming is crucial for maintainability. '${word}' should clearly indicate its purpose and content type.`,
                    concise: `Make '${word}' more descriptive.`
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        // Indentation style check
        const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || '';
        if (leadingWhitespace.length > 0) {
            const hasSpaces = leadingWhitespace.includes(' ');
            const hasTabs = leadingWhitespace.includes('\t');
            
            if ((stylePrefs.indentStyle === 'spaces' && hasTabs) || (stylePrefs.indentStyle === 'tabs' && hasSpaces)) {
                const suggestion = this.generateStyleSuggestion(
                    'indentation',
                    profile,
                    `Indentation consistency`,
                    {
                        direct: `Mixed tabs and spaces detected. Your profile requires ${stylePrefs.indentStyle} - stick with it.`,
                        supportive: `Indentation consistency helps! Your profile prefers ${stylePrefs.indentStyle} - let's keep it uniform.`,
                        detailed: `Consistent indentation improves readability. Your profile is configured for ${stylePrefs.indentStyle} - maintain this throughout.`,
                        concise: `Use ${stylePrefs.indentStyle} consistently.`
                    }
                );
                if (suggestion) suggestions.push(suggestion);
            }
        }

        // Quote style suggestions (JavaScript/TypeScript)
        if ((languageId === 'javascript' || languageId === 'typescript') && (lineText.includes('"') || lineText.includes("'"))) {
            const hasDoubleQuotes = lineText.includes('"');
            const hasSingleQuotes = lineText.includes("'");
            
            if ((stylePrefs.preferredQuotes === 'single' && hasDoubleQuotes) || 
                (stylePrefs.preferredQuotes === 'double' && hasSingleQuotes)) {
                const suggestion = this.generateStyleSuggestion(
                    'quotes',
                    profile,
                    `Quote style consistency`,
                    {
                        direct: `Your profile prefers ${stylePrefs.preferredQuotes} quotes. Be consistent.`,
                        supportive: `Quote consistency looks great! Your profile likes ${stylePrefs.preferredQuotes} quotes.`,
                        detailed: `Consistent quote usage improves code readability. Your profile is configured for ${stylePrefs.preferredQuotes} quotes.`,
                        concise: `Use ${stylePrefs.preferredQuotes} quotes.`
                    }
                );
                if (suggestion) suggestions.push(suggestion);
            }
        }

        // Semicolon suggestions (JavaScript/TypeScript)
        if ((languageId === 'javascript' || languageId === 'typescript')) {
            const hasSemicolon = lineText.trim().endsWith(';');
            const shouldHaveSemicolon = stylePrefs.semicolons && 
                (lineText.includes('=') || lineText.includes('return') || lineText.includes('const') || lineText.includes('let'));
            
            if (shouldHaveSemicolon && !hasSemicolon) {
                const suggestion = this.generateStyleSuggestion(
                    'semicolons',
                    profile,
                    `Semicolon requirement`,
                    {
                        direct: `Missing semicolon. Your profile requires them - don't rely on ASI.`,
                        supportive: `Your profile expects semicolons - they help make statements clear and explicit!`,
                        detailed: `Your profile is configured to require semicolons. This improves code clarity and prevents ASI-related issues.`,
                        concise: `Add semicolon.`
                    }
                );
                if (suggestion) suggestions.push(suggestion);
            }
        }

        // Line length suggestions
        if (lineText.length > stylePrefs.maxLineLength) {
            const suggestion = this.generateStyleSuggestion(
                'line-length',
                profile,
                `Line length limit`,
                {
                    direct: `Line too long: ${lineText.length}/${stylePrefs.maxLineLength} chars. Break it up.`,
                    supportive: `This line is getting long (${lineText.length} chars). Your ${stylePrefs.maxLineLength} limit helps readability!`,
                    detailed: `Line length of ${lineText.length} characters exceeds your configured limit of ${stylePrefs.maxLineLength}. Consider breaking into multiple lines.`,
                    concise: `Break long line (${lineText.length}/${stylePrefs.maxLineLength}).`
                }
            );
            if (suggestion) suggestions.push(suggestion);
        }

        return suggestions;
    }

    private generateStyleSuggestion(
        type: string,
        profile: MentorProfile,
        category: string,
        styleVariations: Record<string, string>
    ): string | null {
        const personality = profile.personality;
        const communicationStyle = personality.communicationStyle;
        
        // Get base message based on communication style
        const baseMessage = styleVariations[communicationStyle] || styleVariations.detailed;
        
        // Add expertise-specific context
        let expertiseContext = '';
        if (type === 'naming' && personality.expertise.includes('clean-code')) {
            expertiseContext = ' Clean code principles emphasize self-documenting names.';
        } else if (type === 'indentation' && personality.expertise.includes('team-collaboration')) {
            expertiseContext = ' Consistent formatting is crucial for team collaboration.';
        } else if (type === 'line-length' && personality.expertise.includes('readability')) {
            expertiseContext = ' Shorter lines improve code review and debugging.';
        }
        
        return `**🎨 ${profile.name} (Style):** ${baseMessage}${expertiseContext}`;
    }

    // Code element detection methods
    private isFunctionDeclaration(lineText: string, context: string): boolean {
        return /\b(function\s+\w+|const\s+\w+\s*=\s*\(|\w+\s*\(.*\)\s*=>|\w+\s*:\s*\(.*\)\s*=>)/.test(lineText) ||
               /^\s*(async\s+)?function\s+\w+/.test(lineText) ||
               /^\s*\w+\s*\(.*\)\s*\{/.test(lineText);
    }

    private isClassDeclaration(lineText: string, context: string): boolean {
        return /^\s*class\s+\w+/.test(lineText);
    }

    private isVariableDeclaration(lineText: string): boolean {
        return /^\s*(const|let|var)\s+\w+/.test(lineText);
    }

    private isMethodDeclaration(lineText: string, context: string): boolean {
        return /^\s*(async\s+)?\w+\s*\(.*\)\s*\{/.test(lineText) && 
               context.includes('class ') && 
               !lineText.includes('function');
    }

    // Name extraction methods
    private extractFunctionName(lineText: string): string {
        const match = lineText.match(/function\s+(\w+)|const\s+(\w+)\s*=|(\w+)\s*\(/);
        return match ? (match[1] || match[2] || match[3]) : 'anonymous';
    }

    private extractClassName(lineText: string): string {
        const match = lineText.match(/class\s+(\w+)/);
        return match ? match[1] : 'UnnamedClass';
    }

    private extractVariableName(lineText: string): string {
        const match = lineText.match(/(const|let|var)\s+(\w+)/);
        return match ? match[2] : 'variable';
    }

    private extractMethodName(lineText: string): string {
        const match = lineText.match(/(\w+)\s*\(/);
        return match ? match[1] : 'method';
    }

    // Characteristic analysis methods
    private analyzeFunctionCharacteristics(lineText: string, context: string): string[] {
        const characteristics: string[] = [];
        
        if (lineText.includes('async')) characteristics.push('asynchronous');
        if (lineText.match(/\(.*,.*,.*\)/)) characteristics.push('multiple-parameters');
        if (lineText.match(/\(\s*\)/)) characteristics.push('no-parameters');
        if (context.split('\n').length > 20) characteristics.push('long-function');
        if (context.includes('return')) characteristics.push('has-return');
        if (context.includes('console.log')) characteristics.push('has-logging');
        if (context.includes('throw') || context.includes('try')) characteristics.push('error-handling');
        
        return characteristics;
    }

    private analyzeClassCharacteristics(lineText: string, context: string): string[] {
        const characteristics: string[] = [];
        
        if (lineText.includes('extends')) characteristics.push('inheritance');
        if (context.includes('constructor')) characteristics.push('has-constructor');
        if (context.includes('static')) characteristics.push('has-static-methods');
        if (context.includes('private') || context.includes('protected')) characteristics.push('access-modifiers');
        
        const methodCount = (context.match(/\w+\s*\(/g) || []).length;
        if (methodCount > 10) characteristics.push('many-methods');
        if (methodCount < 3) characteristics.push('few-methods');
        
        return characteristics;
    }

    private analyzeVariableCharacteristics(lineText: string, context: string): string[] {
        const characteristics: string[] = [];
        
        if (lineText.includes('const')) characteristics.push('immutable');
        if (lineText.includes('let')) characteristics.push('mutable');
        if (lineText.includes('var')) characteristics.push('function-scoped');
        if (lineText.includes('[]') || lineText.includes('Array')) characteristics.push('array');
        if (lineText.includes('{}') || lineText.includes('Object')) characteristics.push('object');
        if (lineText.includes('async') || lineText.includes('Promise')) characteristics.push('promise');
        if (lineText.match(/=\s*\d+/)) characteristics.push('numeric');
        if (lineText.match(/=\s*['"`]/)) characteristics.push('string');
        
        return characteristics;
    }

    private analyzeMethodCharacteristics(lineText: string, context: string): string[] {
        const characteristics: string[] = [];
        
        if (lineText.includes('async')) characteristics.push('asynchronous');
        if (lineText.includes('static')) characteristics.push('static');
        if (lineText.includes('private')) characteristics.push('private');
        if (lineText.includes('protected')) characteristics.push('protected');
        if (lineText.match(/get\s+\w+/)) characteristics.push('getter');
        if (lineText.match(/set\s+\w+/)) characteristics.push('setter');
        
        return characteristics;
    }

    // Issue identification methods
    private identifyFunctionIssues(lineText: string, context: string): string[] {
        const issues: string[] = [];
        
        if (context.split('\n').length > 50) issues.push('too-long');
        if ((lineText.match(/\w+/g) || []).length > 10) issues.push('too-many-parameters');
        if (!context.includes('return') && !lineText.includes('void')) issues.push('no-return-value');
        if (context.includes('console.log') && !context.includes('debug')) issues.push('debug-statements');
        if (!context.includes('try') && context.includes('await')) issues.push('missing-error-handling');
        
        return issues;
    }

    private identifyClassIssues(lineText: string, context: string): string[] {
        const issues: string[] = [];
        
        const methodCount = (context.match(/\w+\s*\(/g) || []).length;
        if (methodCount > 20) issues.push('too-many-methods');
        if (!context.includes('constructor') && context.includes('this.')) issues.push('missing-constructor');
        if (context.includes('public') && context.includes('private')) issues.push('mixed-access-levels');
        
        return issues;
    }

    private identifyVariableIssues(lineText: string, context: string): string[] {
        const issues: string[] = [];
        
        if (lineText.includes('var')) issues.push('use-var');
        if (lineText.match(/\w{1,2}\s*=/)) issues.push('short-name');
        if (lineText.match(/[A-Z]{3,}/)) issues.push('all-caps-name');
        if (!lineText.includes('=')) issues.push('uninitialized');
        
        return issues;
    }

    private identifyMethodIssues(lineText: string, context: string): string[] {
        const issues: string[] = [];
        
        if (context.split('\n').length > 30) issues.push('too-long');
        if (!lineText.includes('return') && !lineText.includes('void')) issues.push('no-return-type');
        if (lineText.match(/\w+/g)?.length || 0 > 8) issues.push('too-many-parameters');
        
        return issues;
    }

    // Specific advice methods
    private getFunctionSpecificAdvice(analysis: CodeElementAnalysis, mentorId: string): string[] {
        const suggestions: string[] = [];
        const name = analysis.name;
        const characteristics = analysis.characteristics;
        const issues = analysis.issues;

        switch (mentorId) {
            case 'marcus':
                if (issues.includes('too-long')) {
                    suggestions.push(`**🔥 Function '${name}':** This function is a bloated mess! Break it down into smaller, focused functions. Nobody wants to debug a 50-line monster.`);
                }
                if (characteristics.includes('no-parameters')) {
                    suggestions.push(`**🔥 Function '${name}':** No parameters? Either this function is doing too much internally or it's not reusable. Fix it.`);
                }
                if (issues.includes('missing-error-handling')) {
                    suggestions.push(`**🔥 Function '${name}':** Async without error handling? That's how production crashes happen. Add try-catch blocks!`);
                }
                if (characteristics.includes('has-logging')) {
                    suggestions.push(`**🔥 Function '${name}':** Console.log statements? What is this, amateur hour? Use proper logging or remove them.`);
                }
                break;

            case 'sophia':
                if (issues.includes('too-long')) {
                    suggestions.push(`**😏 Function '${name}':** Oh look, another novel-length function! *adjusts glasses* Maybe consider the Single Responsibility Principle? Just a thought.`);
                }
                if (characteristics.includes('multiple-parameters')) {
                    suggestions.push(`**😏 Function '${name}':** So many parameters! It's like a function that can't make up its mind. Consider using an options object instead.`);
                }
                if (issues.includes('debug-statements')) {
                    suggestions.push(`**😏 Function '${name}':** Console.log everywhere? How... quaint. Professional logging libraries exist, you know.`);
                }
                break;

            case 'alex':
                if (characteristics.includes('asynchronous')) {
                    suggestions.push(`**🌟 Function '${name}':** ASYNC functions are SO COOL! 🚀 You're handling promises like a champion! Just remember to catch those errors - every promise needs a safety net! ✨`);
                }
                if (characteristics.includes('has-return')) {
                    suggestions.push(`**🌟 Function '${name}':** YES! Return values! 🎯 You're making this function useful and testable! That's FANTASTIC coding! 💫`);
                }
                if (issues.includes('too-long')) {
                    suggestions.push(`**🌟 Function '${name}':** This function is doing SO MUCH work! 💪 Maybe we could break it into smaller, specialized functions? It'll be like having a team of superheroes! ✨`);
                }
                break;
        }

        return suggestions;
    }

    private getClassSpecificAdvice(analysis: CodeElementAnalysis, mentorId: string): string[] {
        const suggestions: string[] = [];
        const name = analysis.name;
        const characteristics = analysis.characteristics;
        const issues = analysis.issues;

        switch (mentorId) {
            case 'marcus':
                if (issues.includes('too-many-methods')) {
                    suggestions.push(`**🔥 Class '${name}':** This class is doing everything! Split it up - classes should have a single responsibility, not be Swiss Army knives.`);
                }
                if (issues.includes('missing-constructor')) {
                    suggestions.push(`**🔥 Class '${name}':** No constructor? How are you initializing state? Don't rely on magic - be explicit.`);
                }
                break;

            case 'sophia':
                if (characteristics.includes('inheritance')) {
                    suggestions.push(`**😏 Class '${name}':** Ah, inheritance! How object-oriented of you. Just remember: favor composition over inheritance. It's less tangled.`);
                }
                if (characteristics.includes('many-methods')) {
                    suggestions.push(`**😏 Class '${name}':** This class is quite the overachiever, isn't it? Maybe consider if it's trying to do too many things at once.`);
                }
                break;

            case 'alex':
                if (characteristics.includes('has-constructor')) {
                    suggestions.push(`**🌟 Class '${name}':** CONSTRUCTORS are AMAZING! 🏗️ You're setting up your objects properly! That's such good architecture! ✨`);
                }
                if (characteristics.includes('inheritance')) {
                    suggestions.push(`**🌟 Class '${name}':** INHERITANCE! 🌳 You're building on existing code like a coding genius! Object-oriented programming is SO COOL! 🚀`);
                }
                break;
        }

        return suggestions;
    }

    private getVariableSpecificAdvice(analysis: CodeElementAnalysis, mentorId: string): string[] {
        const suggestions: string[] = [];
        const name = analysis.name;
        const characteristics = analysis.characteristics;
        const issues = analysis.issues;

        switch (mentorId) {
            case 'marcus':
                if (issues.includes('use-var')) {
                    suggestions.push(`**🔥 Variable '${name}':** Using 'var'? What year is this, 2010? Use 'let' or 'const' like a professional.`);
                }
                if (issues.includes('short-name')) {
                    suggestions.push(`**🔥 Variable '${name}':** Single letter variables? Write code for humans, not computers. Use descriptive names.`);
                }
                break;

            case 'sophia':
                if (characteristics.includes('immutable')) {
                    suggestions.push(`**😏 Variable '${name}':** Using 'const'! How responsible of you. Immutability is quite fashionable these days.`);
                }
                if (issues.includes('short-name')) {
                    suggestions.push(`**😏 Variable '${name}':** '${name}'? Really? Future you will have no idea what this cryptic abbreviation means.`);
                }
                break;

            case 'alex':
                if (characteristics.includes('immutable')) {
                    suggestions.push(`**🌟 Variable '${name}':** CONST variables! 🔒 You're preventing accidental changes! That's BRILLIANT defensive programming! ✨`);
                }
                if (characteristics.includes('array')) {
                    suggestions.push(`**🌟 Variable '${name}':** ARRAYS are SO POWERFUL! 📚 You can store multiple values and iterate through them! Data structures are AMAZING! 🚀`);
                }
                break;
        }

        return suggestions;
    }

    private getMethodSpecificAdvice(analysis: CodeElementAnalysis, mentorId: string): string[] {
        const suggestions: string[] = [];
        const name = analysis.name;
        const characteristics = analysis.characteristics;
        const issues = analysis.issues;

        switch (mentorId) {
            case 'marcus':
                if (characteristics.includes('private')) {
                    suggestions.push(`**🔥 Method '${name}':** Good, it's private. At least you understand encapsulation basics.`);
                }
                if (issues.includes('too-long')) {
                    suggestions.push(`**🔥 Method '${name}':** Another bloated method. Break it down or suffer in debugging hell.`);
                }
                break;

            case 'sophia':
                if (characteristics.includes('getter')) {
                    suggestions.push(`**😏 Method '${name}':** A getter! How elegant. Just don't go overboard with getters and setters - this isn't Java.`);
                }
                if (characteristics.includes('asynchronous')) {
                    suggestions.push(`**😏 Method '${name}':** Async method in a class? Interesting choice. Just remember to handle those promises properly.`);
                }
                break;

            case 'alex':
                if (characteristics.includes('static')) {
                    suggestions.push(`**🌟 Method '${name}':** STATIC methods! 🏛️ You can call this without creating an instance! That's such smart design! ✨`);
                }
                if (characteristics.includes('asynchronous')) {
                    suggestions.push(`**🌟 Method '${name}':** ASYNC methods are INCREDIBLE! ⚡ You're handling time-based operations like a time wizard! 🚀`);
                }
                break;
        }

        return suggestions;
    }

    // File analysis methods
    private extractImports(fullText: string): string[] {
        const imports: string[] = [];
        const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"`]([^'"`]+)['"`]/g;
        let match;
        while ((match = importRegex.exec(fullText)) !== null) {
            imports.push(match[1]);
        }
        return imports;
    }

    private extractDependencies(imports: string[]): string[] {
        return imports.filter(imp => !imp.startsWith('.') && !imp.startsWith('/'));
    }

    private extractExports(fullText: string): string[] {
        const exports: string[] = [];
        const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var)\s+(\w+)/g;
        let match;
        while ((match = exportRegex.exec(fullText)) !== null) {
            exports.push(match[1]);
        }
        return exports;
    }

    private extractFunctions(fullText: string): string[] {
        const functions: string[] = [];
        const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\(|(\w+)\s*:\s*(?:async\s+)?\()/g;
        let match;
        while ((match = functionRegex.exec(fullText)) !== null) {
            functions.push(match[1] || match[2] || match[3]);
        }
        return functions.filter(f => f);
    }

    private extractClasses(fullText: string): string[] {
        const classes: string[] = [];
        const classRegex = /class\s+(\w+)/g;
        let match;
        while ((match = classRegex.exec(fullText)) !== null) {
            classes.push(match[1]);
        }
        return classes;
    }

    private extractVariables(fullText: string): string[] {
        const variables: string[] = [];
        const varRegex = /(?:const|let|var)\s+(\w+)/g;
        let match;
        while ((match = varRegex.exec(fullText)) !== null) {
            variables.push(match[1]);
        }
        return variables;
    }

    private identifyPatterns(fullText: string): string[] {
        const patterns: string[] = [];
        
        if (fullText.includes('useState') || fullText.includes('useEffect')) patterns.push('react-hooks');
        if (fullText.includes('async') && fullText.includes('await')) patterns.push('async-await');
        if (fullText.includes('Promise')) patterns.push('promises');
        if (fullText.includes('try') && fullText.includes('catch')) patterns.push('error-handling');
        if (fullText.includes('class') && fullText.includes('extends')) patterns.push('inheritance');
        if (fullText.includes('interface') || fullText.includes('type')) patterns.push('typescript');
        if (fullText.includes('fetch') || fullText.includes('axios')) patterns.push('http-requests');
        if (fullText.includes('map') || fullText.includes('filter') || fullText.includes('reduce')) patterns.push('functional-programming');
        
        return patterns;
    }

    private identifyArchitecturalPatterns(fullText: string, analysis: FileAnalysis): string[] {
        const architecture: string[] = [];
        
        if (analysis.classes.length > 0 && analysis.functions.length > 0) architecture.push('mixed-paradigm');
        if (analysis.classes.length > 3) architecture.push('object-oriented');
        if (analysis.functions.length > analysis.classes.length * 2) architecture.push('functional');
        if (fullText.includes('export default')) architecture.push('module-pattern');
        if (analysis.imports.length > 10) architecture.push('dependency-heavy');
        if (fullText.includes('singleton') || fullText.includes('getInstance')) architecture.push('singleton-pattern');
        if (fullText.includes('factory') || fullText.includes('create')) architecture.push('factory-pattern');
        if (fullText.includes('observer') || fullText.includes('subscribe')) architecture.push('observer-pattern');
        
        return architecture;
    }

    private calculateComplexity(fullText: string, analysis: FileAnalysis): 'low' | 'medium' | 'high' {
        const lines = fullText.split('\n').length;
        const totalElements = analysis.functions.length + analysis.classes.length + analysis.variables.length;
        const cyclomaticIndicators = (fullText.match(/if|for|while|switch|catch/g) || []).length;
        
        if (lines > 500 || totalElements > 20 || cyclomaticIndicators > 15) return 'high';
        if (lines > 200 || totalElements > 10 || cyclomaticIndicators > 8) return 'medium';
        return 'low';
    }

    private identifyCodeSmells(fullText: string, analysis: FileAnalysis): string[] {
        const smells: string[] = [];
        
        if (fullText.split('\n').length > 1000) smells.push('large-file');
        if (analysis.functions.some(f => fullText.includes(f) && fullText.split(f)[1]?.split('\n').length > 50)) smells.push('long-functions');
        if ((fullText.match(/console\.log/g) || []).length > 5) smells.push('debug-statements');
        if ((fullText.match(/var\s+/g) || []).length > 0) smells.push('var-usage');
        if ((fullText.match(/==(?!=)/g) || []).length > 0) smells.push('loose-equality');
        if (analysis.classes.length > 0 && !fullText.includes('constructor')) smells.push('missing-constructors');
        if ((fullText.match(/TODO|FIXME|HACK/g) || []).length > 0) smells.push('technical-debt');
        
        return smells;
    }

    private getContextualArchitecturalSuggestions(
        word: string,
        lineText: string,
        fileAnalysis: FileAnalysis,
        profile: MentorProfile,
        position: vscode.Position
    ): string[] {
        const suggestions: string[] = [];
        const expertise = profile.personality?.expertise || [];
        const focusAreas = profile.personality?.focusAreas || [];
        const username = profile.githubUsername;
        
        // Highly personalized architecture suggestions based on GitHub profile
        if (username && expertise.length > 0) {
            // Microservices expertise
            if (expertise.includes('microservices') && fileAnalysis.imports.length > 10) {
                suggestions.push(`**🏗️ ${profile.name} (Microservices):** Too many imports suggest this module might be doing too much. In microservices architecture, each service should have a single responsibility. Consider splitting this into focused modules.`);
            }
            
            // React expertise with specific patterns
            if (expertise.includes('react')) {
                if (word === 'useState' || word === 'useEffect') {
                    suggestions.push(`**⚛️ ${profile.name} (React):** ${word} detected! Key rules: only call hooks at the top level, never in loops/conditions. For useEffect, always include dependencies in the array to prevent stale closures.`);
                }
                if (lineText.includes('class') && lineText.includes('Component')) {
                    suggestions.push(`**⚛️ ${profile.name} (React):** Class component spotted! Consider migrating to functional components with hooks for better performance and simpler testing.`);
                }
            }
            
            // Node.js specific patterns
            if (expertise.includes('node.js')) {
                if (lineText.includes('require(')) {
                    suggestions.push(`**📦 ${profile.name} (Node.js):** CommonJS require detected. ES modules (import/export) provide better tree-shaking, static analysis, and are the future of JavaScript modules.`);
                }
                if (lineText.includes('fs.') && !lineText.includes('await')) {
                    suggestions.push(`**📦 ${profile.name} (Node.js):** File system operation detected. Consider using the async versions (fs.promises) to avoid blocking the event loop.`);
                }
            }
            
            // Performance focus
            if (focusAreas.includes('performance')) {
                if (fileAnalysis.complexity === 'high') {
                    suggestions.push(`**⚡ ${profile.name} (Performance):** High complexity file detected. Consider code splitting, lazy loading, or breaking into smaller chunks. Large bundles hurt initial load time.`);
                }
                if (lineText.includes('map(') && lineText.includes('filter(')) {
                    suggestions.push(`**⚡ ${profile.name} (Performance):** Chained array methods detected. Consider combining map/filter operations to reduce iterations over large datasets.`);
                }
            }
            
            // Testing focus
            if (expertise.includes('testing') || focusAreas.includes('testing')) {
                if (fileAnalysis.functions.length > 5 && !fileAnalysis.patterns.includes('test')) {
                    suggestions.push(`**🧪 ${profile.name} (Testing):** ${fileAnalysis.functions.length} functions without tests. Each function should have corresponding tests - they're living documentation and prevent regressions.`);
                }
                if (lineText.includes('async') && !lineText.includes('await')) {
                    suggestions.push(`**🧪 ${profile.name} (Testing):** Async function without await? Make sure you're properly testing async behavior with proper assertions.`);
                }
            }
            
            // Security focus
            if (focusAreas.includes('security')) {
                if (lineText.includes('eval(') || lineText.includes('innerHTML')) {
                    suggestions.push(`**🔒 ${profile.name} (Security):** Potential security risk detected! eval() and innerHTML can lead to XSS vulnerabilities. Consider safer alternatives like textContent or proper sanitization.`);
                }
            }
            
            // TypeScript expertise
            if (expertise.includes('typescript')) {
                if (lineText.includes('any') || lineText.includes('as any')) {
                    suggestions.push(`**📝 ${profile.name} (TypeScript):** 'any' type defeats the purpose of TypeScript! Consider using proper types, generics, or union types for better type safety.`);
                }
            }
        } else {
            // Fallback to generic suggestions for non-GitHub profiles
            const mentorId = profile.id;
            if (fileAnalysis.complexity === 'high') {
                switch (mentorId) {
                    case 'marcus':
                        suggestions.push("**🔥 Architecture:** This file is a complexity nightmare! Break it down into smaller, focused modules before it becomes unmaintainable.");
                        break;
                    case 'sophia':
                        suggestions.push("**😏 Architecture:** Oh my, this file is quite the ambitious project, isn't it? Maybe consider some architectural refactoring?");
                        break;
                    case 'alex':
                        suggestions.push("**🌟 Architecture:** WOW! This file is doing SO MUCH! 🚀 Maybe we could split it into smaller, specialized modules? It'll be like organizing a superhero team! ✨");
                        break;
                }
            }
        }

        return suggestions;
    }
}
