import * as http from 'http';
import * as WebSocket from 'ws';
import * as vscode from 'vscode';

export class VAPIServer {
    private server: http.Server | null = null;
    private wss: WebSocket.Server | null = null;
    private port = 3001;
    private isRunning = false;
    private clients: Set<WebSocket> = new Set();

    constructor() {
        this.setupServer();
    }

    private setupServer() {
        // Create HTTP server for VAPI proxy
        this.server = http.createServer((req, res) => {
            // Enable CORS for all origins
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            if (req.url === '/vapi-proxy' && req.method === 'GET') {
                // Serve VAPI proxy HTML page
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(this.getVAPIProxyHTML());
            } else if (req.url === '/health' && req.method === 'GET') {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'ok', port: this.port }));
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        // Create WebSocket server for real-time communication
        this.wss = new WebSocket.Server({ server: this.server });
        
        this.wss.on('connection', (ws) => {
            console.log('VSCode extension connected to VAPI server');
            this.clients.add(ws);

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleMessage(data, ws);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            ws.on('close', () => {
                console.log('VSCode extension disconnected from VAPI server');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });
        });
    }

    private handleMessage(data: any, ws: WebSocket) {
        switch (data.type) {
            case 'startVAPI':
                this.broadcastToProxy({
                    type: 'startVAPI',
                    vapiPublicKey: data.vapiPublicKey,
                    assistantId: data.assistantId
                });
                break;
            case 'stopVAPI':
                this.broadcastToProxy({ type: 'stopVAPI' });
                break;
            case 'vapiStatus':
                // Forward status from proxy to VSCode
                ws.send(JSON.stringify({
                    type: 'vapiConnectionStatus',
                    status: data.status,
                    message: data.message
                }));
                break;
            case 'vapiTranscript':
                // Forward transcript from proxy to VSCode
                ws.send(JSON.stringify({
                    type: 'vapiTranscript',
                    transcript: data.transcript,
                    role: data.role
                }));
                break;
        }
    }

    private broadcastToProxy(message: any) {
        // This would broadcast to the VAPI proxy page if it's connected
        // For now, we'll store the message and send it when proxy connects
        console.log('Broadcasting to VAPI proxy:', message);
    }

    private getVAPIProxyHTML(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VAPI Proxy</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #1e1e1e; color: white; }
        .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
        .connected { background: #0e7c0e; }
        .disconnected { background: #c42b1c; }
        .waiting { background: #ca5010; }
        button { padding: 10px 20px; margin: 5px; border: none; border-radius: 5px; cursor: pointer; }
        .start-btn { background: #0e7c0e; color: white; }
        .stop-btn { background: #c42b1c; color: white; }
    </style>
</head>
<body>
    <h1>🎤 VAPI Proxy Server</h1>
    <div id="status" class="status waiting">Initializing...</div>
    <div id="controls" style="display: none;">
        <button id="startBtn" class="start-btn">Start Voice</button>
        <button id="stopBtn" class="stop-btn">Stop Voice</button>
    </div>
    <div id="transcript"></div>

    <script type="module">
        let vapi = null;
        let ws = null;
        let vapiConnected = false;

        // Connect to WebSocket server
        function connectWebSocket() {
            ws = new WebSocket('ws://localhost:${this.port}');
            
            ws.onopen = () => {
                console.log('Connected to VAPI server');
                updateStatus('Connected to VAPI server', 'connected');
                document.getElementById('controls').style.display = 'block';
            };
            
            ws.onmessage = (event) => {
                const data = JSON.parse(event.data);
                handleServerMessage(data);
            };
            
            ws.onclose = () => {
                console.log('Disconnected from VAPI server');
                updateStatus('Disconnected from VAPI server', 'disconnected');
                setTimeout(connectWebSocket, 2000); // Reconnect
            };
        }

        async function initVAPI() {
            try {
                // Load VAPI in unrestricted browser environment
                const { default: Vapi } = await import('https://esm.sh/@vapi-ai/web@latest');
                window.VapiClass = Vapi;
                console.log('VAPI loaded successfully');
                return true;
            } catch (error) {
                console.error('Failed to load VAPI:', error);
                return false;
            }
        }

        function handleServerMessage(data) {
            switch (data.type) {
                case 'startVAPI':
                    startVAPICall(data.vapiPublicKey, data.assistantId);
                    break;
                case 'stopVAPI':
                    stopVAPICall();
                    break;
            }
        }

        async function startVAPICall(publicKey, assistantId) {
            try {
                if (!window.VapiClass) {
                    throw new Error('VAPI not loaded');
                }

                // Request microphone permission
                await navigator.mediaDevices.getUserMedia({ audio: true });

                vapi = new window.VapiClass(publicKey);

                vapi.on('call-start', () => {
                    vapiConnected = true;
                    updateStatus('🎤 Voice call active', 'connected');
                    ws.send(JSON.stringify({
                        type: 'vapiStatus',
                        status: 'connected',
                        message: 'Voice connection established'
                    }));
                });

                vapi.on('call-end', () => {
                    vapiConnected = false;
                    updateStatus('Voice call ended', 'disconnected');
                    ws.send(JSON.stringify({
                        type: 'vapiStatus',
                        status: 'disconnected',
                        message: 'Voice connection ended'
                    }));
                });

                vapi.on('message', (message) => {
                    if (message.type === 'transcript') {
                        const transcript = \`\${message.role === 'user' ? '🧑 You' : '🤖 Mentor'}: \${message.transcript}\`;
                        addTranscript(transcript);
                        ws.send(JSON.stringify({
                            type: 'vapiTranscript',
                            transcript: transcript,
                            role: message.role
                        }));
                    }
                });

                await vapi.start(assistantId);

            } catch (error) {
                console.error('VAPI error:', error);
                updateStatus(\`Error: \${error.message}\`, 'disconnected');
                ws.send(JSON.stringify({
                    type: 'vapiStatus',
                    status: 'error',
                    message: error.message
                }));
            }
        }

        async function stopVAPICall() {
            if (vapi && vapiConnected) {
                try {
                    await vapi.stop();
                } catch (error) {
                    console.error('Error stopping VAPI:', error);
                }
            }
        }

        function updateStatus(message, type) {
            const statusEl = document.getElementById('status');
            statusEl.textContent = message;
            statusEl.className = \`status \${type}\`;
        }

        function addTranscript(text) {
            const transcriptEl = document.getElementById('transcript');
            const div = document.createElement('div');
            div.textContent = text;
            div.style.margin = '5px 0';
            transcriptEl.appendChild(div);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', async () => {
            updateStatus('Loading VAPI...', 'waiting');
            const vapiLoaded = await initVAPI();
            
            if (vapiLoaded) {
                updateStatus('VAPI loaded, connecting to server...', 'waiting');
                connectWebSocket();
            } else {
                updateStatus('Failed to load VAPI', 'disconnected');
            }

            // Button handlers
            document.getElementById('startBtn').onclick = () => {
                ws.send(JSON.stringify({ type: 'requestStart' }));
            };
            
            document.getElementById('stopBtn').onclick = () => {
                stopVAPICall();
            };
        });
    </script>
</body>
</html>`;
    }

    public async start(): Promise<boolean> {
        return new Promise((resolve) => {
            if (this.isRunning) {
                resolve(true);
                return;
            }

            this.server?.listen(this.port, () => {
                this.isRunning = true;
                console.log(`VAPI server running on http://localhost:${this.port}`);
                resolve(true);
            });

            this.server?.on('error', (error: any) => {
                if (error.code === 'EADDRINUSE') {
                    this.port++;
                    this.start().then(resolve);
                } else {
                    console.error('VAPI server error:', error);
                    resolve(false);
                }
            });
        });
    }

    public stop() {
        if (this.server && this.isRunning) {
            this.server.close();
            this.isRunning = false;
            console.log('VAPI server stopped');
        }
    }

    public getPort(): number {
        return this.port;
    }

    public sendToVSCode(message: any) {
        this.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
            }
        });
    }
}
