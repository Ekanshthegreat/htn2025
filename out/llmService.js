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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const vscode = __importStar(require("vscode"));
const openai_1 = __importDefault(require("openai"));
class LLMService {
    constructor() {
        this.openai = null;
        this.conversationHistory = [];
        this.initializeProvider();
    }
    initializeProvider() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get('llmProvider', 'openai');
        const apiKey = config.get('apiKey');
        if (!apiKey) {
            vscode.window.showWarningMessage('AI Mentor: Please set your API key in settings');
            return;
        }
        switch (provider) {
            case 'openai':
                this.openai = new openai_1.default({ apiKey });
                break;
            // Add other providers as needed
        }
    }
    async sendMessage(message) {
        if (!this.openai) {
            return null;
        }
        try {
            const prompt = this.buildPrompt(message);
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: this.getSystemPrompt()
                    },
                    ...this.conversationHistory,
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: 1000,
                temperature: 0.7
            });
            const content = response.choices[0]?.message?.content;
            if (!content)
                return null;
            // Add to conversation history
            this.conversationHistory.push({ role: 'user', content: prompt }, { role: 'assistant', content: content });
            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }
            return this.parseResponse(content, message.type);
        }
        catch (error) {
            console.error('LLM Service error:', error);
            vscode.window.showErrorMessage(`AI Mentor error: ${error}`);
            return null;
        }
    }
    getSystemPrompt() {
        return `You are an AI programming mentor and pair programming assistant. Your role is to:

1. Watch code changes in real-time and provide natural language explanations
2. Proactively identify potential issues before they become problems
3. Guide users through debugging processes step-by-step
4. Explain code flow and data transformations in simple terms
5. Act like an experienced developer mentoring a junior programmer

Key behaviors:
- Be proactive, not just reactive
- Explain the "why" behind code patterns and potential issues
- Use natural, conversational language
- Focus on teaching and understanding, not just fixing
- Point out best practices and suggest improvements
- When tracing execution, narrate the flow like you're walking through it together

Response format should be JSON with:
{
  "message": "Main explanation or narration",
  "suggestions": ["Optional array of suggestions"],
  "warnings": ["Optional array of warnings"],
  "codeSnippets": [{"language": "js", "code": "example"}],
  "type": "narration|warning|suggestion|explanation"
}`;
    }
    buildPrompt(message) {
        switch (message.type) {
            case 'code_changed':
                return `The user just modified ${message.fileName} (${message.language}). Here's what changed:

Previous content:
\`\`\`${message.language}
${message.previousContent}
\`\`\`

Current content:
\`\`\`${message.language}
${message.currentContent}
\`\`\`

Analysis: ${JSON.stringify(message.analysis, null, 2)}

Please explain what the user changed and any potential implications, issues, or suggestions you have. Be conversational and helpful.`;
            case 'cursor_moved':
                return `The user moved their cursor to line ${message.position?.line} in ${message.fileName}:

Current line: ${message.currentLine}

Context around cursor:
${message.context}

Provide any relevant insights about this code location, potential issues, or helpful explanations.`;
            case 'start_debugging':
                return `The user wants to start debugging this ${message.language} code:

\`\`\`${message.language}
${message.code}
\`\`\`

Analysis: ${JSON.stringify(message.analysis, null, 2)}

Guide them through a debugging approach. Suggest breakpoints, explain potential issues, and provide a step-by-step debugging strategy.`;
            case 'trace_execution':
                return `Please trace through the execution of this ${message.language} code and narrate the flow:

\`\`\`${message.language}
${message.code}
\`\`\`

Execution flow: ${JSON.stringify(message.executionFlow, null, 2)}

Walk through the code execution step by step, explaining how data flows and what happens at each stage.`;
            case 'file_created':
                return `The user created a new file: ${message.fileName} (${message.language})

Content:
\`\`\`${message.language}
${message.content}
\`\`\`

Welcome them and provide any initial observations or suggestions about their new file.`;
            default:
                return `User action: ${message.type}. Please provide appropriate guidance.`;
        }
    }
    parseResponse(content, messageType) {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(content);
            return {
                message: parsed.message || content,
                suggestions: parsed.suggestions || [],
                warnings: parsed.warnings || [],
                codeSnippets: parsed.codeSnippets || [],
                type: parsed.type || this.inferResponseType(messageType)
            };
        }
        catch {
            // Fallback to plain text
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
                return 'suggestion';
            default:
                return 'explanation';
        }
    }
    clearHistory() {
        this.conversationHistory = [];
    }
}
exports.LLMService = LLMService;
//# sourceMappingURL=llmService.js.map