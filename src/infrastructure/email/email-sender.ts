// EmailSender: abstraction over email transport (Resend or SMTP).
// Production must never silently treat console/mock email as SENT.
// Every call either resolves with a messageId or throws.

import type { ReactElement } from "react";
import nodemailer from "nodemailer";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<{
    messageId: string | null;
  }>;
}

function emailTransport(): "resend" | "smtp" | "console" {
  const configured =
    process.env.EMAIL_TRANSPORT?.trim().toLowerCase();

  if (configured === "resend") return "resend";
  if (configured === "smtp") return "smtp";

  if (process.env.RESEND_API_KEY) {
    return "resend";
  }

  if (process.env.SMTP_HOST) {
    return "smtp";
  }

  return "console";
}

export const emailSender: EmailSender = {
  async send(message) {
    const transport = emailTransport();

    if (
      transport === "console" &&
      process.env.NODE_ENV === "production"
    ) {
      throw new Error(
        "No production email transport configured.",
      );
    }

    if (transport === "console") {
      console.log(
        `[EMAIL] ${message.to}: ${message.subject}`,
      );

      return {
        messageId: "console",
      };
    }

    const html = await render(message.react);
    const text = toPlainText(html);

    const from =
      process.env.EMAIL_FROM ??
      "Dossier <noreply@example.com>";

    if (transport === "resend") {
      const apiKey = process.env.RESEND_API_KEY;

      if (!apiKey) {
        throw new Error(
          "RESEND_API_KEY is required.",
        );
      }

      const resend = new Resend(apiKey);

      const result = await resend.emails.send(
        {
          from,
          to: message.to,
          subject: message.subject,
          html,
          text,
        },
        {
          idempotencyKey: message.idempotencyKey,
        },
      );

      if (result.error) {
        throw new Error(result.error.message);
      }

      return {
        messageId: result.data?.id ?? null,
      };
    }

    if (!process.env.SMTP_HOST) {
      throw new Error(
        "SMTP_HOST is required.",
      );
    }

    const transporter =
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,

        port: Number(
          process.env.SMTP_PORT ?? "587",
        ),

        secure:
          process.env.SMTP_SECURE === "true",

        auth: process.env.SMTP_USER
          ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASSWORD,
            }
          : undefined,
      });

    const result = await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      html,
      text,
    });

    return {
      messageId: result.messageId ?? null,
    };
  },
};