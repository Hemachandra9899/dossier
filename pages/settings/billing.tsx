import { useRouter } from "next/router";

import { useEffect } from "react";

import { GTMComponent } from "@/components/gtm-component";

// Billing was removed; route to general settings.
export default function Billing() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings/general");
  }, [router]);

  return (
    <>
      <GTMComponent />
    </>
  );
}
