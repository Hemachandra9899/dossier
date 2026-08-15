// POST /api/signature-requests/:requestId/exchange
// Recipient-facing token→cookie exchange. The recipient arrives with the
// long-lived invitation token in the URL; this endpoint verifies it (HMAC,
// binding, request still live) and swaps it for a short-lived HttpOnly cookie.
// The page then scrubs the token from the URL so the long-lived secret never
// lingers in history. Rate-limited per request and per IP.

import { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";

import { errorhandler } from "@/shared/utils/errorHandler";
import { ratelimit } from "@/shared/utils/redis";
import { getIpAddress } from "@/shared/utils/utils/ip";
import { createSigningContext } from "@/features/signing/application/context";
import { exchangeRecipientAccessToken } from "@/features/signing/application/exchange-recipient-access-token";
import { isDossierSigningRuntimeEnabled } from "@/features/signing/config";
import {
  buildRecipientAccessCookieHeader,
  computeRecipientAccessExpiry,
  mintRecipientAccessToken,
  RECIPIENT_ACCESS_COOKIE_TTL_MS,
} from "@/features/signing/domain/recipient-access-token";

const bodySchema = z.object({
  token: z.string().min(1, "A signing link token is required."),
});

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
  if (!isDossierSigningRuntimeEnabled) {
    return res.status(404).end();
  }

  const { requestId } = req.query as { requestId: string };
  const ipAddressValue = getIpAddress(req.headers);

  const [requestLimit, ipLimit] = await Promise.all([
    ratelimit(100, "1 m").limit(`dossier-signing-exchange:${requestId}`),
    ratelimit(20, "1 m").limit(`dossier-signing-exchange:ip:${ipAddressValue}`),
  ]);
  if (!requestLimit.success || !ipLimit.success) {
    return res.status(429).json({
      message: "Too many requests. Please try again in a minute.",
    });
  }

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "A valid signing link is required." });
    }

    const exchange = await exchangeRecipientAccessToken(createSigningContext(), {
      requestId,
      token: parsed.data.token,
    });

    const newCookieToken = mintRecipientAccessToken({
      signatureRequestId: requestId,
      recipientId: exchange.recipientId,
      expiresAt: computeRecipientAccessExpiry({
        now: new Date(),
        ttlMs: RECIPIENT_ACCESS_COOKIE_TTL_MS,
        requestExpiresAt: exchange.expiresAt,
      }),
    });

    res.setHeader(
      "Set-Cookie",
      buildRecipientAccessCookieHeader({
        requestId,
        token: newCookieToken,
      }),
    );

    return res.status(200).json({ ok: exchange.ok });
  } catch (error) {
    return errorhandler(error, res);
  }
}
