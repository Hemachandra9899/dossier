"use client";

import { useRouter } from "next/router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Clock,
  User,
  Mail,
  FileText,
  CheckCircle,
  Copy,
  RotateCcw,
  XCircle,
  Download,
  AlertCircle,
  ExternalLink,
  PenLine,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Badge } from "@/shared/ui/badge";
import { SignatureStatusBadge } from "./signature-status-badge";
import {
  signingApi,
  buildRecipientSigningUrl,
  type DeliveryDTO,
  type ActivityDTO,
} from "@/features/signing/api/signing-api";
import {
  signatureRequestQuery,
  signedArtifactQuery,
} from "@/features/signing/api/signing.queries";
import {
  cancelSignatureRequestOptions,
  remindSignatureRequestOptions,
} from "@/features/signing/api/signing.mutations";
import { useCopyToClipboard } from "@/shared/utils/utils/use-copy-to-clipboard";

interface RequestManagementProps {
  teamId: string;
  requestId: string;
  onStateChange?: () => void;
}

const ACTIVITY_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Signature request created",
  INVITATION_SENT: "Invitation email sent",
  INVITATION_FAILED: "Invitation email delivery failed",
  RECIPIENT_VIEWED: "Document opened by recipient",
  SIGNING_STARTED: "Signing started",
  REMINDER_SENT: "Reminder email sent",
  REQUEST_CANCELLED: "Request cancelled",
  RECIPIENT_SIGNED: "Recipient signed document",
  REQUEST_COMPLETED: "Request fully signed & completed",
  ARTIFACT_READY: "Signed PDF stored in storage",
};

export function RequestManagement({ teamId, requestId, onStateChange }: RequestManagementProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isCopied, copyToClipboard } = useCopyToClipboard({});
  const [copiedRecipientId, setCopiedRecipientId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch the full signature request details; polls every 5s while the request
  // is active (SENT/VIEWED/SIGNING/PARTIALLY_SIGNED), stops on terminal states.
  const requestQuery = useQuery(signatureRequestQuery(teamId, requestId));

  // Fetch the signed artifact once the request is completed.
  const isCompleted = requestQuery.data?.request?.status === "COMPLETED";
  const artifactQuery = useQuery(signedArtifactQuery(teamId, requestId, isCompleted));

  const cancelOptions = cancelSignatureRequestOptions(queryClient);
  const cancelMutation = useMutation({
    ...cancelOptions,
    onSuccess: (data, input) => {
      cancelOptions.onSuccess?.(data, input);
      onStateChange?.();
    },
  });

  const remindMutation = useMutation(remindSignatureRequestOptions(queryClient));

  const request = requestQuery.data?.request;

  const isEditable =
    request?.status === "DRAFT" ||
    request?.status === "PREPARING" ||
    request?.status === "READY";

  if (requestQuery.isError) {
    return (
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Failed to load signature request details.
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex items-center justify-center p-8 text-sm text-muted-foreground animate-pulse">
        Loading signature request status...
      </div>
    );
  }

  // Format relative time helper
  function formatRelative(dateStr: Date | string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Send Reminder trigger
  const handleSendReminder = async (recipientId: string, email: string) => {
    setActionLoading(`remind-${recipientId}`);
    try {
      await remindMutation.mutateAsync({ teamId, requestId, recipientId });
      toast.success(`Reminder sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to send reminder.");
    } finally {
      setActionLoading(null);
    }
  };

  // Copy recipient link
  const handleCopyLink = async (recipientId: string) => {
    setCopiedRecipientId(recipientId);
    try {
      const { access } = await signingApi.getRecipientAccessToken({
        teamId,
        requestId,
        recipientId,
      });
      const url = buildRecipientSigningUrl({
        requestId,
        token: access.token,
      });
      copyToClipboard(url, "Signing link copied to clipboard.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to copy link.");
    } finally {
      setTimeout(() => setCopiedRecipientId(null), 2000);
    }
  };

  // Cancel signature request
  const handleCancelRequest = async () => {
    if (!confirm("Are you sure you want to cancel this signature request? This cannot be undone.")) {
      return;
    }
    setActionLoading("cancel");
    try {
      await cancelMutation.mutateAsync({ teamId, requestId });
      toast.success("Signature request cancelled successfully.");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to cancel request.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Signers & Global actions Panel */}
      <div className="space-y-6 md:col-span-2">
        <Card className="border-neutral-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">Signature Request</CardTitle>
              <CardDescription>Manage your document signing workflow.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {isEditable && (
                <Button
                  size="sm"
                  onClick={() => void router.push(`/signing/prepare/${request.id}`)}
                >
                  <PenLine className="h-4 w-4 mr-1.5" />
                  {request.status === "READY" ? "Preview & send" : "Continue preparing"}
                </Button>
              )}
              <SignatureStatusBadge status={request.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Signers list */}
            <div>
              <h4 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">Signers</h4>
              <div className="divide-y divide-neutral-100">
                {request.recipients.map((recipient) => {
                  const lastDelivery = request.deliveries.find((d: DeliveryDTO) => d.recipientId === recipient.id);
                  return (
                    <div key={recipient.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-neutral-400" />
                          <span className="font-semibold text-sm">{recipient.name || "Unnamed Signer"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          <span>{recipient.email}</span>
                          {lastDelivery && (
                            <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded ml-1">
                              Invited {formatRelative(lastDelivery.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Recipient status badge and operations */}
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            recipient.status === "SIGNED"
                              ? "preview"
                              : recipient.status === "VIEWED" || recipient.status === "SIGNING"
                                ? "email"
                                : "outline"
                          }
                          className="text-xs"
                        >
                          {recipient.status === "SIGNED"
                            ? "Signed"
                            : recipient.status === "VIEWED"
                              ? "Opened"
                              : recipient.status === "SIGNING"
                                ? "Signing"
                                : "Pending"}
                        </Badge>

                        {/* Remind & Copy buttons (only when active) */}
                        {request.status !== "CANCELLED" && request.status !== "COMPLETED" && recipient.status !== "SIGNED" && (
                          <div className="flex items-center gap-1.5 ml-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={actionLoading === `remind-${recipient.id}`}
                              onClick={() => handleSendReminder(recipient.id, recipient.email!)}
                            >
                              <RotateCcw className={`h-3.5 w-3.5 mr-1 ${actionLoading === `remind-${recipient.id}` ? "animate-spin" : ""}`} />
                              Remind
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(recipient.id)}
                            >
                              <Copy className="h-3.5 w-3.5 mr-1" />
                              {copiedRecipientId === recipient.id ? "Copied" : "Copy link"}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signed artifact download if completed */}
            {isCompleted && (
              <div className="bg-neutral-50 rounded-lg p-4 border flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="font-semibold text-sm">Signed PDF ready</h4>
                  <p className="text-xs text-muted-foreground">The fully signed document is securely stored locally.</p>
                </div>
                {artifactQuery.data?.downloadUrl ? (
                  <Button asChild className="gap-2">
                    <a href={artifactQuery.data.downloadUrl} download={artifactQuery.data.artifact?.fileName ?? "signed.pdf"}>
                      <Download className="h-4 w-4" />
                      Download Signed PDF
                    </a>
                  </Button>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 animate-spin" />
                    Finalizing PDF storage...
                  </div>
                )}
              </div>
            )}

            {/* Cancel operations */}
            {request.status !== "CANCELLED" && request.status !== "COMPLETED" && (
              <div className="pt-4 border-t flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={actionLoading === "cancel"}
                  onClick={handleCancelRequest}
                >
                  <XCircle className="h-4 w-4 mr-1.5" />
                  Cancel Request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline Sidebar */}
      <div className="space-y-6">
        <Card className="border-neutral-200 shadow-sm h-full">
          <CardHeader>
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-neutral-500" />
              Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <div className="relative border-l border-neutral-200 ml-3 pl-6 space-y-6">
              {request.activities.length === 0 ? (
                <p className="text-xs text-muted-foreground pl-2 py-4">No activities recorded yet.</p>
              ) : (
                request.activities.map((activity: ActivityDTO) => (
                  <div key={activity.id} className="relative">
                    {/* Circle marker */}
                    <span className="absolute -left-[31px] mt-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-neutral-300 ring-4 ring-white" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-neutral-800">
                        {ACTIVITY_LABELS[activity.type] || activity.type}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatRelative(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
