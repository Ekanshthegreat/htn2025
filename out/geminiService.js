"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiService = void 0;
const generative_ai_1 = require("@google/generative-ai");
const vscode = __importStar(require("vscode"));
class GeminiService {
    constructor() {
        this.genAI = null;
        this.model = null;
        this.conversationHistory = [];
        this.initializeGemini();
    }
    initializeGemini() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const apiKey = config.get('apiKey');
        if (!apiKey) {
            vscode.window.showWarningMessage('AI Mentor: Please set your Gemini API key in settings');
            return;
        }
        try {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({
                model: 'gemini-1.5-pro',
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
        }
        catch (error) {
            console.error('Failed to initialize Gemini:', error);
            vscode.window.showErrorMessage('Failed to initialize Gemini API');
        }
    }
    async sendMessage(message) {
        if (!this.model) {
            return null;
        }
        try {
            const prompt = this.buildAdvancedPrompt(message);
            const chat = this.model.startChat({
                history: this.conversationHistory,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                },
            });
            const result = await chat.sendMessage(prompt);
            const response = await result.response;
            const content = response.text();
            if (!content)
                return null;
            // Add to conversation history
            this.conversationHistory.push({ role: 'user', parts: [{ text: prompt }] }, { role: 'model', parts: [{ text: content }] });
            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }
            return this.parseAdvancedResponse(content, message.type);
        }
        catch (error) {
            console.error('Gemini Service error:', error);
            vscode.window.showErrorMessage(`AI Mentor error: ${error}`);
            return null;
        }
    }
    buildAdvancedPrompt(message) {
        const systemContext = `You are an advanced AI programming mentor powered by Google Gemini. You're designed to revolutionize the developer experience by providing:

1. **Proactive Code Intelligence**: Analyze code patterns and predict potential issues before they occur
2. **Natural Language Code Narration**: Explain complex code flows in conversational, easy-to-understand language
3. **Contextual Learning**: Adapt explanations based on the developer's skill level and coding patterns
4. **Multi-Modal Understanding**: Process code, comments, variable names, and project structure holistically
5. **Predictive Debugging**: Identify likely failure points and suggest preventive measures

Your responses should be formatted as JSON with this structure:
{
  "message": "Primary explanation in natural, conversational language",
  "insights": ["Deep technical insights about the code"],
  "predictions": ["Potential future issues or improvements"],
  "suggestions": ["Actionable recommendations"],
  "warnings": ["Important alerts or concerns"],
  "codeSnippets": [{"language": "js", "code": "example", "explanation": "why this helps"}],
  "type": "narration|warning|suggestion|explanation|insight",
  "confidence": 0.95,
  "learningOpportunity": "What the developer can learn from this"
}`;
        switch (message.type) {
            case 'code_changed':
                return `${systemContext}

The developer just modified ${message.fileName} (${message.language}). Analyze the change with advanced pattern recognition:

**Previous Code:**
\`\`\`${message.language}
${message.previousContent}
\`\`\`

**Current Code:**
\`\`\`${message.language}
${message.currentContent}
\`\`\`

**AST Analysis:**
${JSON.stringify(message.analysis, null, 2)}

Provide advanced insights including:
- Code quality impact assessment
- Performance implications
- Security considerations
- Maintainability analysis
- Potential refactoring opportunities
- Learning opportunities for the developer`;
            case 'cursor_moved':
                return `${systemContext}

The developer positioned their cursor at line ${message.position?.line} in ${message.fileName}. Provide contextual intelligence:

**Current Line:** ${message.currentLine}
**Surrounding Context:**
${message.context}

Analyze:
- What this code section does in the broader context
- Potential improvements or optimizations
- Common patterns and best practices
- Related code sections they might want to examine
- Learning opportunities about this pattern`;
            case 'start_debugging':
                return `${systemContext}

The developer wants to debug this ${message.language} code. Provide an advanced debugging strategy:

\`\`\`${message.language}
${message.code}
\`\`\`

**Code Analysis:**
${JSON.stringify(message.analysis, null, 2)}

Create a comprehensive debugging plan including:
- Strategic breakpoint placement with reasoning
- Data flow analysis and variable tracking
- Potential failure scenarios and their symptoms
- Step-by-step debugging methodology
- Advanced debugging techniques specific to this code pattern`;
            case 'trace_execution':
                return `${systemContext}

Provide an advanced execution trace for this ${message.language} code:

\`\`\`${message.language}
${message.code}
\`\`\`

**Execution Flow:**
${JSON.stringify(message.executionFlow, null, 2)}

Narrate the execution like an expert mentor:
- Step-by-step flow with data transformations
- Memory and performance implications
- Critical decision points and branching logic
- Potential optimization opportunities
- Educational insights about the execution pattern`;
            case 'file_created':
                return `${systemContext}

The developer created ${message.fileName} (${message.language}):

\`\`\`${message.language}
${message.content}
\`\`\`

Provide advanced project analysis:
- Architectural implications of this new file
- Integration patterns with existing codebase
- Best practices for this file type/pattern
- Potential future development directions
- Code organization and structure recommendations`;
            default:
                return `${systemContext}

Developer action: ${message.type}. Provide contextual guidance and insights.`;
        }
    }
    parseAdvancedResponse(content, messageType) {
        try {
            const parsed = JSON.parse(content);
            return {
                message: parsed.message || content,
                insights: parsed.insights || [],
                predictions: parsed.predictions || [],
                suggestions: parsed.suggestions || [],
                warnings: parsed.warnings || [],
                codeSnippets: parsed.codeSnippets || [],
                type: parsed.type || this.inferResponseType(messageType),
                confidence: parsed.confidence || 0.8,
                learningOpportunity: parsed.learningOpportunity || ''
            };
        }
        catch {
            return {
                message: content,
                suggestions: [],
                warnings: [],
                codeSnippets: [],
                type: this.inferResponseType(messageType)
            };
        }
    }
    inferResponseType(messageType) {
        switch (messageType) {
            case 'trace_execution':
                return 'narration';
            case 'start_debugging':
                return 'explanation';
            case 'code_changed':
                return 'insight';
            case 'cursor_moved':
                return 'suggestion';
            default:
                return 'explanation';
        }
    }
    clearHistory() {
        this.conversationHistory = [];
    }
}
exports.GeminiService = GeminiService;
//# sourceMappingURL=geminiService.js.map