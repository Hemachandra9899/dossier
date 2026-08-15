export type SignInMethod = "email" | "google" | "saml" | "linkedin";

export type AuthErrorCode =
  | "OAuthAccountNotLinked"
  | "OAuthCallback"
  | "OAuthSignin"
  | "EmailSignin"
  | "CredentialsSignin"
  | "Callback"
  | "AccessDenied"
  | "Configuration"
  | "Default";

export interface SignInInput {
  email: string;
  callbackUrl?: string;
}
