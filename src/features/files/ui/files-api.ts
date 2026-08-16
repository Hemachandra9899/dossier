import React from "react";

export const filesApi = {
  async list(teamId: string) {
    const res = await fetch(`/api/files?teamId=${encodeURIComponent(teamId)}`);
    if (!res.ok) throw new Error("Failed to fetch files");
    return res.json();
  },
  async create(payload: any) {
    const res = await fetch(`/api/files`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to create file");
    return res.json();
  },
  async move(input: {
    fileId: string;
    status: string;
    position: number;
  }) {
    const res = await fetch(`/api/files/${input.fileId}/move`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: input.status,
        position: input.position,
      }),
    });
    if (!res.ok) throw new Error("Failed to move file");
    return res.json();
  },
};

export type FileBoardCard = {
  id: string;
  title: string;
  clientName: string | null;
  status: string;
  priority: string;
  position: number;
  dueAt: string | null;
  progress: {
    completed: number;
    total: number;
    percent: number;
  };
  owner: {
    name: string | null;
    email: string | null;
  } | null;
  activeSignature: {
    status: string;
  } | null;
};
