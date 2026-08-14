import { buildMetadata } from "@/shared/config/metadata";

import EmailVerificationClient from "./page-client";

const data = {
  description: "Verify your login to Dossier",
  title: "Verify Login",
  url: "/auth/email",
};

export const metadata = buildMetadata({
  title: data.title,
  description: data.description,
  url: data.url,
});

export default async function EmailVerificationPage() {
  return <EmailVerificationClient />;
}
