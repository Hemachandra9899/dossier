export type ErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "unprocessable_entity"
  | "rate_limit_exceeded"
  | "internal_server_error";

export class PapermarkApiError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PapermarkApiError";
  }
}
