import nodemailer from "nodemailer";
import { env } from "../config/env.js";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

const smtpEnabled = Boolean(env.smtp.host && env.smtp.from);
const transporter = smtpEnabled
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user
        ? { user: env.smtp.user, pass: env.smtp.password ?? "" }
        : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000
    })
  : null;

export async function sendEmail(message: EmailMessage) {
  if (process.env.NODE_ENV === "test" || !transporter || !env.smtp.from) {
    return { sent: false, reason: "SMTP is not configured" } as const;
  }

  try {
    await transporter.sendMail({ from: env.smtp.from, ...message });
    return { sent: true } as const;
  } catch (error) {
    console.error(`Failed to send email to ${message.to}`, error);
    return { sent: false, reason: "Не удалось отправить письмо" } as const;
  }
}
