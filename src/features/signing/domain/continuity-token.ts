// HMAC continuity proof for recipient-facing signing sessions. Mirrors the
// legacy signed-access-token approach: a recipient who successfully opens a
// session gets a signed token binding requestId + recipientId; subsequent
// calls present it via cookie so re-validation without identity re-entry is
// safe against forgery.

import crypto from "crypto";

function getVerificationSecret(): string {
  const secret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
  if (!secret) {
    throw new Error(
      "NEXT_PRIVATE_VERIFICATION_SECRET is required for signing sessions.",
    );
  }
  return secret;
}

export function mintRequestSessionContinuityToken(input: {
  requestId: string;
  recipientId: string;
}): string {
  const hmac = crypto.createHmac("sha256", getVerificationSecret());
  hmac.update(`${input.requestId}:${input.recipientId}`);
  return `${input.requestId}:${input.recipientId}:${hmac.digest("hex")}`;
}

export function verifyRequestSessionContinuityToken(
  token: string | undefined,
  input: { requestId: string; recipientId: string },
): boolean {
  if (!token) return false;
  const expected = mintRequestSessionContinuityToken(input);
  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
