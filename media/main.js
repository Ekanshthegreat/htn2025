(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM elements
    const messagesContainer = document.getElementById('messages');
    const clearBtn = document.getElementById('clearBtn');
    const statusText = document.getElementById('statusText');
    const mentorSelect = document.getElementById('mentorSelect');
    const mentorAvatar = document.getElementById('mentorAvatar');
    
    // Enhanced state management
    let currentMentor = {
        id: null,
        name: 'AI Mentor',
        avatar: '🤖',
        isTyping: false,
        lastActivity: Date.now(),
        personality: null
    };
    
    let availableProfiles = [];
    let messageQueue = [];
    let isProcessingQueue = false;
    let typingIndicator = null;
    let mentorMood = 'neutral';
    let conversationContext = [];
    let mermaidLoaded = false;

    // Load Mermaid.js for diagram rendering
    function loadMermaid() {
        if (!mermaidLoaded) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
            script.onload = () => {
                mermaid.initialize({ 
                    startOnLoad: true,
                    theme: 'dark',
                    themeVariables: {
                        primaryColor: '#007ACC',
                        primaryTextColor: '#FFFFFF',
                        primaryBorderColor: '#007ACC',
                        lineColor: '#569CD6',
                        secondaryColor: '#1E1E1E',
                        tertiaryColor: '#2D2D30'
                    }
                });
                mermaidLoaded = true;
            };
            document.head.appendChild(script);
        }
    }

    // Enhanced event listeners
    clearBtn.addEventListener('click', () => {
        hideTypingIndicator();
        if (confirm('Are you sure you want to clear all conversation history?')) {
            vscode.postMessage({ type: 'clearHistory' });
            clearMessages();
            showMentorReaction('reset');
        }
    });

    // Enhanced mentor dropdown selection
    mentorSelect.addEventListener('change', (e) => {
        const mentorId = e.target.value;
        if (mentorId && mentorId !== currentMentor.id && availableProfiles.length > 0) {
            const selectedProfile = availableProfiles.find(p => p.id === mentorId);
            if (selectedProfile) {
                if (currentMentor.id) {
                    showMentorTransition(currentMentor.id, mentorId);
                }
                
                currentMentor.id = selectedProfile.id;
                currentMentor.name = selectedProfile.name;
                currentMentor.avatar = selectedProfile.avatar || '🤖';
                currentMentor.personality = selectedProfile.personality;
                
                vscode.postMessage({ 
                    type: 'switchProfile', 
                    profileId: mentorId 
                });
                
                addSystemMessage(`${currentMentor.name} has joined the conversation!`);
                updateStatus(`${currentMentor.name} is ready to help`);
                applyMentorTheme(selectedProfile.personality);
            }
        }
    });

    // Enhanced message handling with proactive analysis support
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
                updateProfiles(message.profiles, message.activeProfileId, message.activeMentorName);
                break;
            case 'hoverSuggestion':
                addHoverSuggestionMessage(message.suggestion);
                break;
            case 'proactiveAnalysis':
                addProactiveAnalysisMessage(message.analysis);
                break;
            case 'codeFlowDiagram':
                addCodeFlowDiagram(message.diagram);
                break;
            case 'performanceMetrics':
                addPerformanceMetrics(message.metrics);
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
        if (messages.length === 0) return;

        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg && messages.length > 0) {
            welcomeMsg.style.opacity = '0';
            setTimeout(() => welcomeMsg?.remove(), 300);
        }

        messages.forEach((msg, index) => {
            if (!document.querySelector(`[data-message-id="${index}"]`)) {
                addMessage(msg, index);
                conversationContext.push({
                    type: msg.type,
                    message: msg.message,
                    timestamp: Date.now()
                });
            }
        });

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
                <button class="message-actions" onclick="toggleMessageActions(${id})">⋯</button>
            </div>
            <div class="message-content">${formatMessageContent(response.message)}</div>
        `;

        // Enhanced suggestions with confidence scoring
        if (response.suggestions && response.suggestions.length > 0) {
            html += '<div class="suggestions-container"><h4>💡 Suggestions:</h4><ul class="suggestions-list">';
            response.suggestions.forEach((suggestion, idx) => {
                const confidence = suggestion.confidence || 85;
                const confidenceClass = confidence >= 90 ? 'high' : confidence >= 70 ? 'medium' : 'low';
                html += `<li class="suggestion-item ${confidenceClass}" onclick="applySuggestion('${escapeHtml(suggestion.text || suggestion)}', ${idx})">
                    <span class="suggestion-text">${escapeHtml(suggestion.text || suggestion)}</span>
                    <span class="suggestion-confidence">${confidence}%</span>
                    <span class="suggestion-apply">Apply</span>
                </li>`;
            });
            html += '</ul></div>';
        }

        // Enhanced warnings with severity levels
        if (response.warnings && response.warnings.length > 0) {
            html += '<div class="warnings-container"><h4>⚠️ Warnings:</h4><ul class="warnings-list">';
            response.warnings.forEach((warning, idx) => {
                const severity = warning.severity || 'medium';
                html += `<li class="warning-item severity-${severity}">
                    <span class="warning-text">${escapeHtml(warning.text || warning)}</span>
                    <span class="warning-severity">${severity.toUpperCase()}</span>
                    <button class="warning-dismiss" onclick="dismissWarning(${id}, ${idx})">Dismiss</button>
                </li>`;
            });
            html += '</ul></div>';
        }

        // Add proactive analysis data
        if (response.proactiveAnalysis) {
            html += addProactiveAnalysisSection(response.proactiveAnalysis);
        }

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 100);

        addMentorPersonalityEffects(messageDiv, response.type);
    }

    function addProactiveAnalysisSection(analysis) {
        let html = '<div class="proactive-analysis-container">';

        // Issues section
        if (analysis.issues && analysis.issues.length > 0) {
            html += '<div class="analysis-section issues-section"><h4>🐛 Potential Issues:</h4><ul class="issues-list">';
            analysis.issues.forEach((issue, idx) => {
                const priorityClass = issue.priority === 'critical' ? 'critical' : 
                                    issue.priority === 'high' ? 'high' : 
                                    issue.priority === 'medium' ? 'medium' : 'low';
                html += `<li class="issue-item priority-${priorityClass}">
                    <span class="issue-type">${issue.type}</span>
                    <span class="issue-description">${escapeHtml(issue.description)}</span>
                    <span class="issue-confidence">${issue.confidence}%</span>
                    ${issue.suggestedFix ? `<div class="issue-fix">${escapeHtml(issue.suggestedFix)}</div>` : ''}
                </li>`;
            });
            html += '</ul></div>';
        }

        // Performance metrics
        if (analysis.performance) {
            html += `<div class="analysis-section performance-section"><h4>⚡ Performance Analysis:</h4>
                <div class="performance-metrics">
                    <div class="metric">
                        <span class="metric-label">Complexity:</span>
                        <span class="metric-value complexity-${analysis.performance.complexity < 5 ? 'low' : analysis.performance.complexity < 10 ? 'medium' : 'high'}">${analysis.performance.complexity}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Maintainability:</span>
                        <span class="metric-value">${analysis.performance.maintainability}%</span>
                    </div>
                </div></div>`;
        }

        // Code flow diagram
        if (analysis.codeFlow) {
            html += `<div class="analysis-section diagram-section"><h4>📊 Code Flow:</h4>
                <div class="mermaid-container">
                    <div class="mermaid">${analysis.codeFlow}</div>
                </div></div>`;
        }

        html += '</div>';
        return html;
    }

    function addProactiveAnalysisMessage(analysis) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message proactive-analysis';
        messageDiv.innerHTML = `
            <div class="message-header">
                <img class="message-avatar" src="${currentMentor.avatar.startsWith('http') ? currentMentor.avatar : 'https://avatars.githubusercontent.com/u/60302907?v=4'}" alt="${currentMentor.name}" />
                <span class="message-title">🔍 Proactive Analysis</span>
                <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            ${addProactiveAnalysisSection(analysis)}
        `;
        messagesContainer.appendChild(messageDiv);
        smoothScrollToBottom();
        updateStatus(`${currentMentor.name} found ${analysis.issues?.length || 0} potential issues`);
    }

    function applyMentorTheme(personality) {
        const body = document.body;
        body.className = body.className.replace(/mentor-theme-\w+/g, '');
        
        if (personality) {
            const style = personality.communicationStyle || 'balanced';
            body.classList.add(`mentor-theme-${style}`);
            
            const root = document.documentElement;
            switch (style) {
                case 'direct':
                    root.style.setProperty('--mentor-accent', '#FF6B6B');
                    break;
                case 'supportive':
                    root.style.setProperty('--mentor-accent', '#4ECDC4');
                    break;
                case 'detailed':
                    root.style.setProperty('--mentor-accent', '#96CEB4');
                    break;
                case 'concise':
                    root.style.setProperty('--mentor-accent', '#A29BFE');
                    break;
                default:
                    root.style.setProperty('--mentor-accent', '#007ACC');
            }
        }
    }

    // Utility functions
    function getMessageIcon(type) {
        const icons = {
            'narration': '📖', 'warning': '⚠️', 'suggestion': '💡', 
            'explanation': '🔍', 'proactive-analysis': '🔍', 'performance': '⚡', 'diagram': '📊'
        };
        return icons[type] || '🤖';
    }

    function getTypeLabel(type) {
        const labels = {
            'narration': 'Code Narration', 'warning': 'Warning', 'suggestion': 'Suggestion',
            'explanation': 'Explanation', 'proactive-analysis': 'Proactive Analysis', 
            'performance': 'Performance Analysis', 'diagram': 'Code Flow'
        };
        return labels[type] || 'AI Mentor';
    }

    function updateStatus(status) {
        statusText.textContent = status;
        const indicator = document.querySelector('.status-indicator');
        if (indicator) {
            if (status.includes('error')) indicator.style.backgroundColor = 'var(--vscode-terminal-ansiRed)';
            else if (status.includes('warning')) indicator.style.backgroundColor = 'var(--vscode-terminal-ansiYellow)';
            else if (status.includes('Analyzing')) indicator.style.backgroundColor = 'var(--vscode-terminal-ansiBlue)';
            else indicator.style.backgroundColor = 'var(--vscode-terminal-ansiGreen)';
        }
    }

    function updateProfiles(profiles, activeProfileId, activeMentorName) {
        availableProfiles = profiles || [];
        
        if (mentorSelect) {
            mentorSelect.innerHTML = '';
            if (availableProfiles.length === 0) {
                mentorSelect.innerHTML = '<option value="">No mentor profiles available</option>';
                mentorSelect.disabled = true;
            } else {
                mentorSelect.disabled = false;
                availableProfiles.forEach(profile => {
                    const option = document.createElement('option');
                    option.value = profile.id;
                    option.textContent = profile.name;
                    option.selected = profile.id === activeProfileId;
                    mentorSelect.appendChild(option);
                });
            }
        }
        
        if (activeProfileId) {
            const activeProfile = availableProfiles.find(p => p.id === activeProfileId);
            if (activeProfile) {
                currentMentor.id = activeProfile.id;
                currentMentor.name = activeProfile.name;
                currentMentor.avatar = activeProfile.avatar || 'https://avatars.githubusercontent.com/u/60302907?v=4';
                currentMentor.personality = activeProfile.personality;
                
                if (mentorAvatar && activeProfile) {
                    const avatarUrl = activeProfile.githubUsername 
                        ? `https://avatars.githubusercontent.com/${activeProfile.githubUsername}?v=4`
                        : activeProfile.avatar || 'https://avatars.githubusercontent.com/u/60302907?v=4';
                    mentorAvatar.src = avatarUrl;
                    mentorAvatar.alt = `${activeProfile.name} Avatar`;
                }
                applyMentorTheme(activeProfile.personality);
            }
        }
        updateMentorName(activeMentorName || currentMentor.name);
    }

    function updateMentorName(mentorName) {
        const headerElement = document.querySelector('#mentorTitle');
        if (headerElement) headerElement.textContent = mentorName || 'AI Mentor';
        
        const welcomeMessage = document.querySelector('.welcome-message h3');
        if (welcomeMessage) {
            welcomeMessage.textContent = availableProfiles.length > 0 
                ? `👋 Welcome! I'm ${mentorName || 'AI Mentor'}`
                : '👋 Welcome to AI Mentor!';
        }
        updateStatus(`${mentorName || 'AI Mentor'} is ready to help`);
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatMessageContent(content) {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
    }

    function smoothScrollToBottom() {
        messagesContainer.scrollTo({
            top: messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }

    function addMentorPersonalityEffects(messageDiv, type) {
        if (currentMentor.personality) {
            const style = currentMentor.personality.communicationStyle;
            messageDiv.classList.add(`mentor-style-${style}`);
        }
    }

    // Interactive functions
    window.toggleMessageActions = function(id) {
        const menu = document.getElementById(`actions-${id}`);
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    window.applySuggestion = function(suggestion, idx) {
        vscode.postMessage({ type: 'applySuggestion', suggestion: suggestion, index: idx });
        updateStatus('Applying suggestion...');
    };

    window.dismissWarning = function(messageId, warningIdx) {
        const warningItem = document.querySelector(`[data-message-id="${messageId}"] .warning-item:nth-child(${warningIdx + 1})`);
        if (warningItem) {
            warningItem.style.opacity = '0.5';
            warningItem.style.textDecoration = 'line-through';
        }
    };

    // Initialize
    loadMermaid();
    updateMentorName('AI Mentor');
    updateStatus('AI Mentor is ready to help');
})();