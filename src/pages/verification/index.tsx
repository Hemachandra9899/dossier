import React, { useState } from "react";
import Head from "next/head";
import AppLayout from "@/shared/ui/layouts/app";
import { ShieldCheck, CheckCircle2, AlertTriangle, FileCheck, Search, Filter, RefreshCw } from "lucide-react";

export default function VerificationPage() {
  const [activeTab, setActiveTab] = useState<"all" | "passed" | "flagged">("all");

  return (
    <AppLayout>
      <Head>
        <title>Document Verification - Dossier</title>
      </Head>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Document & Identity Verification
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Automated rules engine for KYC/AML, name-matching, date checks, and document authenticity.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 rounded-lg border bg-card px-3.5 py-2 text-xs font-semibold shadow-sm hover:bg-muted transition-colors">
              <RefreshCw className="h-3.5 w-3.5" />
              Re-run Rules Engine
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Auto-Verified</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-foreground">98.4%</span>
              <span className="ml-2 text-xs text-muted-foreground">confidence score</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Rules Enforced</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-foreground">12</span>
              <span className="ml-2 text-xs text-muted-foreground">active policies</span>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Pending Review</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-2">
              <span className="text-2xl font-bold text-foreground">0</span>
              <span className="ml-2 text-xs text-muted-foreground">items require action</span>
            </div>
          </div>
        </div>

        {/* Verification Status Console */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Verification Logs</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border bg-muted/40 p-0.5 text-xs">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    activeTab === "all" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  All Checks
                </button>
                <button
                  onClick={() => setActiveTab("passed")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    activeTab === "passed" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Passed
                </button>
                <button
                  onClick={() => setActiveTab("flagged")}
                  className={`rounded-md px-3 py-1 font-medium transition-all ${
                    activeTab === "flagged" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Flagged
                </button>
              </div>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold text-foreground">All Verification Rules Operational</h4>
            <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
              Fuzzy name matching, address verification, and requirement validation will log incoming checks automatically as documents are processed.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
