import React from "react";
import type { AuthErrorCode } from "../auth.types";

const AUTH_ERRORS: Record<AuthErrorCode, string> = {
  OAuthAccountNotLinked: "This email is already associated with another login method.",
  OAuthCallback: "An error occurred during social login. Please try again.",
  OAuthSignin: "Could not start social login. Please try again.",
  EmailSignin: "The sign-in link could not be sent. Check your email address.",
  CredentialsSignin: "Invalid credentials provided.",
  Callback: "Error during callback handling.",
  AccessDenied: "You do not have permission to access this resource.",
  Configuration: "Authentication is misconfigured. Contact support.",
  Default: "An unexpected error occurred. Please try again.",
};

export interface AuthErrorProps {
  code?: AuthErrorCode | string;
}

export function AuthError({ code }: AuthErrorProps) {
  if (!code) return null;
  const message = AUTH_ERRORS[code as AuthErrorCode] || AUTH_ERRORS.Default;

  return (
    <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
      {message}
    </div>
  );
}

export default AuthError;
