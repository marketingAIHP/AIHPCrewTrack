import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
  }>;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    console.log('Attempting to send email:', {
      to: params.to,
      from: params.from,
      subject: params.subject,
      hasHtml: !!params.html,
      hasText: !!params.text
    });

    const emailData: any = {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || 'Please view this email in HTML format to see the attendance report.',
      html: params.html || '',
    };

    if (params.attachments && params.attachments.length > 0) {
      emailData.attachments = params.attachments;
    }

    const result = await mailService.send(emailData);

    console.log('SendGrid response:', result);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    
    // Log detailed error information
    if (error && typeof error === 'object' && 'response' in error) {
      const sgError = error as any;
      console.error('SendGrid error details:', {
        statusCode: sgError.code,
        body: sgError.response?.body,
        headers: sgError.response?.headers
      });
    }
    
    return false;
  }
}