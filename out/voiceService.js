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
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceService = void 0;
const vscode = __importStar(require("vscode"));
const http = __importStar(require("http"));
class VoiceService {
    constructor() {
        this.vapi = null;
        this.isInitialized = false;
        this.currentNarration = '';
        this.isListening = false;
        this.conversationHistory = [];
        this.currentCall = null;
        this.aiMentorProvider = null;
        this.server = null;
        this.serverPort = 3001;
        this.initializeExternalVAPI();
    }
    async initializeExternalVAPI() {
        try {
            this.startExternalServer();
            this.isInitialized = true;
            console.log('External VAPI server initialized successfully');
        }
        catch (error) {
            console.error('Error initializing external VAPI server:', error);
        }
    }
    startExternalServer() {
        const fs = require('fs');
        const path = require('path');
        this.server = http.createServer((req, res) => {
            if (req.url === '/') {
                const htmlContent = this.generateVAPIHTML();
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(htmlContent);
            }
            else if (req.url === '/api/transcript' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (this.aiMentorProvider) {
                            this.aiMentorProvider.addTranscript(data.transcript, data.role);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (error) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            }
            else if (req.url === '/api/status' && req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        if (this.aiMentorProvider) {
                            this.aiMentorProvider.handleVapiConnectionStatus(data.status, data.message);
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true }));
                    }
                    catch (error) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Invalid JSON' }));
                    }
                });
            }
            else {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('Not Found');
            }
        });
        this.server.listen(this.serverPort, () => {
            console.log(`External VAPI server running on http://localhost:${this.serverPort}`);
        });
    }
    generateVAPIHTML() {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const vapiPublicKey = config.get('vapiPublicKey') || 'default-key';
        const assistantId = config.get('vapiAssistantId') || 'default-assistant-id';
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Mentor Voice Interface</title>
    <style>
        body {
            font-family: 'Courier New', monospace;
            margin: 0;
            padding: 20px;
            background: #000;
            color: #fff;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: #111;
            border: 2px solid #333;
            border-radius: 8px;
            padding: 30px;
            text-align: center;
            max-width: 500px;
            width: 100%;
        }
        h1 {
            margin-bottom: 20px;
            font-size: 1.8em;
            font-weight: normal;
            color: #fff;
        }
        .voice-button {
            background: #fff;
            border: 2px solid #333;
            border-radius: 4px;
            color: #000;
            padding: 15px 30px;
            font-size: 16px;
            font-family: 'Courier New', monospace;
            cursor: pointer;
            margin: 10px;
            min-width: 150px;
            transition: all 0.2s ease;
        }
        .voice-button:hover {
            background: #f0f0f0;
        }
        .voice-button:disabled {
            background: #333;
            color: #666;
            cursor: not-allowed;
        }
        .status {
            margin: 20px 0;
            padding: 15px;
            border: 1px solid #333;
            background: #111;
            font-size: 14px;
            font-family: 'Courier New', monospace;
        }
        .terminal-output {
            background: #111;
            padding: 15px;
            border-radius: 4px;
            margin: 10px 0;
            min-height: 100px;
            max-height: 150px;
            overflow-y: auto;
            font-family: 'Courier New', monospace;
            color: #0f0;
        }
        .transcript-message {
            margin-bottom: 15px;
            padding: 10px;
            background: #1a1a1a;
            border-radius: 4px;
            border-left: 3px solid #4CAF50;
        }
        .transcript-message.user {
            border-left-color: #2196F3;
        }
        .transcript-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
            font-size: 0.9em;
            color: #888;
        }
        .transcript-role {
            font-weight: bold;
            color: #4CAF50;
        }
        .transcript-message.user .transcript-role {
            color: #2196F3;
        }
        .transcript-time {
            color: #666;
            font-size: 0.85em;
        }
        .transcript-text {
            color: #fff;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .transcript-item {
            margin: 8px 0;
            padding: 8px;
            border-left: 3px solid #333;
        }
        .user { border-left-color: #fff; }
        .assistant { border-left-color: #666; }
        .instructions {
            margin: 15px 0;
            padding: 15px;
            border: 1px solid #333;
            background: #111;
            font-size: 13px;
            text-align: left;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎤 AI Mentor Voice Interface</h1>
        <p>Voice-powered debugging assistance outside VSCode constraints</p>
        
        <div class="instructions">
            <strong>Instructions:</strong><br>
            1. Click "Start Voice Chat" below<br>
            2. Allow microphone access when prompted<br>
            3. Speak naturally to your AI Debugging Mentor<br>
            4. View transcripts in real-time below
        </div>
        
        <button id="startBtn" class="voice-button">🎤 Start Voice Chat</button>
        <button id="stopBtn" class="voice-button" disabled>⏹ Stop Voice Chat</button>
        
        <div id="status" class="status">Ready to connect...</div>
        <div id="transcript" class="terminal-output">
            <div class="line">Live transcription will appear here...</div>
        </div>
        <div id="transcript-container" style="margin-top: 20px; border-top: 1px solid #333; padding: 15px; max-height: 300px; overflow-y: auto;">
            <h3 style="margin-top: 0; color: #fff;">Conversation History</h3>
            <div id="transcript-messages" style="font-family: 'Courier New', monospace; color: #fff;">
                <!-- Transcript messages will be added here -->
            </div>
        </div>
        <div id="transcript-display" style="margin-top: 20px; border-top: 1px solid #333; padding-top: 10px;">
            <h3>Live Transcript</h3>
            <div id="transcript-content" style="min-height: 100px; max-height: 300px; overflow-y: auto; background: #111; padding: 10px; border-radius: 4px; font-family: 'Courier New', monospace; white-space: pre-wrap;"></div>
        </div>
    </div>

    <script>
        // Load VAPI SDK with correct CDN URLs
        async function loadVAPISDK() {
            const cdnUrls = [
                'https://unpkg.com/@vapi-ai/web@latest/dist/index.umd.js',
                'https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/dist/index.umd.js',
                'https://cdn.jsdelivr.net/gh/VapiAI/html-script-tag@latest/dist/assets/index.js'
            ];
            
            for (const url of cdnUrls) {
                try {
                    console.log('Attempting to load VAPI SDK from:', url);
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = url;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                    
                    // Wait a bit for async loading
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Check if VAPI is available (different ways depending on CDN)
                    if (typeof window.Vapi !== 'undefined') {
                        console.log('VAPI SDK (window.Vapi) loaded successfully from:', url);
                        return true;
                    } else if (typeof Vapi !== 'undefined') {
                        console.log('VAPI SDK (Vapi) loaded successfully from:', url);
                        return true;
                    } else if (typeof window.vapiSDK !== 'undefined') {
                        console.log('VAPI SDK (vapiSDK) loaded successfully from:', url);
                        window.Vapi = window.vapiSDK.default || window.vapiSDK.Vapi || window.vapiSDK;
                        return true;
                    }
                    
                    // Check for UMD module pattern
                    if (typeof window.VapiWeb !== 'undefined') {
                        console.log('VAPI SDK (VapiWeb) loaded successfully from:', url);
                        window.Vapi = window.VapiWeb.default || window.VapiWeb;
                        return true;
                    }
                } catch (error) {
                    console.warn('Failed to load VAPI SDK from:', url, error);
                }
            }
            
            console.error('Failed to load VAPI SDK from all CDN sources');
            return false;
        }
    </script>
    <script>
        let vapi = null;
        let isConnected = false;
        
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const status = document.getElementById('status');
        const transcript = document.getElementById('transcript');
        
        const vapiPublicKey = '365fc87d-f1cb-46a1-9e20-be85b18aab41';
        const assistantId = '${assistantId}';
        
        function updateStatus(message: string, isError: boolean = false): void {
            if (!status) {
                console.warn('Status element not found');
                return;
            }

            status.textContent = message;
            status.style.background = isError ? 'rgba(244, 67, 54, 0.3)' : 'rgba(76, 175, 80, 0.3)';
            
            // Send status to VSCode extension
            const sendStatus = async (): Promise<void> => {
                try {
                    const response = await fetch('/api/status', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            status: isError ? 'error' : 'info', 
                            message: message 
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error(`;
        HTTP;
        error;
        status: $;
        {
            response.status;
        }
        `);
                    }
                    
                    const data: unknown = await response.json();
                    console.debug('Status update sent:', data);
                } catch (error: unknown) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error('Failed to send status update:', errorMessage);
                }
            };
            
            void sendStatus();
        }
        
        // VAPI Client Types
        interface VAPIClient {
            on: (event: string, callback: (data: any) => void) => void;
            start: (assistantId?: string) => Promise<void>;
            stop: () => Promise<void>;
            isMuted: boolean;
            isSpeaking: boolean;
            assistantId?: string;
            publicKey?: string;
        }

        interface VAPIConfig {
            publicKey: string;
            assistantId?: string;
            onMessage?: (message: string) => void;
            onError?: (error: Error) => void;
            onCallStart?: () => void;
            onCallEnd?: () => void;
        }

        // Global type declarations
        declare global {
            interface Window {
                Vapi?: new (config: VAPIConfig) => VAPIClient;
                vapi?: VAPIClient;
                vapiSDK?: any;
                vapiInstance?: VAPIClient;
                startVapiCall?: () => Promise<void>;
                stopVapiCall?: () => Promise<void>;
            }

            interface Document {
                getElementById(elementId: string): HTMLElement | null;
                addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
            }

            interface HTMLElement {
                addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
                removeEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => void;
                disabled: boolean;
                textContent: string | null;
                style: CSSStyleDeclaration;
                innerHTML: string;
                appendChild: <T extends Node>(node: T) => T;
                scrollTop: number;
                scrollHeight: number;
            }

            interface HTMLButtonElement extends HTMLElement {
                disabled: boolean;
                addEventListener: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
            }

            const document: Document;
            const fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
            const console: Console;
        }

        // VAPI Type Declarations
        interface VAPIClient {
            start: (config?: VAPIConfig) => Promise<void>;
            stop: () => Promise<void>;
            on: (event: string, callback: (data: any) => void) => void;
            isConnected: boolean;
        }

        interface VAPIConfig {
            assistantId?: string;
            publicKey?: string;
            // Add other VAPI config properties as needed
        }

        // Extend Window interface to include VAPI SDK
        interface Window {
            Vapi?: {
                create: (config: VAPIConfig) => VAPIClient;
            };
            vapiSDK?: any; // More specific type if available
            vapi?: VAPIClient;
            startVapiCall?: () => Promise<void>;
            stopVapiCall?: () => Promise<void>;
        }

        // DOM element references with proper null checks and type assertions
        const status = document.getElementById('status');
        const startBtn = document.getElementById('startBtn') as HTMLButtonElement | null;
        const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement | null;
        const transcriptDiv = document.getElementById('transcript') as HTMLElement | null;
        const transcriptMessages = document.getElementById('transcript-messages') as HTMLElement | null;
        
        if (!status || !startBtn || !stopBtn || !transcriptDiv || !transcriptMessages) {
            console.error('Required DOM elements not found');
            return;
        }
        
        let isConnected = false;
        let vapiInstance: VAPIClient | null = null;

        // Global type declarations
        declare global {
            // VAPI Client Types
            interface VAPIClient {
                on(event: 'call-start' | 'call-end' | 'speech-start' | 'speech-end' | 'transcript', 
                   callback: (data: any) => void): void;
                start(assistantId?: string): Promise<void>;
                stop(): Promise<void>;
            }

            interface VAPIConfig {
                publicKey: string;
                assistantId?: string;
                model?: {
                    provider: 'openai' | 'anthropic' | 'deepgram' | 'assembly' | 'gladia' | 'revai' | 'speechmatics';
                    model: string;
                    voice?: string;
                    language?: string;
                };
                voice?: {
                    provider: '11labs' | 'playht' | 'resemble' | 'deepgram' | 'assembly' | 'murf' | 'wellsaid';
                    voiceId: string;
                };
                transcriber?: {
                    provider: 'deepgram' | 'assembly' | 'gladia' | 'revai' | 'speechmatics';
                    model?: string;
                    language?: string;
                    keywords?: string[];
                };
                firstMessage?: string;
            }

            // Extend Window interface to include VAPI SDK
            interface Window {
                Vapi: {
                    createClient: (config: VAPIConfig) => VAPIClient;
                };
                vapiSDK: any;
                vapi: VAPIClient | null;
                startVapiCall: () => Promise<void>;
                stopVapiCall: () => Promise<void>;
            }

            // DOM Elements
            interface HTMLElementTagNameMap {
                'transcript-container': HTMLDivElement;
                'transcript-messages': HTMLDivElement;
                'status': HTMLDivElement;
                'startBtn': HTMLButtonElement;
                'stopBtn': HTMLButtonElement;
            }
        }

        // Define TranscriptEvent interface
        interface TranscriptEvent {
            text: string;
            role: 'user' | 'assistant' | 'system';
            timestamp: string;
        }

        // Declare DOM elements with proper type assertions and null checks
        const status = document.getElementById('status') as HTMLDivElement;
        const startBtn = document.getElementById('startBtn') as HTMLButtonElement;
        const stopBtn = document.getElementById('stopBtn') as HTMLButtonElement;
        const transcriptDiv = document.getElementById('transcript') as HTMLDivElement;
        const transcriptMessages = document.getElementById('transcript-messages') as HTMLDivElement;
        
        // Add null checks for all DOM elements
        if (!status || !startBtn || !stopBtn || !transcriptDiv || !transcriptMessages) {
            console.error('Required DOM elements not found');
            return;
        }

        // Function to update status in the UI
        function updateStatus(message: string, isError = false): void {
            status.textContent = message;
            status.style.color = isError ? 'red' : 'green';
            console.log(`[Status];
        $;
        {
            message;
        }
        `);

            // Send status to VSCode extension
            fetch('/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message, isError })
            }).catch(error => {
                console.error('Failed to send status to VSCode:', error);
            });
            fetch('/api/status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message, isError })
            }).catch((error: Error) => {
                console.error('Failed to send status to VSCode:', error);
            });
        }

        // Function to safely add transcript messages to the UI and send to VSCode
        function addTranscript(text: string, role: 'user' | 'assistant' | 'system' = 'assistant'): void {
            try {
                if (!transcriptMessages) {
                    console.error('Transcript messages container not found');
                    return;
                }

                const timestamp = new Date().toISOString();
                const event: TranscriptEvent = { 
                    text: text.trim(), 
                    role, 
                    timestamp 
                };
                
                // Add to UI
                const messageElement = document.createElement('div');
                messageElement.className = `;
        message;
        $;
        {
            role;
        }
        `;
                
                const roleElement = document.createElement('div');
                roleElement.className = 'message-role';
                roleElement.textContent = role.toUpperCase();
                
                const textElement = document.createElement('div');
                textElement.className = 'message-text';
                textElement.textContent = event.text;
                
                const timeElement = document.createElement('div');
                timeElement.className = 'message-time';
                timeElement.textContent = new Date(timestamp).toLocaleTimeString();
                
                messageElement.appendChild(roleElement);
                messageElement.appendChild(textElement);
                messageElement.appendChild(timeElement);
                
                transcriptMessages.appendChild(messageElement);
                transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
                
                // Send to VSCode extension
                fetch('/api/transcript', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(event)
                }).catch((error: Error) => {
                    console.error('Failed to send transcript to VSCode:', error);
                });
                
                // If we have a VAPI instance, handle the transcript
                if (vapi) {
                    // Handle transcript with VAPI if needed
                    console.log('Transcript sent to VAPI:', { text, role });
                }
            } catch (error) {
                console.error('Error in addTranscript:', error);
            }
        }
                }

                const { text, role: eventRole = 'assistant' } = event;
                const timestamp = new Date().toISOString();
                
                // Update live transcript display
                if (transcriptDiv) {
                    transcriptDiv.innerHTML = ` < div;
        class {
        }
        "line" > $;
        {
            text;
        }
        /div>`;;
        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
    }
    // Add to conversation history
    if(transcriptMessages) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `transcript-message ${eventRole}`;
        messageDiv.innerHTML = `
                        <div class="transcript-header">
                            <span class="transcript-role">${eventRole === 'user' ? 'You' : 'Mentor'}</span>
                            <span class="transcript-time">${new Date(timestamp).toLocaleTimeString()}</span>
                        </div>
                        <div class="transcript-text">${text}</div>
                    `;
        transcriptMessages.appendChild(messageDiv);
        transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
    }
    // Send transcript to VSCode extension
    fetch(, { method: , 'POST': , headers: { 'Content-Type': , 'application/json': , }, body: JSON, stringify }) { }
}
exports.VoiceService = VoiceService;
({
    text: event.text,
    role: event.role || 'assistant',
    timestamp: new Date().toISOString()
});
try { }
catch (error) { }
{
    console.error('Failed to send transcript to VSCode:', error);
}
;
;
async function requestMicrophonePermission() {
    try {
        updateStatus('Requesting microphone permission...');
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream, we just needed permission
        updateStatus('Microphone permission granted ✓');
        return true;
    }
    catch (error) {
        updateStatus('Microphone permission denied. Please allow microphone access and try again.', true);
        console.error('Microphone permission error:', error);
        return false;
    }
}
async function initializeVAPI() {
    try {
        // First, try to load the VAPI SDK
        updateStatus('Loading VAPI SDK...');
        const sdkLoaded = await loadVAPISDK();
        if (!sdkLoaded || (typeof Vapi === 'undefined' && typeof window.Vapi === 'undefined' && typeof window.vapiSDK === 'undefined')) {
            throw new Error('VAPI SDK failed to load from all CDN sources');
        }
        // Request microphone permission first
        const hasPermission = await requestMicrophonePermission();
        if (!hasPermission) {
            return;
        }
        // Use the appropriate VAPI constructor
        const VapiConstructor = window.Vapi || Vapi;
        if (VapiConstructor && typeof VapiConstructor === 'function') {
            vapi = new VapiConstructor(vapiPublicKey);
            vapi.on('call-start', () => {
                updateStatus('Voice call started');
                isConnected = true;
                startBtn.disabled = true;
                stopBtn.disabled = false;
            });
            vapi.on('call-end', () => {
                updateStatus('Voice call ended');
                isConnected = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
            });
            vapi.on('speech-start', () => {
                updateStatus('Listening...');
            });
            vapi.on('speech-end', () => {
                updateStatus('Processing...');
            });
            vapi.on('message', (event) => {
                if (event.type === 'transcript' && event.transcript) {
                    const transcriptDiv = document.getElementById('transcript');
                    const transcriptMessages = document.getElementById('transcript-messages');
                    // Update live transcript display
                    if (transcriptDiv) {
                        transcriptDiv.innerHTML = `<div class="line">${event.transcript.text}</div>`;
                        transcriptDiv.scrollTop = transcriptDiv.scrollHeight;
                    }
                    // Add to conversation history
                    if (transcriptMessages) {
                        const messageDiv = document.createElement('div');
                        messageDiv.className = `transcript-message ${event.transcript.role || 'assistant'}`;
                        const timestamp = new Date().toLocaleTimeString();
                        messageDiv.innerHTML = `
                                    <div class="transcript-header">
                                        <span class="transcript-role">${event.transcript.role === 'user' ? 'You' : 'Mentor'}</span>
                                        <span class="transcript-time">${timestamp}</span>
                                    </div>
                                    <div class="transcript-text">${event.transcript.text}</div>
                                `;
                        transcriptMessages.appendChild(messageDiv);
                        transcriptMessages.scrollTop = transcriptMessages.scrollHeight;
                    }
                    // Send transcript to VSCode extension
                    fetch('/api/transcript', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            text: event.transcript.text,
                            role: event.transcript.role || 'assistant',
                            timestamp: new Date().toISOString()
                        })
                    }).catch(error => {
                        console.error('Failed to send transcript to VSCode:', error);
                    });
                }
            });
            vapi.on('error', (error) => {
                updateStatus(`Error: ${error.message}`, true);
                console.error('VAPI Error:', error);
            });
        }
        else if (typeof window.vapiSDK !== 'undefined') {
            // For the HTML script tag version, create our own interface
            updateStatus('VAPI widget loaded - Using manual controls');
            // Create a simple start function for the widget
            window.startVapiCall = function () {
                if (window.vapiInstance) {
                    window.vapiInstance.start();
                }
                else {
                    window.vapiInstance = window.vapiSDK.run({
                        apiKey: vapiPublicKey,
                        assistant: assistantId
                    });
                }
                updateStatus('Voice call starting...');
                isConnected = true;
                startBtn.disabled = true;
                stopBtn.disabled = false;
            };
            window.stopVapiCall = function () {
                if (window.vapiInstance) {
                    window.vapiInstance.stop();
                }
                updateStatus('Voice call stopped');
                isConnected = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;
            };
            return; // Skip the regular Vapi initialization
        }
        else {
            throw new Error('No valid VAPI constructor found');
        }
        // This will only run for the regular Vapi constructor
        updateStatus('VAPI initialized successfully - Ready to start voice chat');
        updateStatus(`Failed to start call: \${error.message}\`, true);
                }
            }
        });
        
        stopBtn.addEventListener('click', () => {
            if (window.stopVapiCall) {
                // Use the widget version
                window.stopVapiCall();
            } else if (vapi && isConnected) {
                vapi.stop();
            }
        });
        
        // Initialize on page load - but don't auto-load SDK
        window.addEventListener('load', () => {
            updateStatus('Ready to start voice chat - Click "Start Voice Chat" to begin');
        });
    </script>
</body>
</html>`);
    }
    finally {
    }
    async;
    initializeVAPI();
    {
        const config = vscode.workspace.getConfiguration('aiMentor');
        const vapiPublicKey = config.get('vapiPublicKey');
        if (!vapiPublicKey) {
            console.log('VAPI public key not configured');
            return;
        }
        // VAPI will be initialized in the webview context where browser APIs are available
        this.isInitialized = true;
        console.log('VoiceService initialized - VAPI will run in webview context');
    }
    setAIMentorProvider(provider, any);
    {
        this.aiMentorProvider = provider;
    }
    sendTranscriptToWebview(transcript, string, role, string);
    {
        if (this.aiMentorProvider) {
            this.aiMentorProvider.addTranscript(transcript, role);
        }
        else {
            console.log('Transcript (no webview):', transcript);
        }
    }
    async;
    startConversationWithMentor();
    Promise < boolean > {
        const: config = vscode.workspace.getConfiguration('aiMentor'),
        const: vapiPublicKey = config.get('vapiPublicKey') || '065055a3-2790-44f6-855e-cd528965160f',
        const: assistantId = config.get('vapiAssistantId') || '8026e50f-8bd8-42e6-9f95-6176698aa424',
        if(, vapiPublicKey) { }
    } || !assistantId;
    {
        vscode.window.showErrorMessage('VAPI credentials not configured. Please run "Configure VAPI Settings" command first.', 'Configure Now').then(choice => {
            if (choice === 'Configure Now') {
                vscode.commands.executeCommand('aiMentor.configureVAPI');
            }
        });
        return false;
    }
    if (!this.isInitialized) {
        vscode.window.showErrorMessage('VAPI not initialized. Check console for initialization errors.');
        return false;
    }
    try {
        // Open external VAPI interface in default browser
        const url = `http://localhost:${this.serverPort}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        if (this.aiMentorProvider) {
            this.aiMentorProvider.handleVapiConnectionStatus('info', 'Opening external voice interface...');
        }
        this.isListening = true;
        this.currentCall = true;
        vscode.window.showInformationMessage('🎤 Opening external voice interface in browser...');
        return true;
    }
    catch (error) {
        console.error('Failed to start voice conversation:', error);
        vscode.window.showErrorMessage(`Failed to start voice conversation: ${error}`);
        return false;
    }
}
async;
stopConversation();
Promise < void  > {
    : .isListening
};
{
    try {
        // Send message to webview to stop VAPI connection
        if (this.aiMentorProvider) {
            this.aiMentorProvider.stopVoiceConnection();
        }
        this.isListening = false;
        this.currentCall = null;
        vscode.window.showInformationMessage('🔇 Voice conversation ended.');
    }
    catch (error) {
        console.error('Error stopping conversation:', error);
    }
}
async;
narrateCodeFlow(message, string, type, 'explanation' | 'warning' | 'suggestion', 'explanation');
Promise < void  > {
    : .isInitialized || !this.vapi
};
{
    // Fallback to browser speech synthesis
    return this.fallbackNarration(message);
}
try {
    const voicePrompt = this.formatForVoice(message, type);
    await this.vapi.start({
        model: {
            provider: 'google',
            model: 'gemini-pro',
            messages: [
                {
                    role: 'system',
                    content: `You are an AI programming mentor powered by Google Gemini providing voice narration. 
                            Speak in a clear, friendly, and educational tone using Gemini's natural language capabilities. 
                            Explain code concepts as if you're sitting next to a developer, 
                            helping them understand their code step by step with Gemini's contextual understanding.
                            Keep explanations concise but thorough.
                            Use natural speech patterns and avoid reading code verbatim.
                            Leverage Gemini's advanced reasoning to provide insightful explanations.`
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
}
catch (error) {
    console.error('VAPI narration failed:', error);
    // Fallback to browser speech synthesis
    this.fallbackNarration(message);
}
formatForVoice(message, string, type, string);
string;
{
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
fallbackNarration(message, string);
void {
    // Fallback narration for environments without VAPI
    const: config = vscode.workspace.getConfiguration('aiMentor'),
    const: enabled = config.get('enableVoiceNarration', false),
    if(, enabled) { }, return: ,
    // Log the message for debugging in extension environment
    console, : .log('Voice narration (fallback):', this.formatForVoice(message, 'explanation')),
    // Show as information message in VS Code
    vscode, : .window.showInformationMessage(`🎤 AI Mentor: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`)
};
async;
narrateExecutionTrace(executionSteps, string[]);
Promise < void  > {
    const: config = vscode.workspace.getConfiguration('aiMentor'),
    const: enabled = config.get('enableVoiceNarration', false),
    if(, enabled) { }, return: ,
    for(let, i = 0, i, , executionSteps) { }, : .length, i
}++;
{
    const step = executionSteps[i];
    const narration = `Step ${i + 1}: ${step}`;
    await this.narrateCodeFlow(narration, 'explanation');
    // Add a small delay between steps
    await new Promise(resolve => setTimeout(resolve, 1500));
}
async;
narrateDebuggingSession(breakpoints, string[], variables, string[]);
Promise < void  > {
    const: config = vscode.workspace.getConfiguration('aiMentor'),
    const: enabled = config.get('enableVoiceNarration', false),
    if(, enabled) { }, return: ,
    let, narration = "Let's start debugging. ",
    if(breakpoints) { }, : .length > 0
};
{
    narration += `I recommend setting breakpoints at: ${breakpoints.join(', ')}. `;
}
if (variables.length > 0) {
    narration += `Keep an eye on these variables: ${variables.join(', ')}. `;
}
narration += "I'll guide you through each step.";
await this.narrateCodeFlow(narration, 'explanation');
// Advanced VAPI Features for Prize Competition
async;
startConversationalDebugging();
Promise < void  > {
    : .isInitialized || !this.vapi
};
{
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
}
catch (error) {
    console.error('Failed to start conversational debugging:', error);
    vscode.window.showErrorMessage('Failed to start voice conversation. Check your VAPI configuration.');
}
async;
startMultiModalAgent();
Promise < void  > {
    : .isInitialized || !this.vapi
};
{
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
            provider: 'google',
            model: 'gemini-pro-vision',
            messages: [
                {
                    role: 'system',
                    content: `You are a multi-modal AI programming mentor powered by Google Gemini that can:
                            1. Analyze code through voice conversation using Gemini's advanced reasoning
                            2. Understand visual code patterns and structure with multimodal capabilities
                            3. Provide real-time feedback on coding practices using Gemini's contextual understanding
                            4. Guide collaborative debugging sessions with natural language processing
                            
                            Current context:
                            - Language: ${language}
                            - Code length: ${code.length} characters
                            
                            You can process both voice input and code context simultaneously using Gemini's multimodal capabilities.
                            Provide guidance that combines visual code analysis with conversational interaction.
                            Leverage Gemini's strengths in understanding code patterns and providing contextual explanations.`
                },
                {
                    role: 'user',
                    content: `Here's my current code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nI'd like to start a multi-modal debugging session using Gemini's capabilities. Please analyze my code and let me know what we should focus on.`
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
}
catch (error) {
    console.error('Failed to start multi-modal agent:', error);
    vscode.window.showErrorMessage('Failed to start multi-modal agent. Check your VAPI configuration.');
}
async;
processVoiceCommand(command, string);
Promise < VoiceCommand | null > {
    : .isListening || !this.currentCall
};
{
    return null;
}
// Parse common voice commands
const lowerCommand = command.toLowerCase();
if (lowerCommand.includes('explain') && lowerCommand.includes('function')) {
    return { command: 'explain_function', confidence: 0.9 };
}
else if (lowerCommand.includes('find') && lowerCommand.includes('bug')) {
    return { command: 'find_bug', confidence: 0.9 };
}
else if (lowerCommand.includes('optimize') || lowerCommand.includes('improve')) {
    return { command: 'optimize_code', confidence: 0.8 };
}
else if (lowerCommand.includes('test') && lowerCommand.includes('this')) {
    return { command: 'suggest_tests', confidence: 0.8 };
}
else if (lowerCommand.includes('refactor')) {
    return { command: 'refactor_code', confidence: 0.8 };
}
return { command: 'general_query', parameters: { query: command }, confidence: 0.6 };
stopNarration();
void {
    : .vapi && this.isInitialized && this.currentCall
};
{
    this.vapi.stop();
    this.currentCall = null;
}
this.isListening = false;
console.log('Voice narration stopped');
isVoiceEnabled();
boolean;
{
    const config = vscode.workspace.getConfiguration('aiMentor');
    return config.get('enableVoiceNarration', false);
}
isConversationalMode();
boolean;
{
    return this.isListening && this.currentCall !== null;
}
async;
toggleVoice();
Promise < void  > {
    const: config = vscode.workspace.getConfiguration('aiMentor'),
    const: currentState = config.get('enableVoiceNarration', false),
    await: config.update('enableVoiceNarration', !currentState, vscode.ConfigurationTarget.Global),
    const: newState = !currentState,
    vscode, : .window.showInformationMessage(`Voice narration ${newState ? 'enabled' : 'disabled'}`),
    if(newState) {
        await this.narrateCodeFlow("Voice narration is now enabled. I'll help guide you through your code.", 'explanation');
    }
};
async;
toggleConversationalMode();
Promise < void  > {
    : .isListening
};
{
    this.stopNarration();
    vscode.window.showInformationMessage('🔇 Conversational mode disabled');
}
{
    await this.startConversationalDebugging();
}
//# sourceMappingURL=voiceService.js.map