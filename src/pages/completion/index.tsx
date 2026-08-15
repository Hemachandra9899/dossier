import React from "react";
import Head from "next/head";
import Link from "next/link";
import AppLayout from "@/shared/ui/layouts/app";
import { CheckCircle2, Download, Archive, Sparkles, FolderArchive } from "lucide-react";

export default function CompletionDashboardPage() {
  return (
    <AppLayout>
      <Head>
        <title>File Completion & Binders - Dossier</title>
      </Head>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              File Completion & Closing Binders
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated PDF compilation, audit certificates, signed document packaging, and closing archive delivery.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Ready to Close</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Generated Binders</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <FolderArchive className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Archived Files</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <Archive className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <FolderArchive className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Completed Files & Binders</h3>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold text-foreground">No Completed Files Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              When all document requirements and signatures are finalized, full closing binders and audit certificates will be assembled here.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
