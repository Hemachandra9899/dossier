export type SignInMethod = "google" | "email" | "linkedin";

export type AuthErrorCode =
  | "OAuthAccountNotLinked"
  | "OAuthCallback"
  | "OAuthSignin"
  | "EmailSignin"
  | "AccessDenied"
  | "Configuration"
  | "Default";
