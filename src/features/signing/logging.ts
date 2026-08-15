export interface SigningLogger {
  info(message: string, meta?: Record<string, any>): void;
  warn(message: string, meta?: Record<string, any>): void;
  error(message: string, meta?: Record<string, any>, error?: any): void;
}

export const consoleSigningLogger: SigningLogger = {
  info: (msg, meta) => console.log(`[SIGNING INFO] ${msg}`, meta || ""),
  warn: (msg, meta) => console.warn(`[SIGNING WARN] ${msg}`, meta || ""),
  error: (msg, meta, err) => console.error(`[SIGNING ERROR] ${msg}`, meta || "", err || ""),
};
