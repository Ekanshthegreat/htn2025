import * as nodemailer from 'nodemailer';
import * as vscode from 'vscode';

class NotificationService {
    private transporter: nodemailer.Transporter | undefined;

    constructor() {
        // For demonstration, we'll use a test account from Ethereal.
        // In a real application, this should be configured securely via VS Code settings.
        this.setupTransporter();
    }

    public async setupTransporter() {
        try {
            const cfg = vscode.workspace.getConfiguration('aiMentor');
            const host = cfg.get<string>('smtpHost');
            const port = cfg.get<number>('smtpPort', 587);
            const secure = cfg.get<boolean>('smtpSecure', false);
            const user = cfg.get<string>('smtpUser');
            const pass = cfg.get<string>('smtpPass');

            console.log('=== SMTP Configuration Check ===');
            console.log('Host:', host || '(not set)');
            console.log('Port:', port);
            console.log('Secure:', secure);
            console.log('User:', user || '(not set)');
            console.log('Pass:', pass ? '***configured***' : '(not set)');

            if (host && user && pass) {
                console.log('✅ Using REAL SMTP - emails will be sent to actual recipients');
                this.transporter = nodemailer.createTransport({
                    host,
                    port,
                    secure,
                    auth: { user, pass }
                });
                console.log(`📧 SMTP configured: ${host}:${port} secure=${secure}`);
            } else {
                console.log('⚠️  Using ETHEREAL TEST - emails will NOT reach real recipients');
                console.log('Missing SMTP settings. Configure these in VS Code settings:');
                console.log('- aiMentor.smtpHost (e.g., smtp.gmail.com)');
                console.log('- aiMentor.smtpUser (your email)');
                console.log('- aiMentor.smtpPass (your app password)');
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
                console.log('📧 Ethereal configured for testing only');
            }
            console.log('=== End SMTP Configuration ===');
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

        const from = vscode.workspace.getConfiguration('aiMentor').get<string>('smtpFrom', '"AI Mentor Platform" <noreply@ai-mentor.com>')!;
        const mailOptions = {
            from,
            to: email,
            subject: `Summary of Your AI Likeness Usage`,
            text: `Hello ${mentorName},\n\nA developer has been interacting with your AI likeness. Here is a summary of their session:\n\n${summary}\n\nRegards,\nThe AI Mentor Team`,
            html: `<p>Hello ${mentorName},</p><p>A developer has been interacting with your AI likeness. Here is a summary of their session:</p><pre>${summary}</pre><p>Regards,<br>The AI Mentor Team</p>`,
        };

        try {
            console.log('=== Sending Email ===');
            console.log('To:', email);
            console.log('From:', from);
            console.log('Subject:', mailOptions.subject);
            const info = await this.transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('✅ Email sent successfully!');
            console.log('Message ID:', info.messageId);
            console.log('Response:', info.response);
            if (previewUrl) {
                console.log('📧 Ethereal Preview URL:', previewUrl);
            } else {
                console.log('📧 Real email sent - no preview URL (this is normal for real SMTP)');
            }
            console.log('=== End Email Send ===');
            return previewUrl || null;
        } catch (error) {
            console.error('❌ Email send failed:', error);
            console.error('Error details:', error.message);
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

        const from = vscode.workspace.getConfiguration('aiMentor').get<string>('smtpFrom', '"AI Mentor Platform" <noreply@ai-mentor.com>')!;
        const mailOptions = {
            from,
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
            console.log('=== Sending Rich Email ===');
            console.log('To:', email);
            console.log('From:', from);
            console.log('Subject:', mailOptions.subject);
            const info = await this.transporter.sendMail(mailOptions);
            const previewUrl = nodemailer.getTestMessageUrl(info);
            console.log('✅ Rich email sent successfully!');
            console.log('Message ID:', info.messageId);
            console.log('Response:', info.response);
            if (previewUrl) {
                console.log('📧 Ethereal Preview URL:', previewUrl);
            } else {
                console.log('📧 Real email sent - no preview URL (this is normal for real SMTP)');
            }
            console.log('=== End Rich Email Send ===');
            return previewUrl || 'success';
        } catch (error) {
            console.error('❌ Rich email send failed:', error);
            console.error('Error details:', error.message);
            return null;
        }
    }
}

export const notificationService = new NotificationService();
