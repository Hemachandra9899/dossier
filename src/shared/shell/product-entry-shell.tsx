import Link from "next/link";

import { productConfig } from "@/shared/config/product";

import { ProductLogo } from "./product-logo";

export function ProductEntryShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between px-6 py-5 sm:px-12">
        <Link href={productConfig.routes.home} aria-label={productConfig.name}>
          <ProductLogo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        {children}
      </main>
      <footer className="flex items-center justify-center gap-5 px-6 py-5 text-xs text-muted-foreground">
        <Link
          href={productConfig.legal.terms}
          target="_blank"
          rel="noopener noreferrer"
        >
          Terms of Service
        </Link>
        <Link
          href={productConfig.legal.privacy}
          target="_blank"
          rel="noopener noreferrer"
        >
          Privacy Policy
        </Link>
      </footer>
    </div>
  );
}
