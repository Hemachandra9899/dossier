// PUT /api/signature-requests/:requestId/fields/:fieldId
// Recipient-facing: persists the caller's response on one field (text value or
// a reference to a previously-uploaded signature image). Access is proven by
// the HttpOnly recipient-access cookie. Never accepts signature image bytes
// directly — signatures are uploaded to /signature and the returned storage
// key is passed here.

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { errorhandler } from "@/shared/utils/errorHandler";
import { createSigningContext } from "@/features/signing/application/context";
import { saveFieldResponse } from "@/features/signing/application/save-field-response";
import { isDossierSigningEnabled } from "@/features/signing/config";
import { readRecipientAccessFromCookies } from "@/features/signing/domain/recipient-access-token";

const bodySchema = z
  .object({
    value: z.any().optional(),
    signatureStorageKey: z.string().min(1).nullable().optional(),
  })
  .refine(
    (data) => data.value !== undefined || data.signatureStorageKey !== undefined,
    { message: "A field value or signatureStorageKey is required." },
  );

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  if (!isDossierSigningEnabled) {
    return res.status(404).end();
  }

  const { requestId, fieldId } = req.query as {
    requestId: string;
    fieldId: string;
  };

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
        .json({ message: parsed.error.issues[0]?.message ?? "Invalid field response." });
    }

    const result = await saveFieldResponse(createSigningContext(), {
      requestId,
      recipientId: access.recipientId,
      fieldId,
      value: parsed.data.value,
      signatureStorageKey: parsed.data.signatureStorageKey,
    });

    return res.status(200).json(result);
  } catch (error) {
    return errorhandler(error, res);
  }
}