import { createSigningContext } from "@/features/signing/application/context";
import { createRequest } from "@/features/signing/application/create-request";
import { cancelRequest } from "@/features/signing/application/cancel-request";
import { createSigningSession } from "@/features/signing/application/create-signing-session";

export const signingService = {
  createSigningContext,
  createRequest,
  cancelRequest,
  createSigningSession,
};
