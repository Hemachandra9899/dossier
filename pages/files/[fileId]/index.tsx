import { useRouter } from "next/router";
import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useTeam } from "@/context/team-context";
import AppLayout from "@/components/layouts/app";
import LoadingSpinner from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { DataroomLinkSheet } from "@/components/links/link-sheet/dataroom-link-sheet";
import { RequestManagement } from "@/modules/signing/ui/request-management";
import { RequestSignatureDialog } from "@/modules/signing/ui/request-signature/request-signature-dialog";
import { filesApi } from "@/modules/files/ui/files-api";
import {
  CalendarDays,
  FileCheck2,
  PenLine,
  UserRound,
  FileText,
  Share2,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Trash,
  AlertTriangle,
  RefreshCw,
  UserCheck,
  Eye,
  MapPin,
  Calendar,
  Building2,
} from "lucide-react";

export default function FileDetailPage() {
  const router = useRouter();
  const { fileId } = router.query as { fileId?: string };

  const team = useTeam();
  const teamId = team?.currentTeam?.id;

  const [activeTab, setActiveTab] = useState<
    "overview" | "requirements" | "documents" | "signatures" | "activity"
  >("overview");

  // Form states
  const [noteBody, setNoteBody] = useState("");
  const [reqTitle, setReqTitle] = useState("");
  const [reqType, setReqType] = useState<"TODO" | "UPLOAD" | "ACKNOWLEDGE">("UPLOAD");
  const [reqDesc, setReqDesc] = useState("");
  const [reqEmail, setReqEmail] = useState("");
  const [isAddingReq, setIsAddingReq] = useState(false);

  // Correction request states
  const [activeCorrectionTaskId, setActiveCorrectionTaskId] = useState<string | null>(null);
  const [correctionComment, setCorrectionComment] = useState("");

  // Signature creation modal states
  const [signDocId, setSignDocId] = useState<string | null>(null);
  const [signDocName, setSignDocName] = useState("");
  const [isSignOpen, setIsSignOpen] = useState(false);

  // DataroomLinkSheet open state
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Dismiss issue dialog state
  const [dismissDialog, setDismissDialog] = useState<{
    open: boolean;
    taskId: string;
    issueId: string;
  } | null>(null);
  const [dismissReason, setDismissReason] = useState("");
  const [isDismissing, setIsDismissing] = useState(false);

  // Fetch full details
  const { data, mutate, isLoading } = useSWR(
    fileId ? `/api/files/${fileId}` : null,
    async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to load details");
      return response.json();
    }
  );

  const file = data?.file;
  const notes = data?.notes ?? [];
  const timeline = data?.timeline ?? [];

  if (isLoading || !file) {
    return (
      <AppLayout>
        <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
          <LoadingSpinner className="h-10 w-10" />
        </div>
      </AppLayout>
    );
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteBody.trim()) return;

    try {
      await filesApi.addNote(file.id, noteBody.trim());
      setNoteBody("");
      toast.success("Note added!");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add note.");
    }
  };

  const handleAddRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reqTitle.trim()) return;

    try {
      await filesApi.addRequirement(file.id, {
        title: reqTitle.trim(),
        type: reqType,
        description: reqDesc.trim() || undefined,
        assigneeEmail: reqEmail.trim() || undefined,
      });
      setReqTitle("");
      setReqDesc("");
      setReqEmail("");
      setIsAddingReq(false);
      toast.success("Requirement added!");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to add requirement.");
    }
  };

  const handleApproveRequirement = async (taskId: string) => {
    try {
      await filesApi.updateRequirement(file.id, taskId, {
        status: "COMPLETED",
      });
      toast.success("Requirement marked complete!");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to approve requirement.");
    }
  };

  const handleRequestCorrection = async (taskId: string) => {
    if (!correctionComment.trim()) {
      toast.error("Please enter a correction comment.");
      return;
    }

    try {
      await filesApi.updateRequirement(file.id, taskId, {
        status: "OPEN",
        comment: correctionComment.trim(),
      });
      setActiveCorrectionTaskId(null);
      setCorrectionComment("");
      toast.success("Correction requested!");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to request correction.");
    }
  };

  /** Open the dismiss dialog — restoring an issue skips the dialog. */
  const openDismissDialog = (taskId: string, issueId: string) => {
    setDismissReason("");
    setDismissDialog({ open: true, taskId, issueId });
  };

  /** Called when the user confirms a dismissal with a reason. */
  const handleConfirmDismiss = async () => {
    if (!dismissDialog) return;
    if (dismissReason.trim().length < 3) {
      toast.error("Please enter a reason of at least 3 characters.");
      return;
    }
    setIsDismissing(true);
    try {
      const res = await fetch(
        `/api/files/${file.id}/requirements/${dismissDialog.taskId}/analysis`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            issueId: dismissDialog.issueId,
            dismissed: true,
            dismissalReason: dismissReason.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Issue dismissed");
      void mutate();
      setDismissDialog(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to dismiss issue.");
    } finally {
      setIsDismissing(false);
    }
  };

  /** Restore a previously dismissed issue — no reason required. */
  const handleRestoreIssue = async (taskId: string, issueId: string) => {
    try {
      const res = await fetch(
        `/api/files/${file.id}/requirements/${taskId}/analysis`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ issueId, dismissed: false }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      toast.success("Issue restored");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore issue.");
    }
  };

  const handleReanalyze = async (taskId: string) => {
    try {
      const res = await fetch(`/api/files/${file.id}/requirements/${taskId}/reanalyze`, {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error(await res.text());
      }
      toast.success("Re-analysis triggered in background!");
      void mutate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to trigger re-analysis.");
    }
  };

  function renderStatusBadge(status: string) {
    switch (status) {
      case "VERIFIED":
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Verified</Badge>;
      case "NEEDS_REVIEW":
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100">Needs Review</Badge>;
      case "ISSUE":
        return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Issue</Badge>;
      case "PENDING":
      default:
        return <Badge className="bg-neutral-100 text-neutral-600 border-neutral-200 hover:bg-neutral-100">Pending</Badge>;
    }
  }

  // Helper relative time formatter
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

  const tasks = file.requirementsTaskList?.tasks ?? [];

  return (
    <AppLayout>
      <main className="mx-4 my-6 min-w-0 md:mx-8 space-y-6">
        {/* Header Block */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{file.priority}</Badge>
              <Badge className="capitalize">{file.status.toLowerCase().replace(/_/g, " ")}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-800 dark:text-neutral-100 mt-2">
              {file.clientName || file.title}
            </h1>
            {file.clientName && (
              <p className="text-sm text-muted-foreground">{file.title}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setIsShareOpen(true)}>
              <Share2 className="h-4 w-4" />
              Share File Link
            </Button>
            <Button
              asChild
              variant="outline"
            >
              <a href={`/datarooms/${file.dataroom.pId}`} target="_blank" rel="noopener noreferrer">
                View Client Portal
              </a>
            </Button>
          </div>
        </header>

        {/* Tab Controls */}
        <div className="flex border-b gap-6 text-sm font-medium">
          {(["overview", "requirements", "documents", "signatures", "activity"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "pb-3 capitalize transition-all border-b-2 -mb-[2px]",
                activeTab === tab
                  ? "border-neutral-800 text-neutral-800 dark:border-neutral-100 dark:text-neutral-100"
                  : "border-transparent text-neutral-500 hover:text-neutral-800",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-3">
            {/* Meta details */}
            <div className="space-y-6 md:col-span-2">
              <div className="bg-background rounded-xl border p-5 space-y-4">
                <h3 className="font-semibold text-sm text-neutral-500 uppercase tracking-wider">File Context</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground block text-xs">Client Email</span>
                    <span className="font-medium">{file.clientEmail || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Case Type</span>
                    <span className="font-medium">{file.caseType || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Reference ID</span>
                    <span className="font-medium">{file.reference || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-xs">Due Date</span>
                    <span className="font-medium">
                      {file.dueAt ? new Date(file.dueAt).toLocaleDateString() : "No due date"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Internal Notes block */}
              <div className="space-y-4">
                <h3 className="font-semibold text-sm text-neutral-800">Internal Notes</h3>
                <form onSubmit={handleAddNote} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Add coordinator note..."
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Button type="submit" size="sm" className="gap-1.5">
                    <Send className="h-3.5 w-3.5" />
                    Comment
                  </Button>
                </form>

                <div className="space-y-3">
                  {notes.map((note: any) => (
                    <div key={note.id} className="rounded-lg border p-4 text-sm bg-neutral-50">
                      <p className="text-neutral-700 leading-relaxed">{note.body}</p>
                      <span className="text-[10px] text-muted-foreground block mt-2">
                        Posted {formatRelative(note.createdAt)}
                      </span>
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <p className="text-center text-xs text-muted-foreground py-4 border border-dashed rounded-lg">
                      No internal notes yet.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Checklist stats sidebar */}
            <div className="bg-background rounded-xl border p-5 space-y-4 h-fit">
              <h3 className="font-semibold text-sm text-neutral-800">Completion Summary</h3>
              <div className="text-3xl font-extrabold tracking-tight">
                {file.requirementsTaskList?.tasks.filter((t: any) => t.status === "COMPLETED").length ?? 0} /{" "}
                {file.requirementsTaskList?.tasks.length ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">Requirements approved by coordinators.</p>
            </div>
          </div>
        )}

        {activeTab === "requirements" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm text-neutral-800">Checklist & Requests</h3>
              <Button size="sm" className="gap-1" onClick={() => setIsAddingReq(!isAddingReq)}>
                <Plus className="h-3.5 w-3.5" />
                Add Requirement
              </Button>
            </div>

            {/* Add requirement form */}
            {isAddingReq && (
              <form onSubmit={handleAddRequirement} className="bg-neutral-50 border rounded-xl p-5 space-y-4 max-w-lg">
                <h4 className="text-sm font-semibold">New Checklist Request</h4>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-500 uppercase">Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Proof of Address"
                      value={reqTitle}
                      onChange={(e) => setReqTitle(e.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 uppercase">Type</label>
                      <select
                        value={reqType}
                        onChange={(e: any) => setReqType(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-neutral-200 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="UPLOAD">Upload Document</option>
                        <option value="TODO">Internal Todo</option>
                        <option value="ACKNOWLEDGE">Acknowledge Statement</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-500 uppercase">Assignee Email</label>
                      <input
                        type="email"
                        placeholder="client@example.com"
                        value={reqEmail}
                        onChange={(e) => setReqEmail(e.target.value)}
                        className="mt-1 flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-500 uppercase">Instructions / Details</label>
                    <textarea
                      placeholder="Provide specific notes on what is needed..."
                      value={reqDesc}
                      onChange={(e) => setReqDesc(e.target.value)}
                      className="mt-1 flex min-h-[60px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsAddingReq(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Add
                  </Button>
                </div>
              </form>
            )}

            {/* Checklist tasks */}
            <div className="space-y-3">
              {tasks.map((task: any) => (
                <div key={task.id} className="border rounded-xl p-4 bg-background flex flex-col gap-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-800 truncate">{task.title}</span>
                        <span className="text-[10px] uppercase font-bold tracking-wider bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded">
                          {task.type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {task.status}
                        </Badge>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{task.description}</p>
                      )}
                      {task.assignments && task.assignments.length > 0 && (
                        <span className="text-[10px] text-muted-foreground block">
                          Assigned to: {task.assignments.map((a: any) => a.email).join(", ")}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.status === "SUBMITTED" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleApproveRequirement(task.id)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setActiveCorrectionTaskId(task.id)}
                          >
                            Request Correction
                          </Button>
                        </>
                      )}

                      {task.status === "COMPLETED" && (
                        <span className="text-green-600 flex items-center gap-1 text-xs font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          Approved
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Verification Card */}
                  {task.type === "UPLOAD" && task.analyses?.[0] && (
                    <div className="border border-neutral-100 rounded-lg p-3 bg-neutral-50/50 space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-neutral-700">AI Document Verification</span>
                          {renderStatusBadge(task.analyses[0].status)}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 px-2 text-neutral-500 hover:text-neutral-700"
                          onClick={() => handleReanalyze(task.id)}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Reanalyze
                        </Button>
                      </div>

                      <div className="flex items-center gap-1.5 text-neutral-600 border-t pt-2">
                        <span className="font-medium">Detected Kind:</span>
                        <span className="bg-neutral-100 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                          {task.analyses[0].extractedKind?.replace(/_/g, " ") || "UNKNOWN"}
                        </span>
                        {task.analyses[0].confidenceScore !== null && (
                          <span className="text-neutral-400">
                            (Confidence: {(task.analyses[0].confidenceScore * 100).toFixed(0)}%)
                          </span>
                        )}
                      </div>

                      {Array.isArray(task.analyses[0].checks) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-2">
                          {task.analyses[0].checks.map((check: any) => (
                            <div key={check.code} className="flex items-start gap-1.5">
                              {check.pass ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                              ) : (
                                <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              )}
                              <div className="space-y-0.5">
                                <span className="font-medium text-neutral-700">
                                  {check.code.replace(/_/g, " ")}
                                </span>
                                <span className="block text-[10px] text-neutral-500 leading-normal">
                                  {check.message}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {Array.isArray(task.analyses[0].issues) && task.analyses[0].issues.length > 0 && (
                        <div className="border-t pt-2 space-y-2">
                          <span className="font-semibold text-neutral-700 block">Verification Issues</span>
                          <div className="space-y-1.5">
                            {task.analyses[0].issues.map((issue: any) => (
                              <div
                                key={issue.id}
                                className={`flex items-start justify-between gap-4 p-2 rounded border ${
                                  issue.dismissed
                                    ? "bg-neutral-100/50 border-neutral-100 text-neutral-400"
                                    : "bg-red-50/30 border-red-100 text-red-700"
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`font-semibold text-[9px] uppercase tracking-wider px-1 py-0.5 rounded ${
                                      issue.dismissed
                                        ? "bg-neutral-200 text-neutral-600"
                                        : "bg-red-100 text-red-800"
                                    }`}>
                                      {issue.checkCode.replace(/_/g, " ")}
                                    </span>
                                    {issue.dismissed && (
                                      <span className="text-[9px] text-neutral-400 font-medium italic">
                                        (Dismissed)
                                      </span>
                                    )}
                                  </div>
                                  <span className="block text-xs leading-normal">{issue.message}</span>
                                  {issue.evidence && (
                                    <span className="block text-[9px] text-neutral-500 font-mono">
                                      Evidence: {issue.evidence}
                                    </span>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-[10px] text-neutral-500 hover:text-neutral-800 shrink-0"
                                  onClick={() =>
                                    issue.dismissed
                                      ? handleRestoreIssue(task.id, issue.id)
                                      : openDismissDialog(task.id, issue.id)
                                  }
                                >
                                  {issue.dismissed ? "Restore" : "Dismiss"}
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reject / correction comment panel */}
                  {activeCorrectionTaskId === task.id && (
                    <div className="w-full mt-4 pt-4 border-t space-y-2">
                      <label className="text-xs font-semibold text-neutral-500 uppercase block">Correction Details</label>
                      <input
                        type="text"
                        placeholder="Please upload a clearer copy..."
                        value={correctionComment}
                        onChange={(e) => setCorrectionComment(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1"
                      />
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" variant="outline" onClick={() => setActiveCorrectionTaskId(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleRequestCorrection(task.id)}>
                          Reject Submission
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {tasks.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
                  No required document requests. Click &quot;Add Requirement&quot; to request client documents.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "documents" && (
          <div className="space-y-6">
            <h3 className="font-semibold text-sm text-neutral-800">Files & Documents</h3>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {file.dataroom.documents.map((row: any) => {
                const doc = row.document;
                const isPdf = doc.versions[0]?.contentType === "application/pdf";
                return (
                  <div key={row.id} className="border rounded-xl p-4 bg-background flex flex-col justify-between h-36">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate text-neutral-800">{doc.name}</h4>
                      <span className="text-[10px] text-muted-foreground block mt-1">
                        Updated {formatRelative(doc.updatedAt)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center mt-4 pt-2 border-t">
                      <Button asChild size="sm" variant="ghost">
                        <a href={`/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">
                          Open Details
                        </a>
                      </Button>

                      {isPdf && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSignDocId(doc.id);
                            setSignDocName(doc.name);
                            setIsSignOpen(true);
                          }}
                        >
                          Request Sign
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}

              {file.dataroom.documents.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50 col-span-full">
                  No documents uploaded to this file dataroom. Files uploaded by clients will appear here.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "signatures" && (
          <div className="space-y-6">
            <h3 className="font-semibold text-sm text-neutral-800">Linked Signature Envelopes</h3>
            <div className="space-y-6">
              {file.signatureRequests.map((req: any) => (
                <div key={req.id} className="border rounded-xl p-4 bg-background space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b">
                    <h4 className="font-bold text-sm">Envelope Status</h4>
                    <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded uppercase">
                      {req.status}
                    </span>
                  </div>
                  {/* Reuse RequestManagement component */}
                  <RequestManagement teamId={file.teamId} requestId={req.id} onStateChange={() => void mutate()} />
                </div>
              ))}

              {file.signatureRequests.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
                  No signature requests linked to this file. Launch a request from the Documents tab.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="space-y-6">
            <h3 className="font-semibold text-sm text-neutral-800">Unified Timeline</h3>
            <div className="relative border-l pl-4 ml-2 space-y-6">
              {timeline.map((act: any, idx: number) => {
                let label = act.type;
                if (act.source === "FILE") {
                  if (act.type === "FILE_CREATED") label = "File created by coordinator";
                  if (act.type === "STATUS_CHANGED") label = `Status changed to: ${act.metadata?.to}`;
                  if (act.type === "REQUIREMENT_CREATED") label = `Requirement created: "${act.metadata?.title}"`;
                  if (act.type === "REQUIREMENT_COMPLETED") label = `Requirement approved: "${act.metadata?.taskTitle}"`;
                  if (act.type === "CORRECTION_REQUESTED") label = `Correction requested for "${act.metadata?.taskTitle}": "${act.metadata?.comment}"`;
                  if (act.type === "NOTE_ADDED") label = "Coordinator note added";
                  if (act.type === "SIGNATURE_REQUEST_LINKED") label = "Signature request initiated";
                } else if (act.source === "REQUIREMENT") {
                  if (act.type === "CREATED") label = `Requirement requested: "${act.metadata?.taskTitle}"`;
                  if (act.type === "STATUS_CHANGED") label = `Requirement status moved to ${act.metadata?.toStatus}`;
                } else if (act.source === "SIGNATURE") {
                  if (act.type === "REQUEST_CREATED") label = "Signature request initialized with Documenso";
                  if (act.type === "RECIPIENT_SIGNED") label = `${act.metadata?.recipient?.name || "Signer"} signed the document`;
                  if (act.type === "REQUEST_COMPLETED") label = "Document fully signed & completed";
                }

                return (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[21px] top-1.5 flex h-2 w-2 rounded-full bg-neutral-400" />
                    <div className="text-sm font-medium text-neutral-800">{label}</div>
                    <span className="text-[10px] text-muted-foreground block">
                      {formatRelative(act.at)}
                    </span>
                  </div>
                );
              })}

              {timeline.length === 0 && (
                <p className="text-center text-xs text-muted-foreground py-8 border border-dashed rounded-lg bg-neutral-50">
                  No activity history logged.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Global modals/sheets */}
        {isShareOpen && (
          <DataroomLinkSheet
            isOpen={isShareOpen}
            setIsOpen={setIsShareOpen}
            linkType="DATAROOM_LINK"
            linkTargetId={file.dataroomId}
          />
        )}

        {isSignOpen && signDocId && (
          <RequestSignatureDialog
            open={isSignOpen}
            onOpenChange={setIsSignOpen}
            teamId={file.teamId}
            documentId={signDocId}
            documentName={signDocName}
            isPdf={true}
            dossierFileId={file.id}
            onCreated={() => {
              setIsSignOpen(false);
              setSignDocId(null);
              setActiveTab("signatures");
              void mutate();
            }}
          />
        )}
        {/* Dismiss verification issue dialog */}
        <Dialog
          open={!!dismissDialog?.open}
          onOpenChange={(open) => {
            if (!open) setDismissDialog(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Dismiss verification issue</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Label htmlFor="dismissReason" className="text-sm font-medium">
                Reason
              </Label>
              <Textarea
                id="dismissReason"
                placeholder="e.g. Client moved to this address on July 10"
                value={dismissReason}
                onChange={(e) => setDismissReason(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-[11px] text-muted-foreground">
                Minimum 3 characters. This reason will be stored on the issue record.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDismissDialog(null)}
                disabled={isDismissing}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmDismiss}
                disabled={isDismissing || dismissReason.trim().length < 3}
              >
                {isDismissing ? "Dismissing…" : "Dismiss issue"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </AppLayout>
  );
}
