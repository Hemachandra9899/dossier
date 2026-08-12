import { useEffect, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { useTeam } from "@/context/team-context";
import { filesApi } from "@/modules/files/ui/files-api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  onCreated: () => void;
};

export function CreateFileDialog({ onCreated }: Props) {
  const team = useTeam();
  const teamId = team?.currentTeam?.id;

  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [caseType, setCaseType] = useState("");
  const [reference, setReference] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [templateId, setTemplateId] = useState("");

  // Fetch team members for Owner selection dropdown
  const { data: teamData } = useSWR(
    teamId ? `/api/teams/${teamId}` : null
  );
  const members = teamData?.users ?? [];

  // Fetch templates for selection dropdown
  const { data: templatesData } = useSWR(
    teamId ? `/api/files/templates?teamId=${teamId}` : null
  );
  const templates = templatesData?.templates ?? [];

  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      // Reset form fields
      setTitle("");
      setClientName("");
      setClientEmail("");
      setCaseType("");
      setReference("");
      setOwnerId("");
      setDueAt("");
      setPriority("NORMAL");
      setRequiresSignature(false);
      setTemplateId("");
    };

    window.addEventListener("dossier:create-file", handleOpen);
    return () => window.removeEventListener("dossier:create-file", handleOpen);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamId) return;

    if (!title.trim()) {
      toast.error("File title is required.");
      return;
    }

    setLoading(true);
    try {
      await filesApi.create({
        teamId,
        title: title.trim(),
        clientName: clientName.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        reference: reference.trim() || undefined,
        caseType: caseType.trim() || undefined,
        priority,
        ownerId: ownerId || undefined,
        dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
        requiresSignature,
        templateId: templateId || undefined,
      });

      toast.success("File created successfully!");
      setIsOpen(false);
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New Client File</DialogTitle>
          <DialogDescription>
            Create an operational file with backing client portal.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              File Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Mortgage Pre-approval"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Document Checklist Template
            </label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-neutral-200 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">Custom (Empty Checklist)</option>
              {templates.map((t: any) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Client Name
              </label>
              <input
                type="text"
                placeholder="John Smith"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Client Email
              </label>
              <input
                type="email"
                placeholder="john@example.com"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Case Type
              </label>
              <input
                type="text"
                placeholder="Mortgage"
                value={caseType}
                onChange={(e) => setCaseType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Reference ID
              </label>
              <input
                type="text"
                placeholder="REF-00192"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Owner
              </label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select teammate...</option>
                {members.map((m: any) => (
                  <option key={m.userId} value={m.userId}>
                    {m.user.name || m.user.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Due Date
              </label>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="flex h-9 w-full rounded-md border border-neutral-200 bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
            <div className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                id="requiresSignature"
                checked={requiresSignature}
                onChange={(e) => setRequiresSignature(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
              />
              <label htmlFor="requiresSignature" className="text-sm font-medium text-neutral-700">
                Requires Signature
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create File"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
