export type FileBoardCard = {
  id: string;
  teamId: string;
  dataroomId: string;
  title: string;
  clientName: string | null;
  clientEmail: string | null;
  reference: string | null;
  caseType: string | null;
  status: string;
  priority: string;
  dueAt: string | null;
  position: number;
  requiresSignature: boolean;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  } | null;
  progress: {
    completed: number;
    submitted: number;
    total: number;
    percent: number;
  };
  activeSignature: {
    id: string;
    status: string;
  } | null;
  clientLink: {
    id: string;
    url: string | null;
    name: string | null;
    enableUpload: boolean | null;
    expiresAt: string | null;
  } | null;
};

async function jsonOrThrow<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error || "Request failed");
  }
  return data;
}

export const filesApi = {
  async list(teamId: string) {
    return jsonOrThrow<{ files: FileBoardCard[] }>(
      await fetch(`/api/files?teamId=${encodeURIComponent(teamId)}`),
    );
  },

  async create(input: Record<string, unknown>) {
    return jsonOrThrow<{ file: any }>(
      await fetch("/api/files", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    );
  },

  async move(input: {
    fileId: string;
    status: string;
    position: number;
  }) {
    return jsonOrThrow<{ file: any }>(
      await fetch(`/api/files/${input.fileId}/move`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: input.status,
          position: input.position,
        }),
      }),
    );
  },

  async addNote(fileId: string, body: string) {
    return jsonOrThrow<{ note: any }>(
      await fetch(`/api/files/${fileId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body }),
      }),
    );
  },

  async addRequirement(fileId: string, input: Record<string, unknown>) {
    return jsonOrThrow<{ task: any }>(
      await fetch(`/api/files/${fileId}/requirements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    );
  },

  async updateRequirement(fileId: string, taskId: string, input: { status: string; comment?: string }) {
    return jsonOrThrow(
      await fetch(`/api/files/${fileId}/requirements/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input),
      }),
    );
  },
};
