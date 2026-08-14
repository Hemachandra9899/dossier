import type { AuthErrorCode } from "../auth.types";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  OAuthAccountNotLinked:
    "This email is already registered with a different sign-in method. Sign in with that method instead.",
  OAuthCallback:
    "Sign-in failed while processing the provider response. Please try again.",
  OAuthSignin: "Sign-in failed. Please try again.",
  EmailSignin: "The sign-in link could not be sent. Please try again.",
  AccessDenied: "Access denied. You do not have permission to sign in.",
  Configuration:
    "Authentication is misconfigured. Please contact support.",
  Default: "Something went wrong signing in. Please try again.",
};

export function AuthError({ error }: { error: string | null }) {
  if (!error) return null;

  const message =
    AUTH_ERROR_MESSAGES[error as AuthErrorCode] ??
    AUTH_ERROR_MESSAGES.Default;

  return (
    <div
      role="alert"
      className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
    >
      {message}
    </div>
  );
}
