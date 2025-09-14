import * as vscode from 'vscode';
import OpenAI from 'openai';
import { GeminiService } from './geminiService';
import { ProfileManager, MentorProfile } from './profileManager';

export interface MentorMessage {
    type: 'code_changed' | 'cursor_moved' | 'file_created' | 'start_debugging' | 'trace_execution' | 'code_analysis';
    fileName?: string;
    language?: string;
    code?: string;
    content?: string;
    diff?: any;
    analysis?: any;
    previousContent?: string;
    currentContent?: string;
    position?: { line: number; character: number };
    currentLine?: string;
    context?: string;
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
    private geminiService: GeminiService | null = null;
    private conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    private profileManager?: any;
    
    // Rate limiting properties
    private lastRequestTime: number = 0;
    private requestQueue: Array<{ message: MentorMessage; resolve: (value: MentorResponse | null) => void; reject: (error: any) => void }> = [];
    private isProcessingQueue: boolean = false;
    private requestCount: number = 0;
    private requestWindowStart: number = 0;
    private readonly MAX_REQUESTS_PER_MINUTE = 10;
    private readonly MIN_REQUEST_INTERVAL = 6000; // 6 seconds between requests
    private readonly CONTEXT_WINDOW_LIMIT = 8000; // Conservative token limit

    constructor(profileManager?: any) {
        this.profileManager = profileManager;
        this.initializeProvider();
    }

    private initializeProvider() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get<string>('llmProvider', 'gemini');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            vscode.window.showWarningMessage('AI Mentor: Please set your API key in settings');
            return;
        }

        switch (provider) {
            case 'openai':
                this.openai = new OpenAI({ apiKey });
                break;
            case 'gemini':
                this.geminiService = new GeminiService();
                break;
            // Add other providers as needed
        }
    }

    async sendMessage(message: MentorMessage): Promise<MentorResponse | null> {
        const requestId = Math.random().toString(36).substr(2, 9);
        const startTime = Date.now();
        
        console.log(`[LLM-${requestId}] 🚀 Starting LLM request for ${message.type}`);
        console.log(`[LLM-${requestId}] 📋 Message details:`, {
            type: message.type,
            fileName: message.fileName,
            language: message.language,
            contentLength: message.code?.length || message.currentContent?.length || message.content?.length || 0,
            hasAnalysis: !!message.analysis
        });
        
        const config = vscode.workspace.getConfiguration('aiMentor');
        const provider = config.get<string>('llmProvider', 'gemini');
        
        try {
            let response: MentorResponse | null = null;
            
            console.log(`[LLM-${requestId}] 🔄 Using provider: ${provider}`);
            
            switch (provider) {
                case 'openai':
                    console.log(`[LLM-${requestId}] 🤖 Sending to OpenAI with rate limiting...`);
                    response = await this.sendOpenAIMessageWithRateLimit(message);
                    break;
                case 'gemini':
                    console.log(`[LLM-${requestId}] 🔮 Sending to Gemini service...`);
                    if (this.geminiService) {
                        const geminiStartTime = Date.now();
                        response = await this.geminiService.sendMessage(message);
                        const geminiDuration = Date.now() - geminiStartTime;
                        console.log(`[LLM-${requestId}] ✅ Gemini response received in ${geminiDuration}ms`);
                    } else {
                        console.warn(`[LLM-${requestId}] ⚠️ Gemini service not initialized`);
                    }
                    break;
                default:
                    console.warn(`[LLM-${requestId}] ⚠️ Unknown provider: ${provider}`);
            }
            
            const totalDuration = Date.now() - startTime;
            
            if (response) {
                console.log(`[LLM-${requestId}] ✅ LLM request completed successfully in ${totalDuration}ms`);
                console.log(`[LLM-${requestId}] 📊 Response summary:`, {
                    messageLength: response.message?.length || 0,
                    suggestionsCount: response.suggestions?.length || 0,
                    warningsCount: response.warnings?.length || 0,
                    codeSnippetsCount: response.codeSnippets?.length || 0,
                    type: response.type,
                    confidence: response.confidence
                });
            } else {
                console.warn(`[LLM-${requestId}] ⚠️ LLM request completed but returned null response in ${totalDuration}ms`);
            }
            
            return response;
        } catch (error) {
            const totalDuration = Date.now() - startTime;
            console.error(`[LLM-${requestId}] ❌ LLM request failed after ${totalDuration}ms:`, error);
            console.error(`[LLM-${requestId}] 📋 Error details:`, {
                name: error instanceof Error ? error.name : 'Unknown',
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                provider: provider
            });
            
            // Re-throw the error to be handled by the calling code
            throw error;
        }
    }
    
    private async sendOpenAIMessageWithRateLimit(message: MentorMessage): Promise<MentorResponse | null> {
        return new Promise((resolve, reject) => {
            // Add to queue
            this.requestQueue.push({ message, resolve, reject });
            
            // Process queue if not already processing
            if (!this.isProcessingQueue) {
                this.processRequestQueue();
            }
        });
    }
    
    private async processRequestQueue(): Promise<void> {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        while (this.requestQueue.length > 0) {
            // Check rate limits
            const now = Date.now();
            
            // Reset request count if window expired (1 minute)
            if (now - this.requestWindowStart > 60000) {
                this.requestCount = 0;
                this.requestWindowStart = now;
            }
            
            // Check if we've exceeded requests per minute
            if (this.requestCount >= this.MAX_REQUESTS_PER_MINUTE) {
                const waitTime = 60000 - (now - this.requestWindowStart);
                console.log(`Rate limit reached, waiting ${waitTime}ms`);
                await this.sleep(waitTime);
                continue;
            }
            
            // Check minimum interval between requests
            const timeSinceLastRequest = now - this.lastRequestTime;
            if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
                const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
                console.log(`Throttling request, waiting ${waitTime}ms`);
                await this.sleep(waitTime);
            }
            
            // Process next request
            const { message, resolve, reject } = this.requestQueue.shift()!;
            
            try {
                const response = await this.sendOpenAIMessage(message);
                this.requestCount++;
                this.lastRequestTime = Date.now();
                resolve(response);
            } catch (error) {
                // Implement exponential backoff for rate limit errors
                if (this.isRateLimitError(error)) {
                    console.log('Rate limit error detected, implementing backoff');
                    const backoffTime = Math.min(30000, 1000 * Math.pow(2, this.requestCount % 5)); // Max 30s
                    await this.sleep(backoffTime);
                    // Re-queue the request
                    this.requestQueue.unshift({ message, resolve, reject });
                } else {
                    reject(error);
                }
            }
        }
        
        this.isProcessingQueue = false;
    }
    
    private isRateLimitError(error: any): boolean {
        return error?.status === 429 || error?.code === 'rate_limit_exceeded';
    }
    
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    private async sendOpenAIMessage(message: MentorMessage): Promise<MentorResponse | null> {
        if (!this.openai) {
            return null;
        }

        try {
            const prompt = this.buildPrompt(message);
            
            const response = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: this.buildContextAwareMessages(message, prompt),
                max_tokens: 800, // Reduced to stay within limits
                temperature: 0.7
            });

            const content = response.choices[0]?.message?.content;
            if (!content) return null;

            // Add to conversation history
            this.conversationHistory.push(
                { role: 'user', content: prompt },
                { role: 'assistant', content: content }
            );

            // Keep history manageable - more aggressive trimming
            if (this.conversationHistory.length > 10) {
                this.conversationHistory = this.conversationHistory.slice(-10);
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
                console.log('Profile prompts available:', !!activeProfile?.prompts);
                
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
                    
                    console.log('Using profile prompt for', activeProfile.name, ':', basePrompt.substring(0, 100) + '...');
                    
                    // Use the mentor's name for responses
                    const mentorName = activeProfile.name || 'AI Mentor';
                    
                    return `${basePrompt}

CRITICAL: You MUST respond in character as ${mentorName}. Never break character.

Response format should be JSON with:
{
  "message": "${mentorName}: [Your response in character]",
  "suggestions": ["Optional array of suggestions"],
  "warnings": ["Optional array of warnings"],
  "codeSnippets": [{"language": "js", "code": "example"}],
  "type": "narration|warning|suggestion|explanation"
}`;
                } else {
                    console.log('No prompts found for active profile:', activeProfile?.name);
                }
            } catch (error) {
                console.error('Error getting active profile:', error);
            }
        } else {
            console.log('No profile manager available');
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

            case 'code_analysis':
                return `Please analyze this ${message.language} code from ${message.fileName}:

\`\`\`${message.language}
${message.code || message.currentContent}
\`\`\`

Analysis data: ${JSON.stringify(message.analysis, null, 2)}

Provide a comprehensive code analysis including potential issues, suggestions for improvement, code quality assessment, and any best practices recommendations.`;

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

    private buildContextAwareMessages(message: MentorMessage, prompt: string): any[] {
        const systemPrompt = this.getSystemPrompt(message.type);
        const messages = [
            {
                role: 'system',
                content: systemPrompt
            }
        ];
        
        // Calculate approximate token count (rough estimate: 1 token ≈ 4 characters)
        let tokenCount = Math.ceil(systemPrompt.length / 4) + Math.ceil(prompt.length / 4);
        
        // Add conversation history while staying under context limit
        const relevantHistory = [];
        for (let i = this.conversationHistory.length - 1; i >= 0; i--) {
            const historyItem = this.conversationHistory[i];
            const historyTokens = Math.ceil(historyItem.content.length / 4);
            
            if (tokenCount + historyTokens > this.CONTEXT_WINDOW_LIMIT) {
                break;
            }
            
            relevantHistory.unshift(historyItem);
            tokenCount += historyTokens;
        }
        
        messages.push(...relevantHistory);
        messages.push({
            role: 'user',
            content: prompt
        });
        
        return messages;
    }
    
    private truncateContent(content: string, maxLength: number = 2000): string {
        if (content.length <= maxLength) {
            return content;
        }
        
        return content.substring(0, maxLength) + '\n\n[Content truncated to stay within context limits]';
    }
    
    clearHistory() {
        this.conversationHistory = [];
        this.requestQueue = [];
        this.requestCount = 0;
        this.requestWindowStart = 0;
    }
}
