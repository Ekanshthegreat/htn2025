(function() {
    const vscode = acquireVsCodeApi();
    
    // DOM elements
    const messagesContainer = document.getElementById('messages');
    const clearBtn = document.getElementById('clearBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
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

    analyzeBtn.addEventListener('click', () => {
        console.log('Analyze button clicked');
        vscode.postMessage({ type: 'analyzeCode' });
        updateStatus('Analyzing your code with AI...');
    });

    // Enhanced mentor dropdown selection
    mentorSelect.addEventListener('change', (e) => {
        const mentorId = e.target.value;
        if (mentorId && mentorId !== currentMentor.id && availableProfiles.length > 0) {
            const selectedProfile = availableProfiles.find(p => p.id === mentorId);
            if (selectedProfile) {
                currentMentor.id = selectedProfile.id;
                currentMentor.name = selectedProfile.name;
                currentMentor.avatar = selectedProfile.avatar || '🤖';
                currentMentor.personality = selectedProfile.personality;
                
                vscode.postMessage({ 
                    type: 'switchProfile', 
                    profileId: mentorId 
                });
                
                updateStatus(`${currentMentor.name} is ready to help`);
                applyMentorTheme(selectedProfile.personality);
            }
        }
    });

    // Enhanced message handling with consolidated mentor messages
    window.addEventListener('message', event => {
        const message = event.data;
        console.log('=== WEBVIEW RECEIVED MESSAGE ===');
        console.log('Message type:', message.type);
        console.log('Message data:', message);
        
        switch (message.type) {
            case 'updateMessages':
                console.log('Processing legacy updateMessages with', message.messages?.length || 0, 'messages');
                hideTypingIndicator();
                displayMessages(message.messages);
                break;
            case 'updateConsolidatedMessages':
                console.log('Processing consolidated messages with', message.messages?.length || 0, 'messages');
                hideTypingIndicator();
                displayConsolidatedMessages(message.messages);
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
        console.log('=== displayMessages called (legacy) ===');
        console.log('Messages array:', messages);
        console.log('Messages length:', messages?.length || 0);
        console.log('Messages container exists:', !!messagesContainer);
        
        if (!messages || messages.length === 0) {
            console.log('No messages to display');
            return;
        }

        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg && messages.length > 0) {
            console.log('Hiding welcome message');
            welcomeMsg.style.opacity = '0';
            setTimeout(() => welcomeMsg?.remove(), 300);
        }

        messages.forEach((msg, index) => {
            console.log(`Processing message ${index}:`, msg);
            if (!document.querySelector(`[data-message-id="${index}"]`)) {
                console.log(`Adding new message ${index}`);
                addMessage(msg, index);
                conversationContext.push({
                    type: msg.type,
                    message: msg.message,
                    timestamp: Date.now()
                });
            } else {
                console.log(`Message ${index} already exists, skipping`);
            }
        });

        smoothScrollToBottom();
        updateStatus(`${currentMentor.name} is ready to help`);
    }

    function displayConsolidatedMessages(messages) {
        console.log('=== displayConsolidatedMessages called ===');
        console.log('Consolidated messages array:', messages);
        
        if (!messages || messages.length === 0) {
            console.log('No consolidated messages to display');
            return;
        }

        const welcomeMsg = messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg && messages.length > 0) {
            console.log('Hiding welcome message for consolidated view');
            welcomeMsg.style.opacity = '0';
            setTimeout(() => welcomeMsg?.remove(), 300);
        }

        messages.forEach((msg, index) => {
            console.log(`Processing consolidated message ${index}:`, msg);
            if (!document.querySelector(`[data-consolidated-id="${msg.id}"]`)) {
                console.log(`Adding new consolidated message ${msg.id}`);
                addConsolidatedMessage(msg);
                conversationContext.push({
                    type: 'consolidated',
                    message: msg.message,
                    mentorName: msg.mentorName,
                    timestamp: Date.now()
                });
            } else {
                console.log(`Consolidated message ${msg.id} already exists, skipping`);
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

    function addConsolidatedMessage(msg) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message consolidated priority-${msg.priority}`;
        messageDiv.setAttribute('data-consolidated-id', msg.id);
        messageDiv.style.opacity = '0';
        messageDiv.style.transform = 'translateY(20px)';

        const timestamp = new Date(msg.timestamp).toLocaleTimeString();
        const analysisTypeIcons = {
            'pattern': '🔍',
            'ast': '🌳', 
            'ai': '🤖'
        };
        
        const analysisTypesHtml = msg.analysisTypes.map(type => 
            `<span class="analysis-type ${type}" title="${type.toUpperCase()} Analysis">${analysisTypeIcons[type]}</span>`
        ).join('');

        let html = `
            <div class="consolidated-message-header">
                <div class="mentor-info-inline">
                    <img class="mentor-avatar-small" src="${msg.mentorAvatar}" alt="${msg.mentorName}" onerror="this.src='https://avatars.githubusercontent.com/u/60302907?v=4'" />
                    <div class="mentor-details-inline">
                        <span class="mentor-name">${msg.mentorName}</span>
                        <div class="analysis-types">${analysisTypesHtml}</div>
                    </div>
                </div>
                <div class="message-meta">
                    <span class="confidence-badge confidence-${msg.confidence >= 0.9 ? 'high' : msg.confidence >= 0.7 ? 'medium' : 'low'}">
                        ${Math.round(msg.confidence * 100)}%
                    </span>
                    <span class="timestamp">${timestamp}</span>
                    <button class="message-actions" onclick="toggleConsolidatedActions('${msg.id}')">⋯</button>
                </div>
            </div>
            <div class="consolidated-message-content">
                <div class="main-message">${formatMessageContent(msg.message)}</div>
        `;

        // Pattern Analysis Section
        if (msg.patternAnalysis && (msg.patternAnalysis.issues.length > 0 || msg.patternAnalysis.suggestions.length > 0)) {
            html += `<div class="analysis-section pattern-analysis">
                <h4><span class="analysis-icon">🔍</span> Pattern Analysis</h4>`;
            
            if (msg.patternAnalysis.issues.length > 0) {
                html += '<div class="issues-list">';
                msg.patternAnalysis.issues.forEach((issue, idx) => {
                    html += `<div class="issue-item severity-${issue.severity}">
                        <span class="issue-type">${issue.type}</span>
                        <span class="issue-message">${escapeHtml(issue.message)}</span>
                        ${issue.line ? `<span class="issue-line">Line ${issue.line}</span>` : ''}
                    </div>`;
                });
                html += '</div>';
            }
            
            if (msg.patternAnalysis.suggestions.length > 0) {
                html += '<div class="pattern-suggestions">';
                msg.patternAnalysis.suggestions.forEach((suggestion, idx) => {
                    html += `<div class="suggestion-item pattern" onclick="applySuggestion('${escapeHtml(suggestion)}', ${idx})">
                        <span class="suggestion-text">${escapeHtml(suggestion)}</span>
                        <span class="suggestion-apply">Apply</span>
                    </div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
        }

        // AST Analysis Section
        if (msg.astAnalysis) {
            html += `<div class="analysis-section ast-analysis">
                <h4><span class="analysis-icon">🌳</span> AST Analysis</h4>
                <div class="ast-metrics">
                    <div class="metric">
                        <span class="metric-label">Complexity:</span>
                        <span class="metric-value complexity-${msg.astAnalysis.complexity < 5 ? 'low' : msg.astAnalysis.complexity < 10 ? 'medium' : 'high'}">${msg.astAnalysis.complexity}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Functions:</span>
                        <span class="metric-value">${msg.astAnalysis.codeFlow.length}</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Variables:</span>
                        <span class="metric-value">${msg.astAnalysis.dataDependencies.length}</span>
                    </div>
                </div>`;
            
            if (msg.astAnalysis.issues.length > 0) {
                html += '<div class="ast-issues">';
                msg.astAnalysis.issues.forEach((issue, idx) => {
                    html += `<div class="ast-issue-item">
                        <span class="issue-type">${issue.type}</span>
                        <span class="issue-message">${escapeHtml(issue.message)}</span>
                        <span class="issue-confidence">${Math.round(issue.confidence * 100)}%</span>
                    </div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
        }

        // AI Analysis Section
        if (msg.aiAnalysis && (msg.aiAnalysis.insights.length > 0 || msg.aiAnalysis.suggestions.length > 0 || msg.aiAnalysis.warnings.length > 0)) {
            html += `<div class="analysis-section ai-analysis">
                <h4><span class="analysis-icon">🤖</span> AI Analysis</h4>`;
            
            if (msg.aiAnalysis.insights.length > 0) {
                html += '<div class="ai-insights"><h5>💡 Insights:</h5><ul>';
                msg.aiAnalysis.insights.forEach(insight => {
                    html += `<li class="insight-item">${escapeHtml(insight)}</li>`;
                });
                html += '</ul></div>';
            }
            
            if (msg.aiAnalysis.suggestions.length > 0) {
                html += '<div class="ai-suggestions"><h5>🔧 AI Suggestions:</h5>';
                msg.aiAnalysis.suggestions.forEach((suggestion, idx) => {
                    html += `<div class="suggestion-item ai" onclick="applySuggestion('${escapeHtml(suggestion)}', ${idx})">
                        <span class="suggestion-text">${escapeHtml(suggestion)}</span>
                        <span class="suggestion-apply">Apply</span>
                    </div>`;
                });
                html += '</div>';
            }
            
            if (msg.aiAnalysis.warnings.length > 0) {
                html += '<div class="ai-warnings"><h5>⚠️ Warnings:</h5>';
                msg.aiAnalysis.warnings.forEach((warning, idx) => {
                    html += `<div class="warning-item ai">
                        <span class="warning-text">${escapeHtml(warning)}</span>
                        <button class="warning-dismiss" onclick="dismissConsolidatedWarning('${msg.id}', ${idx})">Dismiss</button>
                    </div>`;
                });
                html += '</div>';
            }
            
            if (msg.aiAnalysis.codeSnippets && msg.aiAnalysis.codeSnippets.length > 0) {
                html += '<div class="code-snippets"><h5>📝 Code Examples:</h5>';
                msg.aiAnalysis.codeSnippets.forEach((snippet, idx) => {
                    html += `<div class="code-snippet">
                        <div class="snippet-header">
                            <span class="snippet-language">${snippet.language}</span>
                            ${snippet.explanation ? `<span class="snippet-explanation">${escapeHtml(snippet.explanation)}</span>` : ''}
                        </div>
                        <pre class="snippet-code"><code class="language-${snippet.language}">${escapeHtml(snippet.code)}</code></pre>
                    </div>`;
                });
                html += '</div>';
            }
            
            html += '</div>';
        }

        html += '</div>'; // Close consolidated-message-content

        messageDiv.innerHTML = html;
        messagesContainer.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.style.opacity = '1';
            messageDiv.style.transform = 'translateY(0)';
        }, 100);

        // Apply mentor personality styling
        if (msg.mentorId && availableProfiles.length > 0) {
            const profile = availableProfiles.find(p => p.id === msg.mentorId);
            if (profile && profile.personality) {
                messageDiv.classList.add(`mentor-style-${profile.personality.communicationStyle}`);
            }
        }
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
                    
                    // Enhanced option text with GitHub info
                    let displayText = profile.name;
                    if (profile.githubUsername) {
                        displayText += ` (@${profile.githubUsername})`;
                    }
                    
                    option.textContent = displayText;
                    option.selected = profile.id === activeProfileId;
                    
                    // Store avatar data for later use
                    if (profile.githubUsername) {
                        option.dataset.avatar = `https://github.com/${profile.githubUsername}.png?size=16`;
                    } else {
                        option.dataset.avatar = profile.avatar || '🤖';
                    }
                    option.dataset.githubUsername = profile.githubUsername || '';
                    
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
        console.log('Updating mentor name to:', mentorName);
        
        // Update only the header title text, not the avatar (avatar is handled separately)
        const headerElement = document.querySelector('#mentorTitle');
        if (headerElement) {
            headerElement.textContent = mentorName || 'AI Mentor';
        }
        
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

    // Enhanced utility functions
    function getMentorAvatar(mentorId) {
        if (!mentorId) return '🤖';
        
        const profile = availableProfiles.find(p => p.id === mentorId);
        if (profile && profile.githubUsername) {
            return `https://github.com/${profile.githubUsername}.png?size=24`;
        }
        return profile ? (profile.avatar || '🤖') : '🤖';
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
        const activeProfile = availableProfiles.find(p => p.id === currentMentor.id);
        let avatarHtml;
        if (activeProfile && activeProfile.githubUsername) {
            const avatarUrl = `https://github.com/${activeProfile.githubUsername}.png?size=24`;
            avatarHtml = `<img src="${avatarUrl}" class="mentor-avatar-img typing-avatar" alt="${currentMentor.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';"><span class="fallback-avatar" style="display:none;">🤖</span>`;
        } else {
            avatarHtml = `<span class="mentor-avatar">${currentMentor.avatar || '🤖'}</span>`;
        }
        
        typingIndicator.innerHTML = `
            <div class="typing-content">
                ${avatarHtml}
                <span class="typing-text">${currentMentor.name} is thinking...</span>
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;
        messagesContainer.appendChild(typingIndicator);
        typingIndicator.style.display = 'block';
        smoothScrollToBottom();
    }

    function hideTypingIndicator() {
        if (typingIndicator) {
            typingIndicator.remove();
            typingIndicator = null;
        }
    }

    function clearMessages() {
        const messages = messagesContainer.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        conversationContext = [];
    }

    function showMentorReaction(type) {
        // Add visual feedback for mentor actions
        const reaction = document.createElement('div');
        reaction.className = `mentor-reaction ${type}`;
        reaction.textContent = type === 'reset' ? '🔄' : '👋';
        document.body.appendChild(reaction);
        
        setTimeout(() => {
            reaction.remove();
        }, 2000);
    }

    function showMentorTransition(fromId, toId) {
        addSystemMessage(`Switching from ${fromId} to ${toId}...`);
    }

    function showVoiceIndicator(enabled) {
        const indicator = document.querySelector('.voice-indicator');
        if (indicator) {
            indicator.style.display = enabled ? 'block' : 'none';
        }
    }

    function updateMentorMood(mood) {
        mentorMood = mood;
        document.body.setAttribute('data-mentor-mood', mood);
    }

    function addHoverSuggestionMessage(suggestion) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message hover-suggestion';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-icon">💡</span>
                <span class="message-title">Hover Suggestion</span>
                <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${suggestion}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        smoothScrollToBottom();
    }

    function addCodeFlowDiagram(diagram) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message diagram';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-icon">📊</span>
                <span class="message-title">Code Flow Diagram</span>
                <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">
                <div class="mermaid">${diagram}</div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        
        if (mermaidLoaded) {
            mermaid.init(undefined, messageDiv.querySelector('.mermaid'));
        }
        
        smoothScrollToBottom();
    }

    function addPerformanceMetrics(metrics) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message performance';
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="message-icon">⚡</span>
                <span class="message-title">Performance Metrics</span>
                <span class="message-timestamp">${new Date().toLocaleTimeString()}</span>
            </div>
            <div class="message-content">
                <div class="metrics-grid">
                    ${Object.entries(metrics).map(([key, value]) => 
                        `<div class="metric"><span class="metric-label">${key}:</span><span class="metric-value">${value}</span></div>`
                    ).join('')}
                </div>
            </div>
        `;
        messagesContainer.appendChild(messageDiv);
        smoothScrollToBottom();
    }

    // Interactive functions
    window.toggleMessageActions = function(id) {
        const menu = document.getElementById(`actions-${id}`);
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    };

    window.toggleConsolidatedActions = function(id) {
        const menu = document.getElementById(`consolidated-actions-${id}`);
        if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
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