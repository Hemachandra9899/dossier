// Platform error type carried by all TanStack Query fetchers so the query
// client can make retry decisions from an HTTP status without coupling to any
// single API client.

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
