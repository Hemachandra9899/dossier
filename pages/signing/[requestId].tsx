import { useRouter } from "next/router";

import { SigningRequestPage } from "@/modules/signing/ui/signing/signing-request-page";

export default function SigningPage() {
  const router = useRouter();
  const { requestId, recipient } = router.query;

  if (!router.isReady) {
    return null;
  }

  const recipientId =
    typeof recipient === "string" && recipient.length > 0 ? recipient : null;

  return (
    <SigningRequestPage
      requestId={typeof requestId === "string" ? requestId : ""}
      recipientId={recipientId}
    />
  );
}
