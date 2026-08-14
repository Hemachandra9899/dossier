import { createSigningContext } from "@/modules/signing/application/context";
import { createRequest } from "@/modules/signing/application/create-request";
import { cancelRequest } from "@/modules/signing/application/cancel-request";
import { createSigningSession } from "@/modules/signing/application/create-signing-session";

export const signingService = {
  createSigningContext,
  createRequest,
  cancelRequest,
  createSigningSession,
};
