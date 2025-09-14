import * as vscode from 'vscode';

export interface MentorDiagnostic {
    range: vscode.Range;
    message: string;
    severity: vscode.DiagnosticSeverity;
    source: string;
    mentorId: string;
    mentorName: string;
    mentorAvatar: string;
    confidence?: number;
    suggestions?: string[];
}

export class DiagnosticsManager {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private mentorDiagnostics = new Map<string, MentorDiagnostic[]>();

    constructor() {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('aiMentor');
    }

    public getCollection(): vscode.DiagnosticCollection {
        return this.diagnosticCollection;
    }

    public addMentorDiagnostics(
        document: vscode.TextDocument,
        aiResponse: any,
        mentorProfile: any,
        analysisData: any
    ) {
        const diagnostics: vscode.Diagnostic[] = [];
        const mentorDiags: MentorDiagnostic[] = [];

        // Create diagnostics from AI warnings with smart line detection
        if (aiResponse.warnings) {
            aiResponse.warnings.forEach((warning: string) => {
                const range = this.findRelevantRange(document, warning, analysisData);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `${mentorProfile.name}: ${warning}`,
                    vscode.DiagnosticSeverity.Warning
                );
                diagnostic.source = 'AI Mentor';
                diagnostics.push(diagnostic);

                mentorDiags.push({
                    range,
                    message: warning,
                    severity: vscode.DiagnosticSeverity.Warning,
                    source: 'AI Mentor',
                    mentorId: mentorProfile.id,
                    mentorName: mentorProfile.name,
                    mentorAvatar: mentorProfile.avatar || '🤖',
                    confidence: aiResponse.confidence,
                    suggestions: aiResponse.suggestions
                });
            });
        }

        // Create diagnostics from AI suggestions
        if (aiResponse.suggestions) {
            aiResponse.suggestions.forEach((suggestion: string) => {
                const range = this.findRelevantRange(document, suggestion, analysisData);
                const diagnostic = new vscode.Diagnostic(
                    range,
                    `${mentorProfile.name}: ${suggestion}`,
                    vscode.DiagnosticSeverity.Information
                );
                diagnostic.source = 'AI Mentor';
                diagnostics.push(diagnostic);

                mentorDiags.push({
                    range,
                    message: suggestion,
                    severity: vscode.DiagnosticSeverity.Information,
                    source: 'AI Mentor',
                    mentorId: mentorProfile.id,
                    mentorName: mentorProfile.name,
                    mentorAvatar: mentorProfile.avatar || '🤖',
                    confidence: aiResponse.confidence,
                    suggestions: aiResponse.suggestions
                });
            });
        }

        // Store mentor diagnostics for hover provider
        this.mentorDiagnostics.set(document.uri.toString(), mentorDiags);

        // Set VS Code diagnostics
        this.diagnosticCollection.set(document.uri, diagnostics);
    }

    private findRelevantRange(document: vscode.TextDocument, message: string, analysisData: any): vscode.Range {
        // Try to find the most relevant line based on the message content and analysis data
        const messageWords = message.toLowerCase().split(' ');
        
        // Check for specific patterns in the message
        if (message.includes('infinite loop') || message.includes('while')) {
            const whileLineIndex = this.findLineContaining(document, 'while');
            if (whileLineIndex !== -1) {
                return new vscode.Range(whileLineIndex, 0, whileLineIndex, document.lineAt(whileLineIndex).text.length);
            }
        }

        if (message.includes('null') || message.includes('undefined') || message.includes('arr.length')) {
            const arrLineIndex = this.findLineContaining(document, '.length');
            if (arrLineIndex !== -1) {
                return new vscode.Range(arrLineIndex, 0, arrLineIndex, document.lineAt(arrLineIndex).text.length);
            }
        }

        if (message.includes('semicolon')) {
            const noSemicolonLine = this.findLineWithoutSemicolon(document);
            if (noSemicolonLine !== -1) {
                const line = document.lineAt(noSemicolonLine);
                return new vscode.Range(noSemicolonLine, line.text.length, noSemicolonLine, line.text.length);
            }
        }

        // Try to find lines mentioned in the diff
        if (analysisData?.diff) {
            for (const change of analysisData.diff) {
                if (change.added) {
                    const addedLineIndex = this.findLineContaining(document, change.value.trim().split('\n')[0]);
                    if (addedLineIndex !== -1) {
                        return new vscode.Range(addedLineIndex, 0, addedLineIndex, document.lineAt(addedLineIndex).text.length);
                    }
                }
            }
        }

        // Fallback to first non-empty line
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.trim().length > 0) {
                return new vscode.Range(i, 0, i, line.text.length);
            }
        }

        // Ultimate fallback
        return new vscode.Range(0, 0, 0, 0);
    }

    private findLineContaining(document: vscode.TextDocument, searchText: string): number {
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            if (line.text.includes(searchText)) {
                return i;
            }
        }
        return -1;
    }

    private findLineWithoutSemicolon(document: vscode.TextDocument): number {
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const text = line.text.trim();
            if ((text.includes('return') || text.includes('let') || text.includes('const')) && 
                !text.endsWith(';') && text.length > 0) {
                return i;
            }
        }
        return -1;
    }

    public getMentorDiagnosticsAt(document: vscode.TextDocument, position: vscode.Position): MentorDiagnostic[] {
        const diagnostics = this.mentorDiagnostics.get(document.uri.toString()) || [];
        return diagnostics.filter(diag => diag.range.contains(position));
    }

    public clearDiagnostics(uri: vscode.Uri) {
        this.diagnosticCollection.delete(uri);
        this.mentorDiagnostics.delete(uri.toString());
    }

    public dispose() {
        this.diagnosticCollection.dispose();
        this.mentorDiagnostics.clear();
    }
}
