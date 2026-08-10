// Durable signed-artifact mirror job. Replaces the legacy best-effort
// waitUntil mirror for the new Dossier SignatureRequest flow: this runs on
// Trigger.dev with retries, so "user signed" can never lose the final PDF.

import { logger, task } from "@trigger.dev/sdk";

import { createSigningContext } from "@/modules/signing/application/context";
import { mirrorSignedArtifact } from "@/modules/signing/application/mirror-signed-artifact";
import { signatureArtifactMirrorQueue } from "@/lib/trigger/queues";

export const mirrorSignatureArtifactTask = task({
  id: "signature-artifact-mirror",
  queue: signatureArtifactMirrorQueue,
  retry: { maxAttempts: 5 },
  run: async (payload: { requestId: string }) => {
    const ctx = createSigningContext();
    const result = await mirrorSignedArtifact(ctx, payload);

    if (!result.mirrored) {
      logger.info("signature artifact mirror skipped", {
        requestId: payload.requestId,
        reason: result.reason,
      });
    }

    return result;
  },
});
