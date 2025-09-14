export interface Interaction {
    mentorId: string;
    timestamp: Date;
    type: 'advice_request' | 'advice_provided' | 'advice_accepted' | 'advice_rejected' | 'hover' | 'code_changed';
    data: any;
}

class InteractionTrackerService {
    private interactions: Interaction[] = [];
    private lastHoverAt: Map<string, Date> = new Map();

    public logInteraction(interaction: Interaction) {
        this.interactions.push(interaction);
    }

    public getInteractionsForMentor(mentorId: string): Interaction[] {
        return this.interactions.filter(interaction => interaction.mentorId === mentorId);
    }

    public clearInteractionsForMentor(mentorId: string) {
        this.interactions = this.interactions.filter(interaction => interaction.mentorId !== mentorId);
    }

    public generateSummary(mentorId: string): string {
        return this.generateSummaryText(mentorId);
    }

    public logHover(mentorId: string, data: any) {
        const now = new Date();
        this.lastHoverAt.set(mentorId, now);
        this.logInteraction({ mentorId, timestamp: now, type: 'hover', data });
    }

    public logCodeChange(mentorId: string | null | undefined, data: any) {
        if (!mentorId) return;
        const now = new Date();
        const last = this.lastHoverAt.get(mentorId);
        const withinHoverWindow = last ? (now.getTime() - last.getTime()) <= 2 * 60 * 1000 : false;
        this.logInteraction({ mentorId, timestamp: now, type: 'code_changed', data: { ...data, relatedToHover: withinHoverWindow } });
    }

    public generateSummaryText(mentorId: string): string {
        const items = this.getInteractionsForMentor(mentorId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        if (items.length === 0) return 'No interactions recorded for this session.';

        const lines: string[] = [];
        lines.push(`Summary of interactions with your AI likeness (${mentorId}):`);
        lines.push('');

        // Advice requests and responses
        const requests = items.filter(i => i.type === 'advice_request');
        const responses = items.filter(i => i.type === 'advice_provided');
        const hovers = items.filter(i => i.type === 'hover');
        const changes = items.filter(i => i.type === 'code_changed');

        if (requests.length) {
            lines.push('— Advice Requests —');
            requests.forEach(i => lines.push(`[${i.timestamp.toLocaleTimeString()}] request: ${JSON.stringify(i.data, null, 2)}`));
            lines.push('');
        }

        if (responses.length) {
            lines.push('— Mentor Responses —');
            responses.forEach(i => lines.push(`[${i.timestamp.toLocaleTimeString()}] response: ${JSON.stringify(i.data, null, 2)}`));
            lines.push('');
        }

        if (hovers.length) {
            lines.push('— Hover Insights —');
            hovers.forEach(i => {
                const d = i.data || {};
                const sugg = Array.isArray(d.suggestions) ? d.suggestions.slice(0, 5) : [];
                lines.push(`[${i.timestamp.toLocaleTimeString()}] ${d.fileName || ''}:${(d.position?.line ?? 0) + 1}:${(d.position?.character ?? 0) + 1} on '${d.word || ''}'`);
                if (sugg.length) {
                    sugg.forEach(s => lines.push(`  • ${s}`));
                }
            });
            lines.push('');
        }

        if (changes.length) {
            lines.push('— Code Changes After Hovers —');
            changes.forEach(i => {
                const d = i.data || {};
                const tag = d.relatedToHover ? 'related to recent hover' : 'unrelated';
                lines.push(`[${i.timestamp.toLocaleTimeString()}] ${d.fileName || ''} +${d.addedLines || 0}/-${d.removedLines || 0} (${tag})`);
            });
            lines.push('');
        }

        return lines.join('\n');
    }

    public generateSummaryHtml(mentorId: string, mentorName?: string): string {
        const items = this.getInteractionsForMentor(mentorId).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        if (items.length === 0) return `<p>No interactions recorded for this session.</p>`;

        const requests = items.filter(i => i.type === 'advice_request');
        const responses = items.filter(i => i.type === 'advice_provided');
        const hovers = items.filter(i => i.type === 'hover');
        const changes = items.filter(i => i.type === 'code_changed');

        const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        const section = (title: string, body: string) => `
            <h3 style="margin:16px 0 8px;">${esc(title)}</h3>
            ${body}
        `;

        const li = (content: string) => `<li>${content}</li>`;

        let html = `<h2>Session Summary for ${esc(mentorName || mentorId)}</h2>`;

        if (requests.length) {
            html += section('Advice Requests', `<ul>${requests.map(i => li(`<code>[${i.timestamp.toLocaleTimeString()}]</code> ${esc(JSON.stringify(i.data))}`)).join('')}</ul>`);
        }
        if (responses.length) {
            html += section('Mentor Responses', `<ul>${responses.map(i => li(`<code>[${i.timestamp.toLocaleTimeString()}]</code> ${esc(JSON.stringify(i.data))}`)).join('')}</ul>`);
        }
        if (hovers.length) {
            const itemsHtml = hovers.map(i => {
                const d = i.data || {};
                const sugg = Array.isArray(d.suggestions) ? d.suggestions.slice(0, 5) : [];
                const header = `<code>[${i.timestamp.toLocaleTimeString()}]</code> ${esc(d.fileName || '')}:${(d.position?.line ?? 0) + 1}:${(d.position?.character ?? 0) + 1} on '${esc(d.word || '')}'`;
                const list = sugg.length ? `<ul>${sugg.map((s: string) => li(esc(s))).join('')}</ul>` : '';
                return li(`${header}${list}`);
            }).join('');
            html += section('Hover Insights', `<ul>${itemsHtml}</ul>`);
        }
        if (changes.length) {
            const itemsHtml = changes.map(i => {
                const d = i.data || {};
                const tag = d.relatedToHover ? 'related to recent hover' : 'unrelated';
                return li(`<code>[${i.timestamp.toLocaleTimeString()}]</code> ${esc(d.fileName || '')} +${d.addedLines || 0}/-${d.removedLines || 0} (${tag})`);
            }).join('');
            html += section('Code Changes After Hovers', `<ul>${itemsHtml}</ul>`);
        }

        return html;
    }
}

export const interactionTracker = new InteractionTrackerService();
