import { buildMetadata } from "@/shared/config/metadata";

import SAMLCallbackClient from "./page-client";

export const metadata = buildMetadata({
  title: "SSO Login",
  description: "Completing SSO login",
});

export default function SAMLCallbackPage() {
  return <SAMLCallbackClient />;
}
