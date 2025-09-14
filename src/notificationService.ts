import * as nodemailer from 'nodemailer';

class NotificationService {
    private transporter: nodemailer.Transporter | undefined;

    constructor() {
        // For demonstration, we'll use a test account from Ethereal.
        // In a real application, this should be configured securely via VS Code settings.
        this.setupTransporter();
    }

    private async setupTransporter() {
        try {
            // Generate test SMTP service account from ethereal.email
            const testAccount = await nodemailer.createTestAccount();

            // Create reusable transporter object
            this.transporter = nodemailer.createTransport({
                host: 'smtp.ethereal.email',
                port: 587,
                secure: false, // true for 465, false for other ports
                auth: {
                    user: testAccount.user, // generated ethereal user
                    pass: testAccount.pass, // generated ethereal password
                },
            });
            console.log('Nodemailer transporter configured with Ethereal.');
        } catch (error) {
            console.error('Failed to create Nodemailer test account:', error);
        }
    }

    public async sendSummary(email: string, summary: string, mentorName: string): Promise<string | null> {
        if (!this.transporter) {
            console.error('Transporter not initialized. Trying to set it up again.');
            await this.setupTransporter();
            if (!this.transporter) {
                console.error('Failed to initialize transporter. Cannot send email.');
                return null;
            }
        }

        const mailOptions = {
            from: '"AI Mentor Platform" <noreply@ai-mentor.com>',
            to: email,
            subject: `Summary of Your AI Likeness Usage`,
            text: `Hello ${mentorName},\n\nA developer has been interacting with your AI likeness. Here is a summary of their session:\n\n${summary}\n\nRegards,\nThe AI Mentor Team`,
            html: `<p>Hello ${mentorName},</p><p>A developer has been interacting with your AI likeness. Here is a summary of their session:</p><pre>${summary}</pre><p>Regards,<br>The AI Mentor Team</p>`,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('Message sent: %s', info.messageId);
            if (previewUrl) {
                console.log('Preview URL: %s', previewUrl);
            }
            return previewUrl || null;
        } catch (error) {
            console.error('Error sending email:', error);
            return null;
        }
    }

    public async sendSummaryRich(email: string, htmlSummary: string, mentorName: string): Promise<string | null> {
        if (!this.transporter) {
            console.error('Transporter not initialized. Trying to set it up again.');
            await this.setupTransporter();
            if (!this.transporter) {
                console.error('Failed to initialize transporter. Cannot send email.');
                return null;
            }
        }

        const mailOptions = {
            from: '"AI Mentor Platform" <noreply@ai-mentor.com>',
            to: email,
            subject: `Session Summary for Your AI Likeness`,
            text: `Hello ${mentorName},\n\nPlease view this email in an HTML-capable client.`,
            html: `
                <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #1f2937;">
                    <p>Hello ${mentorName},</p>
                    <p>A developer has been interacting with your AI likeness. Here is a summary of their session:</p>
                    <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background: #ffffff;">
                        ${htmlSummary}
                    </div>
                    <p style="margin-top:16px;">Regards,<br>The AI Mentor Team</p>
                </div>
            `,
        } as nodemailer.SendMailOptions;

        try {
            const info = await this.transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('Message sent: %s', info.messageId);
            if (previewUrl) {
                console.log('Preview URL: %s', previewUrl);
            }
            return previewUrl || null;
        } catch (error) {
            console.error('Error sending rich email:', error);
            return null;
        }
    }
}

export const notificationService = new NotificationService();
