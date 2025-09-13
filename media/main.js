(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM elements
    const messagesContainer = document.getElementById('messages');
    const clearBtn = document.getElementById('clearBtn');
    const explainBtn = document.getElementById('explainBtn');
    const codeInput = document.getElementById('codeInput');
    const statusText = document.getElementById('statusText');
    const profileSelect = document.getElementById('profileSelect');

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

    profileSelect.addEventListener('change', (e) => {
        const profileId = e.target.value;
        if (profileId) {
            vscode.postMessage({ 
                type: 'switchProfile', 
                profileId: profileId 
            });
        }
    });

    // Message handling
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
            case 'updateMessages':
                displayMessages(message.messages);
                break;
            case 'statusUpdate':
                updateStatus(message.status);
                break;
            case 'updateProfiles':
                updateProfileSelector(message.profiles, message.activeProfileId);
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

    function updateProfileSelector(profiles, activeProfileId) {
        profileSelect.innerHTML = '';
        
        profiles.forEach(profile => {
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = `${profile.name} (${profile.role})`;
            if (profile.id === activeProfileId) {
                option.selected = true;
            }
            profileSelect.appendChild(option);
        });
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize
    updateStatus('Ready to help');
})();
