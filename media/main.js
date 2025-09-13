(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM elements
    const messagesContainer = document.getElementById('messages');
    const clearBtn = document.getElementById('clearBtn');
    const explainBtn = document.getElementById('explainBtn');
    const speakBtn = document.getElementById('speakBtn');
    const codeInput = document.getElementById('codeInput');
    const statusText = document.getElementById('statusText');
    const mentorSelect = document.getElementById('mentorSelect');
    
    let isVoiceActive = false;

    // Event listeners
    clearBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'clearHistory' });
        clearMessages();
    });

    explainBtn.addEventListener('click', () => {
        const code = codeInput.value.trim();
        if (code) {
            vscode.postMessage({ 
                type: 'requestExplanation', 
                code: code 
            });
            codeInput.value = '';
            updateStatus('Analyzing code...');
        }
    });

    codeInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            explainBtn.click();
        }
    });

    // Voice button click handler
    speakBtn.addEventListener('click', () => {
        if (isVoiceActive) {
            vscode.postMessage({ type: 'stopVoiceChat' });
            updateStatus('Stopping voice chat...');
        } else {
            vscode.postMessage({ type: 'startVoiceChat' });
            updateStatus('Starting voice chat...');
        }
    });

    // Mentor dropdown selection
    mentorSelect.addEventListener('change', (e) => {
        const mentorId = e.target.value;
        if (mentorId) {
            // Send message to extension
            vscode.postMessage({ 
                type: 'switchProfile', 
                profileId: mentorId 
            });
            
            // Update status to show mentor is switching
            updateStatus(`Switching to ${getMentorName(mentorId)}...`);
        }
    });

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'updateMessages':
                displayMessages(message.messages);
                break;
            case 'vapiTranscript':
                // Handle VAPI transcript updates
                const transcriptContainer = document.getElementById('transcript-container');
                if (transcriptContainer) {
                    const transcriptDiv = document.createElement('div');
                    transcriptDiv.className = `transcript-message ${message.role}`;
                    const timestamp = new Date().toLocaleTimeString();
                    transcriptDiv.innerHTML = `
                        <div class="transcript-header">
                            <span class="transcript-role">${message.role === 'user' ? 'You' : 'Mentor'}</span>
                            <span class="transcript-time">${timestamp}</span>
                        </div>
                        <div class="transcript-text">${message.text}</div>
                    `;
                    transcriptContainer.appendChild(transcriptDiv);
                    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
                }
                break;
            case 'statusUpdate':
                updateStatus(message.status);
                break;
            case 'updateProfiles':
                updateActiveMentor(message.activeProfileId);
                updateMentorName(message.activeMentorName);
                break;
            case 'voiceStateChanged':
                updateVoiceButtonState(message.isActive);
                break;
            case 'startVAPIConnection':
                startVAPIConnection(message.vapiPublicKey, message.assistantId);
                break;
            case 'stopVAPIConnection':
                stopVAPIConnection();
                break;
        }
    });

    function displayMessages(messages) {
        // Keep welcome message if no other messages
        if (messages.length === 0) {
            return;
        }

        // Clear welcome message when we have real messages
        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg && messages.length > 0) {
            welcomeMsg.remove();
        }

        // Add new messages
        messages.forEach((msg, index) => {
            if (!document.querySelector(`[data-message-id="${index}"]`)) {
                addMessage(msg, index);
            }
        });

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        updateStatus('Ready to help');
    }

    function addMessage(response, id) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${response.type}`;
        messageDiv.setAttribute('data-message-id', id);

        const icon = getMessageIcon(response.type);
        const typeLabel = getTypeLabel(response.type);

        let html = `
            <div class="message-header">
                <span class="message-icon">${icon}</span>
                <span>${typeLabel}</span>
            </div>
            <div class="message-content">${escapeHtml(response.message)}</div>
        `;

        // Add suggestions if present
        if (response.suggestions && response.suggestions.length > 0) {
            html += '<ul class="suggestions-list">';
            response.suggestions.forEach(suggestion => {
                html += `<li>💡 ${escapeHtml(suggestion)}</li>`;
            });
            html += '</ul>';
        }

        // Add warnings if present
        if (response.warnings && response.warnings.length > 0) {
            html += '<ul class="warnings-list">';
            response.warnings.forEach(warning => {
                html += `<li>⚠️ ${escapeHtml(warning)}</li>`;
            });
            html += '</ul>';
        }

        // Add code snippets if present
        if (response.codeSnippets && response.codeSnippets.length > 0) {
            response.codeSnippets.forEach(snippet => {
                html += `
                    <div class="code-snippet">
                        <pre><code>${escapeHtml(snippet.code)}</code></pre>
                    </div>
                `;
            });
        }

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);
    }

    function getMessageIcon(type) {
        switch (type) {
            case 'narration': return '📖';
            case 'warning': return '⚠️';
            case 'suggestion': return '💡';
            case 'explanation': return '🔍';
            default: return '🤖';
        }
    }

    function getTypeLabel(type) {
        switch (type) {
            case 'narration': return 'Code Narration';
            case 'warning': return 'Warning';
            case 'suggestion': return 'Suggestion';
            case 'explanation': return 'Explanation';
            default: return 'AI Mentor';
        }
    }

    function clearMessages() {
        // Remove all messages except welcome
        const messages = messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        // Re-add welcome message if no messages
        if (!messagesContainer.querySelector('.welcome-message')) {
            messagesContainer.innerHTML = `
                <div class="welcome-message">
                    <h3>👋 Welcome to AI Mentor!</h3>
                    <p>I'm here to help you code better. I'll watch your code changes and provide real-time guidance.</p>
                    <ul>
                        <li>🔍 <strong>Real-time Analysis:</strong> I analyze your code as you type</li>
                        <li>🐛 <strong>Proactive Debugging:</strong> I spot issues before they become problems</li>
                        <li>📚 <strong>Code Explanation:</strong> I explain what your code does in plain English</li>
                        <li>🎯 <strong>Best Practices:</strong> I suggest improvements and optimizations</li>
                    </ul>
                    <p>Start coding and I'll begin mentoring you!</p>
                </div>
            `;
        }
    }

    function updateStatus(status) {
        statusText.textContent = status;
        
        const indicator = document.querySelector('.status-indicator');
        if (status.includes('error') || status.includes('Error')) {
            indicator.style.backgroundColor = 'var(--vscode-terminal-ansiRed)';
        } else if (status.includes('warning') || status.includes('Warning')) {
            indicator.style.backgroundColor = 'var(--vscode-terminal-ansiYellow)';
        } else if (status.includes('Analyzing') || status.includes('Processing')) {
            indicator.style.backgroundColor = 'var(--vscode-terminal-ansiBlue)';
        } else {
            indicator.style.backgroundColor = 'var(--vscode-terminal-ansiGreen)';
        }
    }

    function updateActiveMentor(activeProfileId) {
        // Update dropdown selection
        if (activeProfileId && mentorSelect) {
            mentorSelect.value = activeProfileId;
        }
    }

    function getMentorName(mentorId) {
        const mentorNames = {
            'marcus': 'Marcus "The Hammer"',
            'sophia': 'Sophia "Sass"', 
            'alex': 'Alex "Sunshine"'
        };
        return mentorNames[mentorId] || 'AI Mentor';
    }

    function updateMentorName(mentorName) {
        console.log('Updating mentor name to:', mentorName);
        
        // Always update the header to show the active mentor
        const headerElement = document.querySelector('#mentorTitle');
        if (headerElement) {
            headerElement.textContent = `🤖 ${mentorName || 'AI Mentor'}`;
        }
        
        // Update welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message h3');
        if (welcomeMessage) {
            welcomeMessage.textContent = `👋 Welcome! I'm ${mentorName || 'AI Mentor'}`;
        }
        
        // Update status to show active mentor
        updateStatus(`${mentorName || 'AI Mentor'} is ready to help`);
    }

    function updateVoiceButtonState(isActive) {
        isVoiceActive = isActive;
        if (speakBtn) {
            if (isActive) {
                speakBtn.textContent = '🔇 Stop speaking';
                speakBtn.classList.add('voice-active');
                updateStatus('🎤 Voice chat active - speak to your mentor');
            } else {
                speakBtn.textContent = '🎤 Speak to your mentor';
                speakBtn.classList.remove('voice-active');
                updateStatus('Voice chat ended');
            }
        }
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // VAPI Integration - runs in browser context with access to navigator.mediaDevices
    let vapi = null;
    let vapiConnected = false;
    let microphonePermissionGranted = false;

    // Check microphone availability without requesting permission immediately
    async function checkMicrophoneAvailability() {
        try {
            // Check if microphone APIs are available
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                console.warn('getUserMedia not supported in this environment');
                updateStatus('🔇 Voice features not supported in this environment');
                return false;
            }

            // Check if we can enumerate devices (doesn't require permission)
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasAudioInput = devices.some(device => device.kind === 'audioinput');
            
            if (hasAudioInput) {
                updateStatus('🎤 Voice ready - Click "Speak to your mentor" to start');
                return true;
            } else {
                updateStatus('🔇 No microphone found - Please connect a microphone');
                return false;
            }
        } catch (error) {
            console.warn('Error checking microphone availability:', error.message);
            updateStatus('🎤 Voice ready - Click "Speak to your mentor" to start');
            return true; // Assume available if we can't check
        }
    }

    // Request microphone permission only when needed
    async function requestMicrophonePermission() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // Stop the stream immediately - we just wanted permission
            stream.getTracks().forEach(track => track.stop());
            
            microphonePermissionGranted = true;
            console.log('Microphone permission granted');
            return true;
        } catch (error) {
            console.warn('Microphone permission denied:', error.message);
            microphonePermissionGranted = false;
            
            // Send error back to extension for user notification
            vscode.postMessage({
                type: 'vapiConnectionStatus',
                status: 'error',
                message: `Microphone access required: ${error.message}`
            });
            
            return false;
        }
    }

    // Direct VAPI loading workaround for VSCode webview
    async function loadVAPIDirectly() {
        return new Promise((resolve, reject) => {
            try {
                // Create script element for direct loading
                const script = document.createElement('script');
                script.type = 'module';
                script.innerHTML = `
                    import Vapi from 'https://esm.sh/@vapi-ai/web@latest';
                    window.VapiClass = Vapi;
                    window.dispatchEvent(new CustomEvent('vapiLoaded'));
                `;
                
                // Listen for successful load
                window.addEventListener('vapiLoaded', () => {
                    console.log('VAPI loaded via direct script injection');
                    resolve(window.VapiClass);
                }, { once: true });
                
                // Add error handling
                script.onerror = () => {
                    console.error('Direct VAPI loading failed');
                    resolve(null);
                };
                
                document.head.appendChild(script);
                
                // Timeout after 10 seconds
                setTimeout(() => {
                    if (!window.VapiClass) {
                        console.warn('VAPI loading timeout');
                        resolve(null);
                    }
                }, 10000);
                
            } catch (error) {
                console.error('Error in direct VAPI loading:', error);
                resolve(null);
            }
        });
    }

    // Iframe proxy workaround for VAPI loading
    async function loadVAPIViaIframe() {
        return new Promise((resolve) => {
            try {
                // Create hidden iframe with relaxed security
                const iframe = document.createElement('iframe');
                iframe.style.display = 'none';
                iframe.sandbox = 'allow-scripts allow-same-origin allow-forms';
                iframe.src = 'data:text/html,<!DOCTYPE html><html><head><script type="module">import Vapi from "https://esm.sh/@vapi-ai/web@latest";window.parent.postMessage({type:"vapiLoaded",Vapi:Vapi},"*");</script></head><body></body></html>';
                
                // Listen for VAPI from iframe
                const messageHandler = (event) => {
                    if (event.data && event.data.type === 'vapiLoaded') {
                        console.log('VAPI loaded via iframe proxy');
                        window.removeEventListener('message', messageHandler);
                        document.body.removeChild(iframe);
                        resolve(event.data.Vapi);
                    }
                };
                
                window.addEventListener('message', messageHandler);
                document.body.appendChild(iframe);
                
                // Timeout after 15 seconds
                setTimeout(() => {
                    window.removeEventListener('message', messageHandler);
                    if (document.body.contains(iframe)) {
                        document.body.removeChild(iframe);
                    }
                    console.warn('Iframe VAPI loading timeout');
                    resolve(null);
                }, 15000);
                
            } catch (error) {
                console.error('Iframe VAPI loading error:', error);
                resolve(null);
            }
        });
    }

    // Check microphone availability on load (without requesting permission)
    checkMicrophoneAvailability();

    async function startVAPIConnection(vapiPublicKey, assistantId) {
        try {
            // Check if microphone permission was granted
            if (!microphonePermissionGranted) {
                const permissionGranted = await requestMicrophonePermission();
                if (!permissionGranted) {
                    throw new Error('Microphone permission required for voice chat');
                }
            }

            // Multiple VAPI loading strategies as workarounds
            let Vapi = null;
            
            // Strategy 1: Try ESM.sh
            try {
                console.log('Trying VAPI via esm.sh...');
                const module = await import('https://esm.sh/@vapi-ai/web@latest');
                Vapi = module.default || module.Vapi;
            } catch (error) {
                console.warn('ESM.sh failed:', error);
            }
            
            // Strategy 2: Try unpkg.com
            if (!Vapi) {
                try {
                    console.log('Trying VAPI via unpkg...');
                    const module = await import('https://unpkg.com/@vapi-ai/web@latest/dist/index.js');
                    Vapi = module.default || module.Vapi;
                } catch (error) {
                    console.warn('Unpkg failed:', error);
                }
            }
            
            // Strategy 3: Try jsdelivr
            if (!Vapi) {
                try {
                    console.log('Trying VAPI via jsdelivr...');
                    const module = await import('https://cdn.jsdelivr.net/npm/@vapi-ai/web@latest/+esm');
                    Vapi = module.default || module.Vapi;
                } catch (error) {
                    console.warn('JSDelivr failed:', error);
                }
            }
            
            // Strategy 4: Direct script loading workaround
            if (!Vapi) {
                console.log('Trying direct script loading...');
                Vapi = await loadVAPIDirectly();
            }
            
            // Strategy 5: Use pre-bundled VAPI if available
            if (!Vapi && window.VapiClass) {
                console.log('Using pre-loaded VAPI...');
                Vapi = window.VapiClass;
            }
            
            // Strategy 6: Iframe proxy workaround
            if (!Vapi) {
                console.log('Trying iframe proxy workaround...');
                Vapi = await loadVAPIViaIframe();
            }
            
            if (!Vapi) {
                throw new Error('Could not load VAPI from any CDN - trying alternative voice solution');
            }

            console.log('VAPI loaded successfully, initializing...');
            vapi = new Vapi(vapiPublicKey);
            
            // Set up event listeners
            vapi.on('call-start', () => {
                console.log('VAPI call started');
                vapiConnected = true;
                updateVoiceButtonState(true);
                vscode.postMessage({
                    type: 'vapiConnectionStatus',
                    status: 'connected',
                    message: 'Voice connection established'
                });
            });

            vapi.on('call-end', () => {
                console.log('VAPI call ended');
                vapiConnected = false;
                updateVoiceButtonState(false);
                vscode.postMessage({
                    type: 'vapiConnectionStatus',
                    status: 'disconnected',
                    message: 'Voice connection ended'
                });
            });

            vapi.on('message', (message) => {
                if (message.type === 'transcript') {
                    const who = message.role === 'user' ? '🧑 You' : '🤖 Mentor';
                    const transcript = `${who}: ${message.transcript}`;
                    console.log('Transcript:', transcript);
                    
                    // Send transcript back to extension
                    vscode.postMessage({
                        type: 'vapiTranscript',
                        transcript: transcript,
                        role: message.role
                    });
                }
            });

            // Since we already have permission, start the call directly
            await vapi.start(assistantId);
            
        } catch (error) {
            console.error('VAPI connection error:', error);
            vscode.postMessage({
                type: 'vapiConnectionStatus',
                status: 'error',
                message: error.message || 'Failed to connect to voice service'
            });
        }
    }

    async function stopVAPIConnection() {
        if (vapi && vapiConnected) {
            try {
                await vapi.stop();
            } catch (error) {
                console.error('Error stopping VAPI:', error);
            }
        }
        vapiConnected = false;
        updateVoiceButtonState(false);
    }

    // Initialize with Marcus as default active mentor
    updateActiveMentor('marcus');
    updateMentorName('Marcus "The Hammer" Thompson');
    updateStatus('Marcus "The Hammer" is ready to help');
})();
