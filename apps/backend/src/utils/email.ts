import nodemailer from "nodemailer";

interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log(`[EMAIL SIMULATED] No SMTP configuration found.
To: ${to}
Subject: ${subject}
Message: ${text}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: `"Nova Royale" <${user}>`,
      to,
      subject,
      text,
      html,
    });
    console.log(`[EMAIL SENT] Message sent to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`[EMAIL ERROR] Failed to send email to ${to}:`, error);
  }
}
