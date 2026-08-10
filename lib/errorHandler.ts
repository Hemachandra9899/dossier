import { NextApiResponse } from "next";

import {
  SigningError,
  SigningNotFoundError,
  SigningProviderError,
  SigningStateError,
  SigningValidationError,
} from "@/modules/signing/domain/signing-errors";

function sanitizeError(err: unknown) {
  if (!(err instanceof Error)) {
    return { name: typeof err, message: String(err) };
  }

  const anyErr = err as Error & { code?: unknown; requestId?: unknown };
  return {
    name: err.name,
    message: err.message,
    code: anyErr.code,
    requestId: anyErr.requestId ?? null,
    stack: err.stack ? err.stack.split("\n")[0] : undefined,
  };
}

function handleSigningError(err: SigningError, res: NextApiResponse) {
  if (err instanceof SigningNotFoundError) {
    return res.status(404).end(err.message);
  }
  if (err instanceof SigningValidationError) {
    return res.status(400).json({ message: err.message });
  }
  if (err instanceof SigningStateError) {
    return res.status(409).json({ message: err.message });
  }
  if (err instanceof SigningProviderError) {
    return res.status(502).json({ message: "Signing provider error." });
  }
  return res.status(500).json({ message: err.message });
}

export function errorhandler(err: unknown, res: NextApiResponse) {
  if (err instanceof SigningError) {
    return handleSigningError(err, res);
  }
  if (err instanceof TeamError || err instanceof DocumentError) {
    return res.status(err.statusCode).end(err.message);
  } else {
    console.error("[errorhandler] unhandled error", sanitizeError(err));
    return res.status(500).json({
      message: "Internal Server Error",
    });
  }
}

export class TeamError extends Error {
  statusCode = 400;
  constructor(public message: string) {
    super(message);
  }
}

export class DocumentError extends Error {
  statusCode = 400;
  constructor(public message: string) {
    super(message);
  }
}
