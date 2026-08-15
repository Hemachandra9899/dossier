// Signed recipient-access tokens for the public recipient endpoints. A
// SignatureRequest id is a locator, never authorization: the only way to read
// request state, open a signing session, or download the signed artifact is to
// present a token that provably binds { signatureRequestId, recipientId } and
// was minted by Dossier (server-side HMAC).
//
// Token (stateless, URL-safe):  <requestId>.<recipientId>.<expiryMs>.<purpose>.<hex-sig>
//   sig = HMAC-SHA256(secret, "<requestId>.<recipientId>.<expiryMs>.<purpose>")
//
// Two token lifetimes exist:
//   - the invitation token embedded in the recipient URL (long-lived, capped
//     by the request's own expiry), and
//   - the short-lived HttpOnly cookie minted after the URL token is validated,
//     so the browser URL can be cleaned and the long-lived secret never lingers
//     in history.

import crypto from "crypto";

export const RECIPIENT_ACCESS_PURPOSE = "signature-request-access";

/** Invitation-token lifetime when the request itself has no expiry. */
export const RECIPIENT_ACCESS_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** HttpOnly cookie lifetime after the invitation token is exchanged. */
export const RECIPIENT_ACCESS_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

const DEV_FALLBACK_SECRET =
  "dossier-local-dev-signing-secret-do-not-use-in-production";

function getSigningSecret(): string {
  const secret = process.env.NEXT_PRIVATE_VERIFICATION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PRIVATE_VERIFICATION_SECRET is required for signing sessions.",
      );
    }
    // In local dev, use a stable fallback so the server doesn't crash when
    // the env var is not yet configured.
    console.warn(
      "[signing] NEXT_PRIVATE_VERIFICATION_SECRET is not set — using insecure dev fallback. Set it in .env for production.",
    );
    return DEV_FALLBACK_SECRET;
  }
  return secret;
}

export type RecipientAccessTokenPayload = {
  signatureRequestId: string;
  recipientId: string;
  expiresAt: Date;
  purpose: string;
};

export type RecipientAccessTokenVerifyResult =
  | { ok: true; expiresAt: Date }
  | { ok: false; reason: "malformed" | "invalid" | "mismatch" | "expired" };

function sign(parts: string[]): string {
  const hmac = crypto.createHmac("sha256", getSigningSecret());
  hmac.update(parts.join("."));
  return hmac.digest("hex");
}

/** Capped expiry: the access token is never valid past the request's own end. */
export function computeRecipientAccessExpiry(input: {
  now?: Date;
  requestExpiresAt?: Date | null;
  ttlMs?: number;
}): Date {
  const now = input.now ?? new Date();
  const ttl = input.ttlMs ?? RECIPIENT_ACCESS_TOKEN_TTL_MS;
  const maxExpiry = new Date(now.getTime() + ttl);
  return input.requestExpiresAt && input.requestExpiresAt.getTime() < maxExpiry.getTime()
    ? input.requestExpiresAt
    : maxExpiry;
}

export function mintRecipientAccessToken(input: {
  signatureRequestId: string;
  recipientId: string;
  expiresAt: Date;
}): string {
  const parts = [
    input.signatureRequestId,
    input.recipientId,
    String(input.expiresAt.getTime()),
    RECIPIENT_ACCESS_PURPOSE,
  ];
  return [...parts, sign(parts)].join(".");
}

export function parseRecipientAccessToken(
  token: string,
): RecipientAccessTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 5) return null;

  const [signatureRequestId, recipientId, expiryMs, purpose, signature] = parts;
  if (purpose !== RECIPIENT_ACCESS_PURPOSE) return null;
  if (!/^\d+$/.test(expiryMs)) return null;

  const expected = sign([signatureRequestId, recipientId, expiryMs, purpose]);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  return {
    signatureRequestId,
    recipientId,
    expiresAt: new Date(Number.parseInt(expiryMs, 10)),
    purpose,
  };
}

export function verifyRecipientAccessToken(
  token: string | undefined,
  input: { signatureRequestId: string; recipientId: string },
): RecipientAccessTokenVerifyResult {
  if (!token) {
    return { ok: false, reason: "malformed" };
  }

  const parsed = parseRecipientAccessToken(token);
  if (!parsed) {
    return { ok: false, reason: "invalid" };
  }

  if (
    parsed.signatureRequestId !== input.signatureRequestId ||
    parsed.recipientId !== input.recipientId
  ) {
    return { ok: false, reason: "mismatch" };
  }

  if (parsed.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, expiresAt: parsed.expiresAt };
}

export function recipientAccessCookieName(requestId: string): string {
  return `dossier_signing_access_${requestId}`;
}

export function buildRecipientAccessCookieHeader(input: {
  requestId: string;
  token: string;
}): string {
  const secure = process.env.NODE_ENV === "production" ? "Secure; " : "";
  return `${recipientAccessCookieName(input.requestId)}=${input.token}; Path=/; HttpOnly; SameSite=Lax; ${secure}Max-Age=${RECIPIENT_ACCESS_COOKIE_TTL_MS / 1000}`;
}

/**
 * Reads and verifies the access proof from a cookie header. The recipientId is
 * derived from the signed token, never from the client.
 */
export function readRecipientAccessFromCookies(
  cookieHeader: string | undefined,
  input: { signatureRequestId: string },
): { ok: true; recipientId: string } | { ok: false; reason: string } {
  if (!cookieHeader) {
    return { ok: false, reason: "missing" };
  }

  const name = recipientAccessCookieName(input.signatureRequestId);
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));
  if (!cookie) {
    return { ok: false, reason: "missing" };
  }

  const token = cookie.slice(name.length + 1);
  const parsed = parseRecipientAccessToken(token);
  if (!parsed) {
    return { ok: false, reason: "invalid" };
  }
  if (parsed.signatureRequestId !== input.signatureRequestId) {
    return { ok: false, reason: "mismatch" };
  }
  if (parsed.expiresAt.getTime() <= Date.now()) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, recipientId: parsed.recipientId };
}
