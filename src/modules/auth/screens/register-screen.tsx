"use client";

import { useSearchParams } from "next/navigation";

import { ProductEntryShell } from "@/shared/shell/product-entry-shell";

import { RegisterForm } from "../components/register-form";

export function RegisterScreen() {
  const searchParams = useSearchParams();
  const next = searchParams?.get("next") ?? undefined;

  return (
    <ProductEntryShell>
      <RegisterForm next={next} />
    </ProductEntryShell>
  );
}
