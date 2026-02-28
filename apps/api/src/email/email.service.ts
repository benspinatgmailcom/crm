import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly appBaseUrl: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!apiKey || !from || !appBaseUrl) {
      throw new Error(
        'EmailService requires RESEND_API_KEY, EMAIL_FROM, and APP_BASE_URL',
      );
    }
    this.resend = new Resend(apiKey);
    this.from = from;
    this.appBaseUrl = appBaseUrl;
  }

  async sendSetPasswordEmail(to: string, token: string): Promise<void> {
    const link = `${this.appBaseUrl}/set-password?token=${token}`;
    const subject = 'Set your password';
    const html = `
<h2>Welcome to Bespoke CRM</h2>
<p>Click below to set your password:</p>
<a href="${link}">${link}</a>
<p>This link expires in 1 hour.</p>
`.trim();
    const text = [
      'Welcome to Bespoke CRM',
      '',
      'Click below to set your password:',
      link,
      '',
      'This link expires in 1 hour.',
    ].join('\n');

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject,
      html,
      text,
    });

    if (error) {
      throw new Error(`Failed to send set-password email: ${error.message}`);
    }
  }
}
