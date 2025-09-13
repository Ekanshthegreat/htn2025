import * as vscode from 'vscode';
import OpenAI from 'openai';
import { GeminiService } from './geminiService';
import { ProfileManager, MentorProfile } from './profileManager';

export interface MentorMessage {
    type: 'code_changed' | 'cursor_moved' | 'file_created' | 'start_debugging' | 'trace_execution';
    fileName?: string;
    language?: string;
    content?: string;
    diff?: any[];
    analysis?: any;
    previousContent?: string;
    currentContent?: string;
    position?: { line: number; character: number };
    currentLine?: string;
    context?: string;
    code?: string;
    ast?: any;
    executionFlow?: any;
}

export interface MentorResponse {
    message: string;
    insights?: string[];
    predictions?: string[];
    suggestions?: string[];
    warnings?: string[];
    codeSnippets?: { language: string; code: string; explanation?: string }[];
    type: 'narration' | 'warning' | 'suggestion' | 'explanation' | 'insight';
    confidence?: number;
    learningOpportunity?: string;
}

export class LLMService {
    private openai: OpenAI | null = null;
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    private profileManager?: any;

    constructor(profileManager?: any) {
        this.profileManager = profileManager;
        this.initializeProvider();
    }

    private initializeProvider() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get<string>('llmProvider', 'openai');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            vscode.window.showWarningMessage('AI Mentor: Please set your API key in settings');
            return;
        }

        switch (provider) {
            case 'openai':
                this.openai = new OpenAI({ apiKey });
                break;
            // Add other providers as needed
        }
    }

    async sendMessage(message: MentorMessage): Promise<MentorResponse | null> {
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
                        content: this.getSystemPrompt(message.type)
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
            if (!content) return null;

            // Add to conversation history
            this.conversationHistory.push(
                { role: 'user', content: prompt },
                { role: 'assistant', content: content }
            );

            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return this.parseResponse(content, message.type);
        } catch (error) {
            console.error('LLM Service error:', error);
            vscode.window.showErrorMessage(`AI Mentor error: ${error}`);
            return null;
        }
    }

    private getSystemPrompt(messageType?: string): string {
        // Get profile-specific prompt if profile manager is available
        if (this.profileManager) {
            try {
                const activeProfile = this.profileManager.getActiveProfile();
                console.log('Active profile:', activeProfile?.name, activeProfile?.id);
                
                if (activeProfile && activeProfile.prompts) {
                    let basePrompt = activeProfile.prompts.systemPrompt;
                    
                    // Use specific prompt based on message type
                    switch (messageType) {
                        case 'start_debugging':
                            basePrompt = activeProfile.prompts.debuggingPrompt;
                            break;
                        case 'code_changed':
                            basePrompt = activeProfile.prompts.reviewPrompt;
                            break;
                        case 'trace_execution':
                            basePrompt = activeProfile.prompts.explanationPrompt;
                            break;
                        default:
                            basePrompt = activeProfile.prompts.systemPrompt;
                    }
                    
                    console.log('Using profile prompt:', basePrompt.substring(0, 100) + '...');
                    
                    return `${basePrompt}

Response format should be JSON with:
{
  "message": "Main explanation or narration",
  "suggestions": ["Optional array of suggestions"],
  "warnings": ["Optional array of warnings"],
  "codeSnippets": [{"language": "js", "code": "example"}],
  "type": "narration|warning|suggestion|explanation"
}`;
                }
            } catch (error) {
                console.error('Error getting active profile:', error);
            }
        }

        // Fallback to default prompt if no profile manager
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

    private buildPrompt(message: MentorMessage): string {
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

    private parseResponse(content: string, messageType: string): MentorResponse {
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
        } catch {
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

    private inferResponseType(messageType: string): 'narration' | 'warning' | 'suggestion' | 'explanation' {
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
