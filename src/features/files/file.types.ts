// Core DTOs for the Files board.

export type FileBoardItem = {
  id: string;

  title: string;
  clientName: string | null;
  caseType: string | null;

  status: FileStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";

  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;

  dueAt: string | null;

  requirements: {
    total: number;
    completed: number;
    submitted: number;
    corrections: number;
  };

  signing: {
    required: boolean;
    status: string | null;
    signed: number;
    total: number;
  };

  position: number;
};

export type FileDetail = {
  id: string;

  title: string;
  clientName: string | null;
  clientEmail: string | null;
  reference: string | null;
  caseType: string | null;

  status: FileStatus;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";

  owner: {
    id: string;
    name: string | null;
    image: string | null;
  } | null;

  dueAt: string | null;

  requiresSignature: boolean;

  completedAt: string | null;
};

export type FileActivity = {
  id: string;

  type: string;

  actor: {
    id: string;
    name: string | null;
  } | null;

  message: string;

  createdAt: string;
};

export type CreateFileInput = {
  clientName: string;
  clientEmail?: string | null;
  title: string;
  caseType?: string | null;
  ownerId?: string | null;
  dueAt?: string | null;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  requiresSignature: boolean;
};

export type MoveFileInput = {
  status: FileStatus;
  beforeId?: string | null;
  afterId?: string | null;
};

export type FileColumnLayout = Record<string, FileBoardItem[]>;