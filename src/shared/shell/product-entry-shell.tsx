import React from "react";
import Link from "next/link";
import { productConfig } from "@/shared/config/product";

export interface ProductEntryShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export function ProductEntryShell({
  children,
  title,
  subtitle,
}: ProductEntryShellProps) {
  return (
    <div className="flex min-h-screen flex-col justify-center py-12 sm:px-6 lg:px-8 bg-neutral-50 dark:bg-neutral-900">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block">
          <span className="text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {productConfig.name}
          </span>
        </Link>
        {title && (
          <h2 className="mt-6 text-center text-3xl font-extrabold tracking-tight text-neutral-900 dark:text-white">
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-400">
            {subtitle}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-neutral-800 py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-neutral-200 dark:border-neutral-700">
          {children}
        </div>
      </div>
    </div>
  );
}

export default ProductEntryShell;
