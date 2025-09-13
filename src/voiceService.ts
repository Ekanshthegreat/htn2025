import * as vscode from 'vscode';

export interface VoiceConfig {
    enabled: boolean;
    speed: number;
    voice: string;
    autoNarrate: boolean;
    multiModalMode: boolean;
    conversationalDebugging: boolean;
}

export interface VoiceCommand {
    command: string;
    parameters?: any;
    confidence: number;
}

export class VoiceService {
    private vapi: any = null;
    private isInitialized = false;
    private currentNarration: string = '';
    private isListening = false;
    private conversationHistory: Array<{role: string, content: string}> = [];
    private currentCall: any = null;

    constructor() {
        this.initializeVAPI();
    }

    private async initializeVAPI() {
        try {
            // Dynamic import for VAPI
            const { default: Vapi } = await import('@vapi-ai/web');
            
            const config = vscode.workspace.getConfiguration('aiMentor');
            const vapiKey = config.get<string>('vapiApiKey');

            if (!vapiKey) {
                console.log('VAPI API key not configured');
                return;
            }

            this.vapi = new Vapi(vapiKey);
            this.isInitialized = true;
            
            // Set up event listeners
            this.vapi.on('call-start', () => {
                console.log('Voice narration started');
            });

            this.vapi.on('call-end', () => {
                console.log('Voice narration ended');
            });

            this.vapi.on('speech-start', () => {
                console.log('AI started speaking');
            });

            this.vapi.on('speech-end', () => {
                console.log('AI finished speaking');
            });

        } catch (error) {
            console.error('Failed to initialize VAPI:', error);
        }
    }

    async narrateCodeFlow(message: string, type: 'explanation' | 'warning' | 'suggestion' = 'explanation'): Promise<void> {
        if (!this.isInitialized || !this.vapi) {
            // Fallback to browser speech synthesis
            return this.fallbackNarration(message);
        }

        try {
            const voicePrompt = this.formatForVoice(message, type);
            
            await this.vapi.start({
                model: {
                    provider: 'openai',
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an AI programming mentor providing voice narration. 
                            Speak in a clear, friendly, and educational tone. 
                            Explain code concepts as if you're sitting next to a developer, 
                            helping them understand their code step by step.
                            Keep explanations concise but thorough.
                            Use natural speech patterns and avoid reading code verbatim.`
                        },
                        {
                            role: 'user',
                            content: voicePrompt
                        }
                    ]
                },
                voice: {
                    provider: 'playht',
                    voiceId: 'jennifer'
                }
            });

        } catch (error) {
            console.error('VAPI narration failed:', error);
            // Fallback to browser speech synthesis
            this.fallbackNarration(message);
        }
    }

    private formatForVoice(message: string, type: string): string {
        const prefix = {
            'explanation': 'Let me explain what\'s happening in your code: ',
            'warning': 'I notice a potential issue: ',
            'suggestion': 'Here\'s a suggestion for improvement: '
        }[type] || 'Here\'s what I found: ';

        // Clean up the message for voice
        const cleanMessage = message
            .replace(/```[\s\S]*?```/g, '[code block]') // Replace code blocks
            .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
            .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
            .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
            .replace(/#{1,6}\s/g, '') // Remove markdown headers
            .replace(/\n+/g, '. ') // Replace newlines with periods
            .trim();

        return prefix + cleanMessage;
    }

    private fallbackNarration(message: string): void {
        // Fallback narration for environments without VAPI
        const config = vscode.workspace.getConfiguration('aiMentor');
        const enabled = config.get<boolean>('enableVoiceNarration', false);
        
        if (!enabled) return;

        // Log the message for debugging in extension environment
        console.log('Voice narration (fallback):', this.formatForVoice(message, 'explanation'));
        
        // Show as information message in VS Code
        vscode.window.showInformationMessage(`🎤 AI Mentor: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
    }

    async narrateExecutionTrace(executionSteps: string[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const enabled = config.get<boolean>('enableVoiceNarration', false);
        
        if (!enabled) return;

        for (let i = 0; i < executionSteps.length; i++) {
            const step = executionSteps[i];
            const narration = `Step ${i + 1}: ${step}`;
            
            await this.narrateCodeFlow(narration, 'explanation');
            
            // Add a small delay between steps
            await new Promise(resolve => setTimeout(resolve, 1500));
        }
    }

    async narrateDebuggingSession(breakpoints: string[], variables: string[]): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const enabled = config.get<boolean>('enableVoiceNarration', false);
        
        if (!enabled) return;

        let narration = "Let's start debugging. ";
        
        if (breakpoints.length > 0) {
            narration += `I recommend setting breakpoints at: ${breakpoints.join(', ')}. `;
        }
        
        if (variables.length > 0) {
            narration += `Keep an eye on these variables: ${variables.join(', ')}. `;
        }
        
        narration += "I'll guide you through each step.";
        
        await this.narrateCodeFlow(narration, 'explanation');
    }

    // Advanced VAPI Features for Prize Competition
    async startConversationalDebugging(): Promise<void> {
        if (!this.isInitialized || !this.vapi) {
            vscode.window.showErrorMessage('VAPI not initialized. Please configure your VAPI API key.');
            return;
        }

        try {
            this.currentCall = await this.vapi.start({
                model: {
                    provider: 'google',
                    model: 'gemini-pro',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert AI programming mentor with voice capabilities powered by Google Gemini. 
                            You can see the user's code and help them debug interactively through voice conversation.
                            
                            Key capabilities:
                            - Analyze code structure and identify bugs using Gemini's advanced reasoning
                            - Explain complex concepts in simple terms with Gemini's natural language understanding
                            - Guide step-by-step debugging sessions with contextual awareness
                            - Suggest best practices and optimizations based on modern development patterns
                            - Respond to voice commands like "explain this function" or "find the bug"
                            
                            Be conversational, encouraging, and educational. Ask clarifying questions when needed.
                            Keep responses concise but thorough for voice delivery.
                            Leverage Gemini's multimodal capabilities for comprehensive code analysis.`
                        }
                    ]
                },
                voice: {
                    provider: 'playht',
                    voiceId: 'jennifer'
                },
                functions: [
                    {
                        name: 'analyze_code',
                        description: 'Analyze code for bugs, performance issues, and improvements',
                        parameters: {
                            type: 'object',
                            properties: {
                                code: { type: 'string', description: 'The code to analyze' },
                                focus: { type: 'string', description: 'Specific area to focus on (bugs, performance, style, etc.)' }
                            },
                            required: ['code']
                        }
                    },
                    {
                        name: 'explain_concept',
                        description: 'Explain programming concepts or code patterns',
                        parameters: {
                            type: 'object',
                            properties: {
                                concept: { type: 'string', description: 'The concept or code pattern to explain' },
                                level: { type: 'string', description: 'Explanation level (beginner, intermediate, advanced)' }
                            },
                            required: ['concept']
                        }
                    },
                    {
                        name: 'suggest_fix',
                        description: 'Suggest specific code fixes or improvements',
                        parameters: {
                            type: 'object',
                            properties: {
                                issue: { type: 'string', description: 'The issue to fix' },
                                code_context: { type: 'string', description: 'Surrounding code context' }
                            },
                            required: ['issue']
                        }
                    }
                ]
            });

            this.isListening = true;
            vscode.window.showInformationMessage('🎤 Conversational debugging started! You can now talk to your AI mentor.');

        } catch (error) {
            console.error('Failed to start conversational debugging:', error);
            vscode.window.showErrorMessage('Failed to start voice conversation. Check your VAPI configuration.');
        }
    }

    async startMultiModalAgent(): Promise<void> {
        if (!this.isInitialized || !this.vapi) {
            vscode.window.showErrorMessage('VAPI not initialized. Please configure your VAPI API key.');
            return;
        }

        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage('No active editor found. Please open a code file.');
            return;
        }

        const code = activeEditor.document.getText();
        const language = activeEditor.document.languageId;

        try {
            this.currentCall = await this.vapi.start({
                model: {
                    provider: 'openai',
                    model: 'gpt-4-vision-preview',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a multi-modal AI programming mentor that can:
                            1. Analyze code through voice conversation
                            2. Understand visual code patterns and structure
                            3. Provide real-time feedback on coding practices
                            4. Guide collaborative debugging sessions
                            
                            Current context:
                            - Language: ${language}
                            - Code length: ${code.length} characters
                            
                            You can process both voice input and code context simultaneously.
                            Provide guidance that combines visual code analysis with conversational interaction.`
                        },
                        {
                            role: 'user',
                            content: `Here's my current code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nI'd like to start a multi-modal debugging session. Please analyze my code and let me know what we should focus on.`
                        }
                    ]
                },
                voice: {
                    provider: 'playht',
                    voiceId: 'jennifer'
                }
            });

            this.isListening = true;
            vscode.window.showInformationMessage('🤖 Multi-modal AI agent activated! I can see your code and hear your voice.');

        } catch (error) {
            console.error('Failed to start multi-modal agent:', error);
            vscode.window.showErrorMessage('Failed to start multi-modal agent. Check your VAPI configuration.');
        }
    }

    async processVoiceCommand(command: string): Promise<VoiceCommand | null> {
        if (!this.isListening || !this.currentCall) {
            return null;
        }

        // Parse common voice commands
        const lowerCommand = command.toLowerCase();
        
        if (lowerCommand.includes('explain') && lowerCommand.includes('function')) {
            return { command: 'explain_function', confidence: 0.9 };
        } else if (lowerCommand.includes('find') && lowerCommand.includes('bug')) {
            return { command: 'find_bug', confidence: 0.9 };
        } else if (lowerCommand.includes('optimize') || lowerCommand.includes('improve')) {
            return { command: 'optimize_code', confidence: 0.8 };
        } else if (lowerCommand.includes('test') && lowerCommand.includes('this')) {
            return { command: 'suggest_tests', confidence: 0.8 };
        } else if (lowerCommand.includes('refactor')) {
            return { command: 'refactor_code', confidence: 0.8 };
        }

        return { command: 'general_query', parameters: { query: command }, confidence: 0.6 };
    }

    stopNarration(): void {
        if (this.vapi && this.isInitialized && this.currentCall) {
            this.vapi.stop();
            this.currentCall = null;
        }
        
        this.isListening = false;
        console.log('Voice narration stopped');
    }

    isVoiceEnabled(): boolean {
        const config = vscode.workspace.getConfiguration('aiMentor');
        return config.get<boolean>('enableVoiceNarration', false);
    }

    isConversationalMode(): boolean {
        return this.isListening && this.currentCall !== null;
    }

    async toggleVoice(): Promise<void> {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const currentState = config.get<boolean>('enableVoiceNarration', false);
        
        await config.update('enableVoiceNarration', !currentState, vscode.ConfigurationTarget.Global);
        
        const newState = !currentState;
        vscode.window.showInformationMessage(
            `Voice narration ${newState ? 'enabled' : 'disabled'}`
        );
        
        if (newState) {
            await this.narrateCodeFlow("Voice narration is now enabled. I'll help guide you through your code.", 'explanation');
        }
    }

    async toggleConversationalMode(): Promise<void> {
        if (this.isListening) {
            this.stopNarration();
            vscode.window.showInformationMessage('🔇 Conversational mode disabled');
        } else {
            await this.startConversationalDebugging();
        }
    }
}
