import { computeRecipientAccessExpiry, mintRecipientAccessToken } from "../domain/recipient-access-token";
import type { SigningContext } from "./context";
import SignatureInvitation from "@/shared/ui/emails/signature-invitation";
import SignatureCompletion from "@/shared/ui/emails/signature-completion";
import { getPublicAppUrl } from "@/infrastructure/config/public-url";

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

  const recipient = request.recipients.find((r: any) => r.id === input.recipientId);
  if (!recipient || !recipient.email) {
    throw new Error("Recipient not found or email is empty");
  }

  // Load team/owner to get the sender's info
  const team = await ctx.requests.findTeamName(request.teamId);

  const senderName = team?.name ?? "Dossier User";
  const senderEmail = "system@dossier.com";

  // 1. Record PENDING delivery
  const delivery = await ctx.deliveries.create({
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

  const signingUrl = `${getPublicAppUrl()}/signing/${request.id}?token=${encodeURIComponent(token)}`;

  const documentName = (await ctx.requests.findDocumentName(request.documentId))?.name ?? "Document";

  const deliverEmail = ctx.deliverEmail;

  try {
    // 3. Send "Review & Sign" email
    await deliverEmail({
      to: recipient.email,
      subject: `Review and sign: ${documentName}`,
      react: SignatureInvitation({
        senderName: senderName,
        senderEmail: senderEmail,
        documentName: documentName,
        url: signingUrl,
      }) as any,
      system: true,
    });

    // 4. Update delivery to SENT & update recipient/request status if needed
    await ctx.deliveries.updateStatus(delivery.id, {
      status: "SENT",
      lastAttemptAt: new Date(),
    });

    await ctx.activities.create({
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
    await ctx.deliveries.updateStatus(delivery.id, {
      status: "FAILED",
      failedReason: error?.message ?? String(error),
      lastAttemptAt: new Date(),
    });

    await ctx.activities.create({
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
  const doc = await ctx.requests.findDocumentName(request.documentId);
  const documentName = doc?.name ?? "Document";

  // Create completion URL (viewer link to download signed doc)
  const downloadUrl = `${getPublicAppUrl()}/signing/${request.id}`;

  const deliverEmail = ctx.deliverEmail;

  // Find all recipient emails
  const emails = request.recipients
    .map((r: any) => r.email)
    .filter((email: any): email is string => !!email);

  // Send completion email to all signers
  for (const email of emails) {
    try {
      const recipient = request.recipients.find((r: any) => r.email === email);
      const delivery = await ctx.deliveries.create({
        signatureRequestId: request.id,
        recipientId: recipient?.id,
        type: "COMPLETION",
        status: "PENDING",
      });

      await deliverEmail({
        to: email,
        subject: `Completed: ${documentName}`,
        react: SignatureCompletion({
          documentName,
          url: downloadUrl,
        }),
        system: true,
      });

      await ctx.deliveries.updateStatus(delivery.id, {
        status: "SENT",
        lastAttemptAt: new Date(),
      });
    } catch (error: any) {
      console.error(`Failed to send completion email to ${email}:`, error);
    }
  }

  // Log activity
  await ctx.activities.create({
    signatureRequestId: request.id,
    type: "REQUEST_COMPLETED",
  });
}
