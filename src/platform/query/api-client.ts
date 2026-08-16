// Thin JSON fetch helpers for TanStack Query fetchers. Components never call
// fetch("/api/...") directly; feature API modules go through these so error
// normalization and the response shape stay in one place.

import { ApiError } from "./query-errors";

interface ApiErrorBody {
  message?: string;
  error?: string;
}

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

async function parseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return body?.message || body?.error || DEFAULT_ERROR_MESSAGE;
  } catch {
    return DEFAULT_ERROR_MESSAGE;
  }
}

export async function apiRequest<T>(
  input: RequestInfo,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return apiRequest<T>(url);
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return apiRequest<T>(url, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
