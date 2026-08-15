export class CompletionNotReadyError extends Error {
  code: string;
  blockers?: any[];
  constructor(message?: string, blockers?: any[]) {
    super(message || "Completion is not ready");
    this.name = "CompletionNotReadyError";
    this.code = "COMPLETION_NOT_READY";
    this.blockers = blockers || [];
  }
}

export class CompletionDomainError extends Error {
  code: string;
  blockers?: any[];
  constructor(message?: string, code?: string, blockers?: any[]) {
    super(message || "Completion domain error");
    this.name = "CompletionDomainError";
    this.code = code || "COMPLETION_ERROR";
    this.blockers = blockers || [];
  }
}
