import { computeRecipientAccessExpiry, mintRecipientAccessToken } from "../domain/recipient-access-token";
import type { SigningContext } from "./context";
import { sendEmail } from "@/shared/utils/resend";
import SignatureReminder from "@/shared/ui/emails/signature-reminder";
import prisma from "@/platform/db";
import { getPublicAppUrl } from "@/infrastructure/config/public-url";

export interface RemindRequestInput {
  teamId: string;
  requestId: string;
  recipientId: string;
}

export async function remindRequest(
  ctx: SigningContext,
  input: RemindRequestInput,
): Promise<void> {
  const request = await ctx.requests.findByTeamAndIdWithRecipients(
    input.teamId,
    input.requestId,
  );
  if (!request) {
    throw new Error("Signature request not found");
  }

  const recipient = request.recipients.find((r: any) => r.id === input.recipientId);
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
    type: "REMINDER",
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

  const signingUrl = `${getPublicAppUrl()}/signing/${request.id}?token=${encodeURIComponent(token)}`;

  // Load document name
  const doc = await prisma.document.findUnique({
    where: { id: request.documentId },
    select: { name: true },
  });
  const documentName = doc?.name ?? "Document";

  try {
    // 3. Send "Review & Sign" reminder email
    await sendEmail({
      to: recipient.email,
      subject: `Reminder: Please sign: ${documentName}`,
      react: SignatureReminder({
        senderName,
        senderEmail,
        documentName,
        url: signingUrl,
      }) as any,
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
      type: "REMINDER_SENT",
    });
  } catch (error: any) {
    // 5. Update delivery to FAILED
    await prisma.signatureDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "FAILED",
        failedReason: error?.message ?? String(error),
        lastAttemptAt: new Date(),
      },
    });

    throw error;
  }
}
