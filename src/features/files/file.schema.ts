// Validation schemas for Files board.

import { z } from "zod";

import { FileStatus } from "./file-status";

export const CreateFileSchema = z.object({
  clientName: z.string().min(1),
  clientEmail: z.string().email().nullable(),
  title: z.string().min(1),
  caseType: z.string().nullable(),
  ownerId: z.string().nullable(),
  dueAt: z.string().datetime().nullable(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  requiresSignature: z.boolean(),
});

export const MoveFileSchema = z.object({
  status: z.enum(FILE_STATUSES),
  beforeId: z.string().nullable(),
  afterId: z.string().nullable(),
});

// Schema for a single board item returned from the API.

export const FileBoardItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  clientName: z.string().nullable(),
  caseType: z.string().nullable(),
  status: z.nativeEnum(FileStatus),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]),
  owner: z.object({
    id: z.string(),
    name: z.string().nullable(),
    image: z.string().nullable(),
  }).nullable(),
  dueAt: z.string().nullable().optional(),
  requirements: z.object({
    total: z.number(),
    completed: z.number(),
    submitted: z.number(),
    corrections: z.number(),
  }),
  signing: z.object({
    required: z.boolean(),
    status: z.string().nullable(),
    signed: z.number(),
    total: z.number(),
  }),
  position: z.number(),
});