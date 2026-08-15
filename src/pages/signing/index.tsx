import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import AppLayout from "@/shared/ui/layouts/app";
import { PenTool, CheckCircle, Clock, AlertCircle, Plus, Send } from "lucide-react";

export default function SigningDashboardPage() {
  return (
    <AppLayout>
      <Head>
        <title>E-Signing & Requests - Dossier</title>
      </Head>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              E-Signing & Signature Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage signer workflows, multi-party envelopes, reminder schedules, and Documenso-backed execution.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/datarooms"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              New Signature Request
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Pending Signatures</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Completed Envelopes</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <CheckCircle className="h-5 w-5 text-emerald-500" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Active Templates</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <PenTool className="h-5 w-5 text-primary" />
            </div>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="text-xs font-medium text-muted-foreground">Declined / Expired</span>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-foreground">0</span>
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Requests List */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <div className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">Recent Signature Envelopes</h3>
            </div>
          </div>

          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <PenTool className="h-6 w-6" />
            </div>
            <h4 className="text-base font-semibold text-foreground">No Signature Requests Yet</h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
              Send contracts, NDAs, and agreements for legally binding e-signature directly through your client dossiers.
            </p>
            <Link
              href="/datarooms"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow hover:bg-primary/90 transition-all"
            >
              <Plus className="h-4 w-4" />
              Create Signature Request
            </Link>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
