import React from "react";

export const filesApi = {
  async getFile(fileId: string) {
    const res = await fetch(`/api/files/${fileId}`);
    if (!res.ok) throw new Error("Failed to fetch file");
    return res.json();
  },
  async updateStatus(fileId: string, status: string) {
    const res = await fetch(`/api/files/${fileId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error("Failed to update status");
    return res.json();
  },
  async list() {
    const res = await fetch(`/api/files`);
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
  async move(fileId: string, payload: any) {
    const res = await fetch(`/api/files/${fileId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to move file");
    return res.json();
  },
  async addRequirement(fileId: string, payload: any) {
    const res = await fetch(`/api/files/${fileId}/requirements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to add requirement");
    return res.json();
  },
  async updateRequirement(fileId: string, taskId: string, payload: any) {
    const res = await fetch(`/api/files/${fileId}/requirements/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error("Failed to update requirement");
    return res.json();
  },
  async addNote(fileId: string, note: string) {
    const res = await fetch(`/api/files/${fileId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error("Failed to add note");
    return res.json();
  },
};

export function FileBoardCard(props: any) {
  return null;
}
