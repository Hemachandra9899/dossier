import { JSXElementConstructor, ReactElement } from "react";

import { render, toPlainText } from "react-email";
import { Resend } from "resend";

import prisma from "@/shared/utils/prisma";
import { log, nanoid } from "@/shared/utils/utils";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

export const sendEmail = async ({
  to,
  subject,
  react,
  from,
  marketing,
  system,
  verify,
  test,
  cc,
  replyTo,
  scheduledAt,
  unsubscribeUrl,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  react: ReactElement<any, string | JSXElementConstructor<any>>;
  from?: string;
  marketing?: boolean;
  system?: boolean;
  verify?: boolean;
  test?: boolean;
  cc?: string | string[];
  replyTo?: string;
  scheduledAt?: string;
  unsubscribeUrl?: string;
  idempotencyKey?: string;
}) => {
  if (!resend) {
    console.log(`[MOCK EMAIL] to: ${to}, subject: ${subject}`);
    return { id: "mock-email-id" };
  }

  const html = await render(react);
  const plainText = toPlainText(html);

  const defaultFrom =
    process.env.RESEND_FROM_EMAIL || "Dossier <onboarding@resend.dev>";

  const fromAddress =
    from ??
    (process.env.RESEND_FROM_EMAIL
      ? process.env.RESEND_FROM_EMAIL
      : marketing
        ? "Dossier <onboarding@resend.dev>"
        : system
          ? "Dossier <onboarding@resend.dev>"
          : verify
            ? "Dossier <onboarding@resend.dev>"
            : defaultFrom);

  try {
    const { data, error } = await resend.emails.send(
      {
        from: fromAddress,
        to: test ? "delivered@resend.dev" : to,
        cc: cc,
        replyTo: marketing ? "marc@papermark.com" : replyTo,
        subject,
        react,
        scheduledAt,
        text: plainText,
        headers: {
          // Reusing an idempotency key with a changed payload is a 409, so the
          // ref id has to come from the key rather than a fresh nanoid.
          "X-Entity-Ref-ID": idempotencyKey ?? nanoid(),
          ...(unsubscribeUrl
            ? {
                "List-Unsubscribe": `<${unsubscribeUrl}>`,
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              }
            : {}),
        },
      },
      { idempotencyKey },
    );

    // Check if the email sending operation returned an error and throw it
    if (error) {
      log({
        message: `Resend returned error when sending email: ${error.name} \n\n ${error.message}`,
        type: "error",
        mention: true,
      });
      throw error;
    }

    // If there's no error, return the data
    return data;
  } catch (exception) {
    // Log and rethrow any caught exceptions for upstream handling
    log({
      message: `Unexpected error when sending email: ${exception}`,
      type: "error",
      mention: true,
    });
    throw exception; // Rethrow the caught exception
  }
};

export const subscribe = async (email: string): Promise<void> => {
  if (!resend) {
    console.error("RESEND_API_KEY is not set in the .env. Skipping.");
    return;
  }

  const { data, error } = await resend.contacts.create({
    email,
  });

  if (error || !data?.id) {
    console.error("Failed to create contact:", error);
    return;
  }

  if (
    process.env.NODE_ENV === "production" &&
    process.env.RESEND_MARKETING_SEGMENT_ID
  ) {
    await resend.contacts.segments.add({
      contactId: data.id,
      segmentId: process.env.RESEND_MARKETING_SEGMENT_ID as string,
    });
  }
};

export const unsubscribe = async (email: string): Promise<void> => {
  if (!resend) {
    console.error("RESEND_API_KEY is not set in the .env. Skipping.");
    return;
  }

  if (!email) {
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { email: true },
  });

  if (!user || !user.email) {
    return;
  }

  await resend.contacts.update({
    email: user.email,
    unsubscribed: true,
  });
};
