(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM elements
    const messagesContainer = document.getElementById('messages');
    const clearBtn = document.getElementById('clearBtn');
    const explainBtn = document.getElementById('explainBtn');
    const codeInput = document.getElementById('codeInput');
    const statusText = document.getElementById('statusText');
    const mentorSelect = document.getElementById('mentorSelect');
    
    // Enhanced state management
    let currentMentor = {
        id: 'marcus',
        name: 'Marcus "The Hammer" Thompson',
        avatar: '💀',
        isTyping: false,
        lastActivity: Date.now()
    };
    
    let messageQueue = [];
    let isProcessingQueue = false;
    let typingIndicator = null;
    let mentorMood = 'neutral'; // neutral, happy, frustrated, focused
    let conversationContext = [];

    // Enhanced event listeners
    clearBtn.addEventListener('click', () => {
        hideTypingIndicator(); // Clear any stuck indicators
        if (confirm('Are you sure you want to clear all conversation history?')) {
            vscode.postMessage({ type: 'clearHistory' });
            clearMessages();
            showMentorReaction('reset');
        }
    });

    explainBtn.addEventListener('click', () => {
        const code = codeInput.value.trim();
        if (code) {
            // Add user message to UI immediately
            addUserMessage(code);
            
            // Show mentor is thinking
            showTypingIndicator();
            
            vscode.postMessage({ 
                type: 'requestExplanation', 
                code: code,
                context: conversationContext.slice(-3) // Send recent context
            });
            
            codeInput.value = '';
            updateStatus(`${currentMentor.name} is analyzing your code...`);
            
            // Animate the explain button
            explainBtn.classList.add('processing');
            setTimeout(() => explainBtn.classList.remove('processing'), 2000);
            
            // Safety timeout to hide typing indicator if no response comes
            setTimeout(() => {
                hideTypingIndicator();
                updateStatus(`${currentMentor.name} is ready to help`);
            }, 15000); // 15 second timeout
        } else {
            // Shake animation for empty input
            codeInput.classList.add('shake');
            setTimeout(() => codeInput.classList.remove('shake'), 500);
            updateStatus('Please enter some code to analyze!');
        }
    });

    codeInput.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            explainBtn.click();
        }
    });

    // Enhanced mentor dropdown selection
    mentorSelect.addEventListener('change', (e) => {
        const mentorId = e.target.value;
        if (mentorId && mentorId !== currentMentor.id) {
            // Show transition animation
            showMentorTransition(currentMentor.id, mentorId);
            
            // Update current mentor
            currentMentor.id = mentorId;
            currentMentor.name = getMentorName(mentorId);
            currentMentor.avatar = getMentorAvatar(mentorId);
            
            // Send message to extension
            vscode.postMessage({ 
                type: 'switchProfile', 
                profileId: mentorId 
            });
            
            // Add system message about mentor switch
            addSystemMessage(`${currentMentor.avatar} ${currentMentor.name} has joined the conversation!`);
            
            updateStatus(`${currentMentor.name} is ready to help`);
        }
    });

    // Enhanced message handling
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'updateMessages':
                hideTypingIndicator();
                displayMessages(message.messages);
                break;
            case 'statusUpdate':
                updateStatus(message.status);
                break;
            case 'updateProfiles':
                updateActiveMentor(message.activeProfileId);
                updateMentorName(message.activeMentorName);
                break;
            case 'mentorTyping':
                showTypingIndicator();
                break;
            case 'voiceEnabled':
                showVoiceIndicator(message.enabled);
                break;
            case 'mentorMood':
                updateMentorMood(message.mood);
                break;
            case 'error':
                hideTypingIndicator();
                updateStatus('Error occurred - please try again');
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
            welcomeMsg.style.opacity = '0';
            setTimeout(() => welcomeMsg?.remove(), 300);
        }

        // Add new messages with animation
        messages.forEach((msg, index) => {
            if (!document.querySelector(`[data-message-id="${index}"]`)) {
                addMessage(msg, index);
                // Add to conversation context
                conversationContext.push({
                    type: msg.type,
                    message: msg.message,
                    timestamp: Date.now()
                });
            }
        });

        // Smooth scroll to bottom
        smoothScrollToBottom();
        updateStatus(`${currentMentor.name} is ready to help`);
    }

    function addMessage(response, id) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${response.type}`;
        messageDiv.setAttribute('data-message-id', id);
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';

        const icon = getMessageIcon(response.type);
        const typeLabel = getTypeLabel(response.type);
        const timestamp = new Date().toLocaleTimeString();

        let html = `
            <div class="message-header">
                <span class="message-icon animate-bounce">${icon}</span>
                <span class="message-title">${typeLabel}</span>
                <span class="message-timestamp">${timestamp}</span>
                <button class="message-actions" onclick="toggleMessageActions(${id})">
                    <span>⋯</span>
                </button>
            </div>
            <div class="message-content">${formatMessageContent(response.message)}</div>
        `;

        // Add interactive suggestions
        if (response.suggestions && response.suggestions.length > 0) {
            html += '<div class="suggestions-container">';
            html += '<h4>💡 Suggestions:</h4>';
            html += '<ul class="suggestions-list">';
            response.suggestions.forEach((suggestion, idx) => {
                html += `<li class="suggestion-item" onclick="applySuggestion('${escapeHtml(suggestion)}', ${idx})">
                    <span class="suggestion-text">${escapeHtml(suggestion)}</span>
                    <span class="suggestion-apply">Apply</span>
                </li>`;
            });
            html += '</ul></div>';
        }

        // Add interactive warnings
        if (response.warnings && response.warnings.length > 0) {
            html += '<div class="warnings-container">';
            html += '<h4>⚠️ Warnings:</h4>';
            html += '<ul class="warnings-list">';
            response.warnings.forEach((warning, idx) => {
                html += `<li class="warning-item">
                    <span class="warning-text">${escapeHtml(warning)}</span>
                    <button class="warning-dismiss" onclick="dismissWarning(${id}, ${idx})">Dismiss</button>
                </li>`;
            });
            html += '</ul></div>';
        }

        // Add enhanced code snippets
        if (response.codeSnippets && response.codeSnippets.length > 0) {
            response.codeSnippets.forEach((snippet, idx) => {
                html += `
                    <div class="code-snippet-container">
                        <div class="code-snippet-header">
                            <span class="code-language">${snippet.language || 'code'}</span>
                            <button class="copy-code" onclick="copyCodeSnippet(${id}, ${idx})">
                                📋 Copy
                            </button>
                        </div>
                        <div class="code-snippet">
                            <pre><code class="language-${snippet.language}">${escapeHtml(snippet.code)}</code></pre>
                        </div>
                        ${snippet.explanation ? `<div class="code-explanation">${escapeHtml(snippet.explanation)}</div>` : ''}
                    </div>
                `;
            });
        }

        // Add message actions menu
        html += `
            <div class="message-actions-menu" id="actions-${id}" style="display: none;">
                <button onclick="copyMessage(${id})">📋 Copy</button>
                <button onclick="shareMessage(${id})">🔗 Share</button>
                <button onclick="reportMessage(${id})">🚩 Report</button>
            </div>
        `;

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);

        // Animate in
        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 100);

        // Add mentor personality flair
        addMentorPersonalityEffects(messageDiv, response.type);
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

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Enhanced utility functions
    function getMentorAvatar(mentorId) {
        const avatars = {
            'marcus': '💀',
            'sophia': '😏',
            'alex': '🌟'
        };
        return avatars[mentorId] || '🤖';
    }

    function addUserMessage(code) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-icon">👤</span>
                <span class="message-title">You</span>
                <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">
                <div class="code-snippet">
                    <pre><code>${escapeHtml(code)}</code></pre>
                </div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        smoothScrollToBottom();
    }

    function addSystemMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message system-message';
        messageDiv.innerHTML = `
            <div class="message-content system-content">
                <span class="system-icon">🔄</span>
                ${escapeHtml(message)}
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        smoothScrollToBottom();
    }

    function showTypingIndicator() {
        hideTypingIndicator(); // Remove existing indicator
        
        typingIndicator = document.createElement('div');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.innerHTML = `
            <div class="typing-content">
                <span class="mentor-avatar">${currentMentor.avatar}</span>
                <span class="typing-text">${currentMentor.name} is thinking...</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingIndicator);
        smoothScrollToBottom();
    }

    function hideTypingIndicator() {
        if (typingIndicator) {
            typingIndicator.style.opacity = '0';
            setTimeout(() => {
                if (typingIndicator) {
                    typingIndicator.remove();
                    typingIndicator = null;
                }
            }, 300);
        }
    }

    function showMentorTransition(fromId, toId) {
        const transitionDiv = document.createElement('div');
        transitionDiv.className = 'mentor-transition';
        transitionDiv.innerHTML = `
            <div class="transition-content">
                <span class="transition-from">${getMentorAvatar(fromId)}</span>
                <span class="transition-arrow">→</span>
                <span class="transition-to">${getMentorAvatar(toId)}</span>
            </div>
        `;
        messagesContainer.appendChild(transitionDiv);
        
        setTimeout(() => {
            transitionDiv.style.opacity = '0';
            setTimeout(() => transitionDiv.remove(), 300);
        }, 2000);
        
        smoothScrollToBottom();
    }

    function showMentorReaction(type) {
        const reactions = {
            'reset': '🔄 Conversation cleared!',
            'error': '😅 Oops, something went wrong!',
            'success': '✅ Great job!',
            'thinking': '🤔 Let me think about this...'
        };
        
        const reaction = reactions[type] || reactions['thinking'];
        addSystemMessage(reaction);
    }

    function smoothScrollToBottom() {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function formatMessageContent(content) {
        // Enhanced message formatting with markdown-like support
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    function addMentorPersonalityEffects(messageDiv, type) {
        // Add personality-specific visual effects
        switch (currentMentor.id) {
            case 'marcus':
                if (type === 'warning') {
                    messageDiv.classList.add('marcus-harsh');
                }
                break;
            case 'sophia':
                messageDiv.classList.add('sophia-witty');
                break;
            case 'alex':
                messageDiv.classList.add('alex-positive');
                if (type === 'suggestion') {
                    messageDiv.classList.add('alex-excited');
                }
                break;
        }
    }

    // Interactive functions for enhanced UI
    window.toggleMessageActions = function(id) {
        const menu = document.getElementById(`actions-${id}`);
        if (menu) {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        }
    };

    window.applySuggestion = function(suggestion, idx) {
        // Apply suggestion to code input
        codeInput.value = suggestion;
        codeInput.focus();
        
        // Show feedback
        updateStatus(`Applied suggestion: ${suggestion.substring(0, 50)}...`);
        
        // Send analytics
        vscode.postMessage({
            type: 'suggestionApplied',
            suggestion: suggestion,
            index: idx
        });
    };

    window.dismissWarning = function(messageId, warningIdx) {
        const warningItem = document.querySelector(`[data-message-id="${messageId}"] .warning-item:nth-child(${warningIdx + 1})`);
        if (warningItem) {
            warningItem.style.opacity = '0.5';
            warningItem.style.textDecoration = 'line-through';
        }
    };

    window.copyCodeSnippet = function(messageId, snippetIdx) {
        const snippet = document.querySelector(`[data-message-id="${messageId}"] .code-snippet:nth-child(${snippetIdx + 1}) code`);
        if (snippet) {
            navigator.clipboard.writeText(snippet.textContent).then(() => {
                updateStatus('Code copied to clipboard!');
            });
        }
    };

    window.copyMessage = function(id) {
        const message = document.querySelector(`[data-message-id="${id}"] .message-content`);
        if (message) {
            navigator.clipboard.writeText(message.textContent).then(() => {
                updateStatus('Message copied to clipboard!');
            });
        }
    };

    window.shareMessage = function(id) {
        const message = document.querySelector(`[data-message-id="${id}"] .message-content`);
        if (message && navigator.share) {
            navigator.share({
                title: 'AI Mentor Advice',
                text: message.textContent
            });
        }
    };

    window.reportMessage = function(id) {
        vscode.postMessage({
            type: 'reportMessage',
            messageId: id
        });
        updateStatus('Message reported. Thank you for your feedback!');
    };

    function showVoiceIndicator(enabled) {
        const indicator = document.createElement('div');
        indicator.className = 'voice-indicator';
        indicator.innerHTML = enabled ? '🎤 Voice enabled' : '🔇 Voice disabled';
        indicator.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 8px 12px;
            border-radius: 4px;
            z-index: 1000;
            opacity: 0;
            transition: opacity 0.3s;
        `;
        
        document.body.appendChild(indicator);
        setTimeout(() => indicator.style.opacity = '1', 100);
        setTimeout(() => {
            indicator.style.opacity = '0';
            setTimeout(() => indicator.remove(), 300);
        }, 3000);
    }

    function updateMentorMood(mood) {
        mentorMood = mood;
        const header = document.querySelector('#mentorTitle');
        if (header) {
            header.className = `mentor-mood-${mood}`;
        }
    }

    // Enhanced keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'k':
                    e.preventDefault();
                    clearMessages();
                    break;
                case 'Enter':
                    if (e.shiftKey) {
                        e.preventDefault();
                        explainBtn.click();
                    }
                    break;
                case '/':
                    e.preventDefault();
                    codeInput.focus();
                    break;
                case 'Escape':
                    e.preventDefault();
                    hideTypingIndicator(); // Emergency stop for stuck indicators
                    updateStatus(`${currentMentor.name} is ready to help`);
                    break;
            }
        }
    });

    // Auto-resize textarea
    codeInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });

    // Initialize enhanced features
    updateActiveMentor('marcus');
    updateMentorName('Marcus "The Hammer" Thompson');
    updateStatus('Marcus "The Hammer" is ready to help');
    
    // Add welcome animation
    setTimeout(() => {
        const welcome = document.querySelector('.welcome-message');
        if (welcome) {
            welcome.style.animation = 'fadeInUp 0.6s ease-out';
        }
    }, 500);
})();
