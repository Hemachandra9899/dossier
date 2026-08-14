import type { CompletionBlocker } from "./types";

export type CompletionErrorCode =
  | "FILE_NOT_FOUND"
  | "FILE_NOT_READY_TO_CLOSE"
  | "FILE_HAS_COMPLETION_BLOCKERS"
  | "COMPLETION_ALREADY_IN_PROGRESS";

/**
 * Domain error thrown when a completion run cannot be started. Callers map the
 * code to an HTTP status:
 *  - FILE_NOT_FOUND                       -> 404
 *  - FILE_NOT_READY_TO_CLOSE              -> 409 { code }
 *  - FILE_HAS_COMPLETION_BLOCKERS         -> 409 { code, blockers }
 *
 * COMPLETION_ALREADY_IN_PROGRESS is part of the API surface for callers that
 * choose to reject instead of reusing an in-flight run; the run-start service
 * itself prefers to return the existing active run.
 */
export class CompletionDomainError extends Error {
  readonly code: CompletionErrorCode;
  readonly blockers?: CompletionBlocker[];

  constructor(
    code: CompletionErrorCode,
    message: string,
    blockers?: CompletionBlocker[],
  ) {
    super(message);
    this.name = "CompletionDomainError";
    this.code = code;
    this.blockers = blockers;
  }
}
