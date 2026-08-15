import { computeRecipientAccessExpiry, mintRecipientAccessToken } from "../domain/recipient-access-token";
import type { SigningContext } from "./context";
import { sendEmail } from "@/shared/utils/resend";
import SignatureInvitation from "@/shared/ui/emails/signature-invitation";
import SignatureCompletion from "@/shared/ui/emails/signature-completion";
import prisma from "@/platform/db";

export interface DeliverRequestInput {
  requestId: string;
  recipientId: string;
}

export async function deliverSignatureRequest(
  ctx: SigningContext,
  input: DeliverRequestInput,
): Promise<void> {
  const request = await ctx.requests.findByIdWithRecipients(input.requestId);
  if (!request) {
    throw new Error("Signature request not found");
  }

  const recipient = request.recipients.find((r) => r.id === input.recipientId);
  if (!recipient || !recipient.email) {
    throw new Error("Recipient not found or email is empty");
  }

  // Load team/owner to get the sender's info
  const team = await prisma.team.findUnique({
    where: { id: request.teamId },
    select: { name: true },
  });

  const senderName = team?.name ?? "Dossier User";
  const senderEmail = "system@dossier.com";

  // 1. Record PENDING delivery
  const delivery = await ctx.requests.createDelivery({
    signatureRequestId: request.id,
    recipientId: recipient.id,
    type: "INVITATION",
    status: "PENDING",
  });

  // 2. Generate secure recipient token
  const tokenExpiry = computeRecipientAccessExpiry({
    requestExpiresAt: request.expiresAt,
  });

  const token = mintRecipientAccessToken({
    signatureRequestId: request.id,
    recipientId: recipient.id,
    expiresAt: tokenExpiry,
  });

  const signingUrl = `${process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000"}/signing/${request.id}?token=${encodeURIComponent(token)}`;

  // Load document name
  const doc = await prisma.document.findUnique({
    where: { id: request.documentId },
    select: { name: true },
  });
  const documentName = doc?.name ?? "Document";

  try {
    // 3. Send "Review & Sign" email
    await sendEmail({
      to: recipient.email,
      subject: `Review and sign: ${documentName}`,
      react: SignatureInvitation({
        senderName,
        senderEmail,
        documentName,
        url: signingUrl,
      }),
      system: true,
    });

    // 4. Update delivery to SENT & update recipient/request status if needed
    await prisma.signatureDelivery.update({
      where: { id: delivery.id },
      data: { status: "SENT", lastAttemptAt: new Date() },
    });

    await ctx.requests.createActivity({
      signatureRequestId: request.id,
      recipientId: recipient.id,
      type: "INVITATION_SENT",
    });

    // Update recipient status to pending/sent and request status to SENT
    if (request.status === "READY") {
      await ctx.requests.updateStatus(request.id, "SENT", { sentAt: new Date() });
    }
  } catch (error: any) {
    // 5. Update delivery to FAILED and log activity
    await prisma.signatureDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedReason: error?.message ?? String(error),
        lastAttemptAt: new Date(),
      },
    });

    await ctx.requests.createActivity({
      signatureRequestId: request.id,
      recipientId: recipient.id,
      type: "INVITATION_FAILED",
      metadata: { error: error?.message ?? String(error) },
    });

    throw error;
  }
}

export async function deliverCompletionEmail(
  ctx: SigningContext,
  requestId: string,
): Promise<void> {
  const request = await ctx.requests.findByIdWithRecipients(requestId);
  if (!request) {
    throw new Error("Signature request not found");
  }

  // Load document name
  const doc = await prisma.document.findUnique({
    where: { id: request.documentId },
    select: { name: true },
  });
  const documentName = doc?.name ?? "Document";

  // Create completion URL (viewer link to download signed doc)
  const downloadUrl = `${process.env.NEXT_PUBLIC_MARKETING_URL ?? "http://localhost:3000"}/signing/${request.id}`;

  // Find all recipient emails
  const emails = request.recipients
    .map((r) => r.email)
    .filter((email): email is string => !!email);

  // Send completion email to all signers
  for (const email of emails) {
    try {
      const recipient = request.recipients.find((r) => r.email === email);
      const delivery = await ctx.requests.createDelivery({
        signatureRequestId: request.id,
        recipientId: recipient?.id ?? null,
        type: "COMPLETION",
        status: "PENDING",
      });

      await sendEmail({
        to: email,
        subject: `Completed: ${documentName}`,
        react: SignatureCompletion({
          documentName,
          url: downloadUrl,
        }),
        system: true,
      });

      await prisma.signatureDelivery.update({
        where: { id: delivery.id },
        data: { status: "SENT", lastAttemptAt: new Date() },
      });
    } catch (error: any) {
      console.error(`Failed to send completion email to ${email}:`, error);
    }
  }

  // Log activity
  await ctx.requests.createActivity({
    signatureRequestId: request.id,
    type: "REQUEST_COMPLETED",
  });
}
