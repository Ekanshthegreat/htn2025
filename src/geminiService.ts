import { GoogleGenerativeAI } from '@google/generative-ai';
import * as vscode from 'vscode';
import { MentorMessage, MentorResponse } from './llmService';

export class GeminiService {
    private genAI: GoogleGenerativeAI | null = null;
    private model: any = null;
    private conversationHistory: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

    constructor() {
        this.initializeGemini();
    }

    private initializeGemini() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const apiKey = config.get<string>('apiKey');

        if (!apiKey) {
            vscode.window.showWarningMessage('AI Mentor: Please set your Gemini API key in settings');
            return;
        }

        try {
            this.genAI = new GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ 
                model: 'gemini-2.5-pro',
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });
        } catch (error) {
            console.error('Failed to initialize Gemini:', error);
            vscode.window.showErrorMessage('Failed to initialize Gemini API');
        }
    }

    async sendMessage(message: MentorMessage): Promise<MentorResponse | null> {
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

            if (!content) return null;

            // Add to conversation history
            this.conversationHistory.push(
                { role: 'user', parts: [{ text: prompt }] },
                { role: 'model', parts: [{ text: content }] }
            );

            // Keep history manageable
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            return this.parseAdvancedResponse(content, message.type);
        } catch (error) {
            console.error('Gemini Service error:', error);
            vscode.window.showErrorMessage(`AI Mentor error: ${error}`);
            return null;
        }
    }

    async generateMentorPrompts(
        username: string,
        userProfile: any,
        analysis: any,
        topRepositories: any[]
    ): Promise<{ systemPrompt: string; reviewPrompt: string; debuggingPrompt: string; explanationPrompt: string } | null> {
        if (!this.model) {
            return null;
        }

        try {
            const prompt = `You are an expert AI prompt engineer creating authentic mentor personalities based on GitHub profiles.

Analyze this comprehensive GitHub data for ${username}:

**User Profile:**
${JSON.stringify(userProfile, null, 2)}

**Personality Analysis:**
${JSON.stringify(analysis.personality, null, 2)}

**Technical Expertise:**
${JSON.stringify(analysis.expertise, null, 2)}

**Code Style Preferences:**
${JSON.stringify(analysis.codeStylePreferences, null, 2)}

**Communication Patterns:**
${JSON.stringify(analysis.communicationPatterns, null, 2)}

**Top Repositories:**
${JSON.stringify(topRepositories, null, 2)}

Create 4 distinct, authentic prompts that capture ${username}'s unique coding personality and expertise. Make them feel like the real person is mentoring.

For notable developers like 'torvalds', 'gvanrossum', 'tj', 'sindresorhus', etc., incorporate their known public personas and philosophies.

Each prompt should be detailed and authentic, reflecting the developer's actual communication style, technical focus areas, and expertise based on the analysis.

Return JSON in this exact format:
{
  "systemPrompt": "You are [name/persona]. [Authentic personality description based on analysis]. Your expertise includes [specific technologies]. You focus on [specific areas]. Provide [response style] responses that reflect your authentic coding philosophy.",
  "reviewPrompt": "Review this code as [name] would, focusing on [specific focus areas from analysis]. Consider your known standards for [relevant areas]. Provide [communication style] feedback in your characteristic manner.",
  "debuggingPrompt": "Help debug this issue using [name]'s systematic approach. Focus on [technical patterns from analysis] and apply your problem-solving methodology.",
  "explanationPrompt": "Explain this code as [name] would, using your [communication style] with [response length] explanations. Draw from your experience with [expertise areas]."
}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            if (!content) return null;

            try {
                const customPrompts = JSON.parse(content);
                
                // Validate the response has required fields
                if (customPrompts.systemPrompt && customPrompts.reviewPrompt && 
                    customPrompts.debuggingPrompt && customPrompts.explanationPrompt) {
                    console.log(`Generated structured prompts for ${username}:`, customPrompts);
                    return customPrompts;
                }
            } catch (parseError) {
                console.warn('Failed to parse Gemini prompt response:', parseError);
            }

            return null;
        } catch (error) {
            console.error('Gemini prompt generation error:', error);
            return null;
        }
    }

    private buildAdvancedPrompt(message: MentorMessage): string {
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

    private parseAdvancedResponse(content: string, messageType: string): MentorResponse {
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
        } catch {
            return {
                message: content,
                suggestions: [],
                warnings: [],
                codeSnippets: [],
                type: this.inferResponseType(messageType)
            };
        }
    }

    private inferResponseType(messageType: string): 'narration' | 'warning' | 'suggestion' | 'explanation' | 'insight' {
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
