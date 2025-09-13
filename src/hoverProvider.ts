import * as vscode from 'vscode';
import { ProfileManager, MentorProfile } from './profileManager';
import { ASTAnalyzer } from './astAnalyzer';

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
    constructor(
        private profileManager: ProfileManager,
        private astAnalyzer: ASTAnalyzer
    ) {}

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

        const markdown = new vscode.MarkdownString();
        markdown.isTrusted = true;
        markdown.supportHtml = true;

        // Add mentor header
        markdown.appendMarkdown(`### ${activeProfile.avatar} ${activeProfile.name}\n\n`);
        
        suggestions.forEach(suggestion => {
            markdown.appendMarkdown(`${suggestion}\n\n`);
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
        
        // Analyze specific code elements
        const elementAnalysis = this.analyzeCodeElement(word, lineText, context, languageId);
        
        // Generate custom suggestions based on the specific element and full file context
        const customSuggestions = this.getCustomSuggestions(elementAnalysis, profile, fileAnalysis);
        suggestions.push(...customSuggestions);
        
        // Generate context-aware architectural suggestions
        const architecturalSuggestions = this.getContextualArchitecturalSuggestions(word, lineText, fileAnalysis, profile, position);
        suggestions.push(...architecturalSuggestions);
        
        // Code styling suggestions
        const stylingSuggestions = this.getCodeStylingSuggestions(word, lineText, context, languageId, profile);
        suggestions.push(...stylingSuggestions);
        
        return suggestions.filter(s => s.length > 0);
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
        const mentorId = profile.id;
        
        // Function architecture suggestions
        if (word === 'function' || lineText.includes('function') || lineText.includes('=>')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🏗️ Architecture:** This function better have a single responsibility. If it's doing more than one thing, split it up. No one wants to debug a 200-line monster function.");
                    break;
                case 'sophia':
                    suggestions.push("**🏗️ Architecture:** Oh look, another function! *adjusts glasses* Make sure it's not trying to be the Swiss Army knife of your codebase. Single responsibility principle is your friend here.");
                    break;
                case 'alex':
                    suggestions.push("**🏗️ Architecture:** WOW! A function! 🎉 This is AMAZING! Make sure it has one clear job - functions are like superheroes, they're best when they have one superpower! ✨");
                    break;
            }
        }

        // Class architecture suggestions
        if (word === 'class' || lineText.includes('class ')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🏗️ Architecture:** Classes should be cohesive and loosely coupled. If this class knows too much about other classes, you're building a house of cards.");
                    break;
                case 'sophia':
                    suggestions.push("**🏗️ Architecture:** A class! How object-oriented of you. Remember: high cohesion, low coupling. It's like a good relationship - independent but working together.");
                    break;
                case 'alex':
                    suggestions.push("**🏗️ Architecture:** CLASSES are SO COOL! 🌟 They're like blueprints for awesome objects! Make sure each class has a clear purpose - like a specialized team member! 🚀");
                    break;
            }
        }

        // Import/module architecture
        if (word === 'import' || word === 'require' || lineText.includes('import') || lineText.includes('require')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🏗️ Architecture:** Keep your imports organized and minimal. Circular dependencies are the devil. If you have them, fix your architecture.");
                    break;
                case 'sophia':
                    suggestions.push("**🏗️ Architecture:** Importing things, I see. Just remember - dependency injection is cleaner than tight coupling. Your future self will thank you.");
                    break;
                case 'alex':
                    suggestions.push("**🏗️ Architecture:** IMPORTS! 📦 You're building with modules - that's FANTASTIC! Keep them organized and avoid circular dependencies - it's like avoiding tangled Christmas lights! ✨");
                    break;
            }
        }

        // Async architecture
        if (word === 'async' || word === 'await' || lineText.includes('Promise')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🏗️ Architecture:** Async code better have proper error handling. Unhandled promise rejections will crash your app faster than you can say 'callback hell'.");
                    break;
                case 'sophia':
                    suggestions.push("**🏗️ Architecture:** Ah, async operations. How modern! Just don't forget error boundaries and proper promise chaining. Nobody likes mysterious crashes.");
                    break;
                case 'alex':
                    suggestions.push("**🏗️ Architecture:** ASYNC CODE! 🚀 You're handling time like a time wizard! Remember to catch those errors - every promise needs a safety net! ⚡");
                    break;
            }
        }

        // Database/API architecture
        if (context.includes('fetch') || context.includes('axios') || context.includes('api') || context.includes('database')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🏗️ Architecture:** API calls need retry logic, timeouts, and proper error handling. Don't assume the network is reliable - it's not.");
                    break;
                case 'sophia':
                    suggestions.push("**🏗️ Architecture:** Making external calls? How brave! Consider implementing the repository pattern - it's like having a translator between your app and the outside world.");
                    break;
                case 'alex':
                    suggestions.push("**🏗️ Architecture:** API interactions! 🌐 You're connecting to the world! Consider using the adapter pattern - it's like having a universal translator! SO COOL! ✨");
                    break;
            }
        }

        return suggestions;
    }

    private getCodeStylingSuggestions(
        word: string,
        lineText: string,
        context: string,
        languageId: string,
        profile: MentorProfile
    ): string[] {
        const suggestions: string[] = [];
        const mentorId = profile.id;
        const stylePrefs = profile.codeStylePreferences;
        
        // Variable naming suggestions
        if (word.match(/^[a-z][a-zA-Z0-9]*$/) && lineText.includes('=')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push(`**🎨 Style:** Variable names should be descriptive, not cryptic. If I can't understand what '${word}' does from its name, neither can you in 6 months.`);
                    break;
                case 'sophia':
                    suggestions.push(`**🎨 Style:** '${word}' - interesting choice. Remember, code is read more than it's written. Make it readable, not like ancient hieroglyphs.`);
                    break;
                case 'alex':
                    suggestions.push(`**🎨 Style:** '${word}' is a GREAT variable name! 🌟 Clear naming makes code so much more readable - like putting labels on everything! ✨`);
                    break;
            }
        }

        // Indentation style check
        const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || '';
        if (leadingWhitespace.length > 0) {
            const hasSpaces = leadingWhitespace.includes(' ');
            const hasTabs = leadingWhitespace.includes('\t');
            
            if ((stylePrefs.indentStyle === 'spaces' && hasTabs) || (stylePrefs.indentStyle === 'tabs' && hasSpaces)) {
                switch (mentorId) {
                    case 'marcus':
                        suggestions.push(`**🎨 Style:** Mixed tabs and spaces? What is this, amateur hour? Pick ${stylePrefs.indentStyle} and stick with it.`);
                        break;
                    case 'sophia':
                        suggestions.push(`**🎨 Style:** Oh, the classic tabs vs spaces debate! Your profile prefers ${stylePrefs.indentStyle}. Consistency is key, darling.`);
                        break;
                    case 'alex':
                        suggestions.push(`**🎨 Style:** Indentation is SO important! 📏 Your profile loves ${stylePrefs.indentStyle} - consistent formatting makes code BEAUTIFUL! ✨`);
                        break;
                }
            }
        }

        // Quote style suggestions (JavaScript/TypeScript)
        if ((languageId === 'javascript' || languageId === 'typescript') && (lineText.includes('"') || lineText.includes("'"))) {
            const hasDoubleQuotes = lineText.includes('"');
            const hasSingleQuotes = lineText.includes("'");
            
            if ((stylePrefs.preferredQuotes === 'single' && hasDoubleQuotes) || 
                (stylePrefs.preferredQuotes === 'double' && hasSingleQuotes)) {
                switch (mentorId) {
                    case 'marcus':
                        suggestions.push(`**🎨 Style:** Your profile prefers ${stylePrefs.preferredQuotes} quotes. Pick a style and stick with it - consistency matters.`);
                        break;
                    case 'sophia':
                        suggestions.push(`**🎨 Style:** Quote consistency, please! Your profile likes ${stylePrefs.preferredQuotes} quotes. It's like choosing an outfit - match your accessories.`);
                        break;
                    case 'alex':
                        suggestions.push(`**🎨 Style:** Quote styles! 📝 Your profile LOVES ${stylePrefs.preferredQuotes} quotes - consistent styling makes code look AMAZING! ✨`);
                        break;
                }
            }
        }

        // Semicolon suggestions (JavaScript/TypeScript)
        if ((languageId === 'javascript' || languageId === 'typescript')) {
            const hasSemicolon = lineText.trim().endsWith(';');
            const shouldHaveSemicolon = stylePrefs.semicolons && 
                (lineText.includes('=') || lineText.includes('return') || lineText.includes('const') || lineText.includes('let'));
            
            if (shouldHaveSemicolon && !hasSemicolon) {
                switch (mentorId) {
                    case 'marcus':
                        suggestions.push("**🎨 Style:** Missing semicolon. Your profile requires them. Don't rely on ASI - be explicit.");
                        break;
                    case 'sophia':
                        suggestions.push("**🎨 Style:** Where's your semicolon? Your profile expects them. It's like forgetting to dot your i's and cross your t's.");
                        break;
                    case 'alex':
                        suggestions.push("**🎨 Style:** Semicolons are AWESOME! 🎯 Your profile loves them - they make statements complete and clear! ✨");
                        break;
                }
            }
        }

        // Line length suggestions
        if (lineText.length > stylePrefs.maxLineLength) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push(`**🎨 Style:** This line is ${lineText.length} characters. Your profile limit is ${stylePrefs.maxLineLength}. Break it up - nobody likes horizontal scrolling.`);
                    break;
                case 'sophia':
                    suggestions.push(`**🎨 Style:** This line is getting a bit long, don't you think? ${lineText.length} chars vs your ${stylePrefs.maxLineLength} limit. Time for some line breaks!`);
                    break;
                case 'alex':
                    suggestions.push(`**🎨 Style:** This line is REALLY long! 📏 ${lineText.length} characters! Your profile prefers ${stylePrefs.maxLineLength} max - shorter lines are easier to read! ✨`);
                    break;
            }
        }

        return suggestions;
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
        const mentorId = profile.id;

        // Analyze based on file context
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

        // Dependency-specific suggestions
        if (fileAnalysis.dependencies.length > 10) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push(`**🔥 Dependencies:** ${fileAnalysis.dependencies.length} dependencies? This is dependency hell! Audit these imports and remove what you don't need.`);
                    break;
                case 'sophia':
                    suggestions.push(`**😏 Dependencies:** ${fileAnalysis.dependencies.length} dependencies... Someone's been shopping in the npm store, haven't they?`);
                    break;
                case 'alex':
                    suggestions.push(`**🌟 Dependencies:** ${fileAnalysis.dependencies.length} dependencies! You're building on the work of SO MANY developers! 🌍 Just make sure we're using them all! ✨`);
                    break;
            }
        }

        // Pattern-specific suggestions
        if (fileAnalysis.patterns.includes('react-hooks') && word.includes('use')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push(`**🔥 Hook '${word}':** React hooks better follow the rules of hooks. No conditional calls, no nested functions. Don't make me debug your hook violations.`);
                    break;
                case 'sophia':
                    suggestions.push(`**😏 Hook '${word}':** Ah, React hooks! Just remember the rules - they're not suggestions, they're laws of the React universe.`);
                    break;
                case 'alex':
                    suggestions.push(`**🌟 Hook '${word}':** REACT HOOKS! 🎣 You're using modern React patterns! That's AMAZING! Just remember to follow the rules of hooks! ✨`);
                    break;
            }
        }

        // Code smell suggestions
        if (fileAnalysis.codeSmells.includes('debug-statements')) {
            switch (mentorId) {
                case 'marcus':
                    suggestions.push("**🔥 Code Quality:** Console.log statements everywhere? Clean up your debugging mess before shipping this code.");
                    break;
                case 'sophia':
                    suggestions.push("**😏 Code Quality:** I see we're fans of console.log debugging. How... traditional. Ever heard of a debugger?");
                    break;
                case 'alex':
                    suggestions.push("**🌟 Code Quality:** I see some console.log statements! 📝 They're great for debugging! Maybe we could use a proper logging library for production? ✨");
                    break;
            }
        }

        return suggestions;
    }
}
