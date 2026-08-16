// POST /api/signature-requests/:requestId/signature
// Recipient-facing: accepts a drawn / uploaded signature image (PNG data URL),
// stores it in Dossier-owned object storage and returns the opaque storage key
// the client later sends to /fields/:fieldId to bind the image to a field.
// Access is proven by the HttpOnly recipient-access cookie.

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { readRecipientAccessFromCookies } from "@/features/signing/domain/recipient-access-token";
import { signatureImageStorage } from "@/infrastructure/storage/signature-image-storage";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;

const bodySchema = z.object({
  data: z.string().min(1, "A signature image is required."),
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  if (!isDossierSigningEnabled) {
    return res.status(404).end();
  }

  const { requestId } = req.query as { requestId: string };

  const access = readRecipientAccessFromCookies(req.headers.cookie, {
    signatureRequestId: requestId,
  });
  if (!access.ok) {
    return res.status(404).end();
  }

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.issues[0]?.message ?? "Invalid signature." });
    }

    const bytes = decodeDataUrl(parsed.data.data);
    if (!bytes) {
      return res.status(400).json({ message: "Signature must be a PNG image." });
    }
    if (bytes.byteLength > MAX_SIGNATURE_BYTES) {
      return res.status(413).json({ message: "Signature image is too large." });
    }

    const ctx = createSigningContext();
    const request = await ctx.requests.findByIdForRecipient(requestId);
    if (!request) {
      return res.status(404).end();
    }

    const storageKey = await signatureImageStorage.putSignatureImage(
      request.teamId,
      request.id,
      access.recipientId,
      // fieldId is assigned later when the key is bound to a field; use a
      // temporary unique suffix so multiple signatures per recipient don't
      // collide before being bound.
      `t${Date.now()}`,
      bytes,
    );

    return res.status(200).json({ signatureStorageKey: storageKey });
  } catch (error) {
    return errorhandler(error, res);
  }
}

function decodeDataUrl(dataUrl: string): Buffer | null {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+=*)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}