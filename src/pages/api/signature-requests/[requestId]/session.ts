// POST /api/signature-requests/:requestId/session
// Recipient-facing signing session creation. The caller must first present the
// recipient-access proof (HttpOnly cookie from the invitation link); the bound
// recipientId is derived from that proof, never trusted from the body. Reuses
// the legacy protections: per-request + per-IP rate limiting and an HMAC
// continuity cookie so re-visits are provably bound to the authorized recipient.

import { NextApiRequest, NextApiResponse } from "next";
import { parse as parseCookieHeader } from "cookie";
import { z } from "zod";

import { errorhandler } from "@/lib/errorHandler";
import { ratelimit } from "@/lib/redis";
import { getIpAddress } from "@/lib/utils/ip";
import { createSigningContext } from "@/modules/signing/application/context";
import { createSigningSession } from "@/modules/signing/application/create-signing-session";
import { isDossierSigningRuntimeEnabled } from "@/modules/signing/config";
import {
  mintRequestSessionContinuityToken,
  verifyRequestSessionContinuityToken,
} from "@/modules/signing/domain/continuity-token";
import { readRecipientAccessFromCookies } from "@/modules/signing/domain/recipient-access-token";

const bodySchema = z.object({
  email: z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim().toLowerCase();
      return trimmed.length > 0 ? trimmed : null;
    }, z.string().email().nullable().optional()),
  name: z
    .preprocess((value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }, z.string().max(255).nullable().optional()),
});

const continuityCookieName = (requestId: string) =>
  `dossier_signing_session_${requestId}`;

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

  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "A valid signing session request is required." });
    }

    const { email, name } = parsed.data;

    // Access proof first: the HttpOnly recipient-access cookie must be present,
    // valid, and bound to this request. The recipient identity is derived from
    // the signed token, never from the request body. Uniform 404 keeps the
    // requestId from acting as an existence oracle.
    const access = readRecipientAccessFromCookies(req.headers.cookie, {
      signatureRequestId: requestId,
    });
    if (!access.ok) {
      return res.status(404).end();
    }
    const recipientId = access.recipientId;

    const ipAddressValue = getIpAddress(req.headers);

    const [requestLimit, ipLimit] = await Promise.all([
      ratelimit(100, "1 m").limit(`dossier-signing-session:${requestId}`),
      ratelimit(20, "1 m").limit(`dossier-signing-session:ip:${ipAddressValue}`),
    ]);

    if (!requestLimit.success || !ipLimit.success) {
      return res.status(429).json({
        message: "Too many signing requests. Please try again in a minute.",
      });
    }

    // Continuity proof: a valid cookie proves this recipient was already
    // authorized for this request; a mismatched/absent cookie simply means we
    // re-validate identity below (the use-case enforces the email binding).
    const cookies = parseCookieHeader(req.headers.cookie || "");
    const continuityToken = cookies[continuityCookieName(requestId)];
    const hasContinuity =
      !!continuityToken &&
      verifyRequestSessionContinuityToken(continuityToken, {
        requestId,
        recipientId,
      });

    const session = await createSigningSession(createSigningContext(), {
      requestId,
      recipientId,
      email: hasContinuity ? null : email,
      name: hasContinuity ? null : name,
    });

    const minted = mintRequestSessionContinuityToken({ requestId, recipientId });
    res.setHeader("Set-Cookie", `${continuityCookieName(requestId)}=${minted}; Path=/; HttpOnly; SameSite=Lax; ${process.env.NODE_ENV === "production" ? "Secure; " : ""}Max-Age=${60 * 60 * 12}`);

    return res.status(200).json(session);
  } catch (error) {
    return errorhandler(error, res);
  }
}
