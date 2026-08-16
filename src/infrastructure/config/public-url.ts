// Public base URL for links placed inside recipient-facing emails and pages
// (signing invitations, reminders, completion links). Single source of truth:
// prefer NEXT_PUBLIC_APP_URL, fall back to NEXT_PUBLIC_MARKETING_URL, then
// localhost for local development. Never derive this from the signing provider
// host.
//
// NOTE: this module is imported by the signing feature only; do not rely on it
// for the marketing site URL.

export function getPublicAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_MARKETING_URL ||
    "http://localhost:3000"
  );
}
