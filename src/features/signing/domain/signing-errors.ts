// Typed error hierarchy for the signing domain. Application use-cases throw
// these so route handlers and jobs can map them without string matching.

export class SigningError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SigningError";
  }
}

/** The signing provider (Documenso) rejected or failed a request. */
export class SigningProviderError extends SigningError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "SigningProviderError";
  }
}

/** A signing resource does not exist (or is not visible to the actor). */
export class SigningNotFoundError extends SigningError {
  constructor(message = "Signing resource was not found.") {
    super(message);
    this.name = "SigningNotFoundError";
  }
}

/** The request is in a state that forbids the attempted transition. */
export class SigningStateError extends SigningError {
  constructor(message: string) {
    super(message);
    this.name = "SigningStateError";
  }
}

/** Input failed validation. */
export class SigningValidationError extends SigningError {
  constructor(message: string) {
    super(message);
    this.name = "SigningValidationError";
  }
}

export type SigningSendErrorCode =
  | "SIGNATURE_FIELDS_REQUIRED"
  | "SIGNATURE_REQUIRED";

/** Send-time validation failed against the provider envelope (409). */
export class SigningSendError extends SigningError {
  code: SigningSendErrorCode;
  recipients: string[];

  constructor(
    code: SigningSendErrorCode,
    message: string,
    recipients: string[],
  ) {
    super(message);
    this.name = "SigningSendError";
    this.code = code;
    this.recipients = recipients;
  }
}
