import express from 'express';
import cors from 'cors';
import path from 'path';
import { ProfileManager } from './profileManager';

export class VapiServer {
    private app: express.Express;
    private server: any;
    private profileManager: ProfileManager;
    private messageContext: any;

    constructor(profileManager: ProfileManager, messageContext: any) {
        this.profileManager = profileManager;
        this.app = express();
        this.setupServer();
        this.messageContext = messageContext;
    }

    private setupServer() {
        this.app.use(express.json());
        this.app.use(cors());
        
        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../vapi-client')));

        // Endpoint to get mentor data
        this.app.get('/mentor-data', (_req, res) => {
            const activeProfile = this.profileManager.getActiveProfile();
            if (!activeProfile) {
                return res.status(404).json({ error: 'No active mentor profile' });
            }

            // Format mentor data for VAPI
            const mentorData = {
                mentorName: activeProfile.name,
                context: this.formatMentorContext(activeProfile),
                avatar: activeProfile.avatar,
            };

            res.json(mentorData);
        });
    }

    private formatMentorContext(profile: any): string {
        return `Personality Traits:
        - Communication Style: ${profile.personality.communicationStyle}
        - Feedback Approach: ${profile.personality.feedbackApproach}
        - Areas of Expertise: ${profile.personality.expertise.join(', ')}
        - GitHub Insights: ${JSON.stringify(profile.githubInsights)}

        Voice & Style:
        - Speaks like ${profile.name}, a renowned developer known for ${profile.personality.expertise[0]}
        - Uses ${profile.personality.communicationStyle} communication style
        - Maintains coding standards aligned with their GitHub profile
        - Provides feedback in a ${profile.personality.feedbackApproach} manner

        The User(Mentee) has intiated this conversation regarding the following code context:
        - ${this.messageContext || 'The user has not provided any code context yet.'}
        `;
    }

    public start(port: number = 3000): Promise<number> {
        return new Promise((resolve) => {
            this.server = this.app.listen(port, () => {
                console.log(`VAPI server running on port ${port}`);
                resolve(port);
            });
        });
    }

    public stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => resolve());
            } else {
                resolve();
            }
        });
    }
}