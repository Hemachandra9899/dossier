// Minimal logger contract for the signing application layer. Use-cases never
// import console/logging libraries directly; they log through this interface
// so tests can capture output without touching process.stdout.

export interface SigningLogger {
  info(message: string, context?: Record<string, unknown>): void;
  warn(
    message: string,
    context?: Record<string, unknown>,
    error?: unknown,
  ): void;
  error(
    message: string,
    context?: Record<string, unknown>,
    error?: unknown,
  ): void;
}

export const consoleSigningLogger: SigningLogger = {
  info: (message, context) =>
    console.log(`[signing] ${message}`, context ?? {}),
  warn: (message, context, error) =>
    console.warn(`[signing] ${message}`, context ?? {}, error ?? ""),
  error: (message, context, error) =>
    console.error(`[signing] ${message}`, context ?? {}, error ?? ""),
};
