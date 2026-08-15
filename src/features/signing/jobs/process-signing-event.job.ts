// Durable webhook-event processor. The webhook route only verifies + dedupes
// into the SigningProviderEvent inbox and acknowledges; this task does the
// business processing with retries and records success/failure on the inbox
// row. processProviderEvent is idempotent (re-applying an already-applied
// event is a no-op), so retries are safe.

import { task } from "@trigger.dev/sdk";

import { createSigningContext } from "@/features/signing/application/context";
import { processProviderEvent } from "@/features/signing/application/process-provider-event";
import { signingProviderEventQueue } from "@/platform/queue/trigger/queues";

export const processSigningProviderEventTask = task({
  id: "process-signing-provider-event",
  queue: signingProviderEventQueue,
  retry: { maxAttempts: 5 },
  run: async (payload: { eventId: string }) => {
    const ctx = createSigningContext();

    const event = await ctx.events.findById(payload.eventId);
    if (!event) {
      throw new Error("Signing provider event not found.");
    }
    if (event.processedAt) {
      return { processed: false, reason: "already-processed" };
    }
    if (!event.externalId) {
      throw new Error("Signing provider event is missing its externalId.");
    }

    try {
      await processProviderEvent(ctx, {
        event: event.eventType,
        externalId: event.externalId,
      });
      await ctx.events.markProcessed(event.id);
      return { processed: true };
    } catch (error) {
      await ctx.events.markFailed(
        event.id,
        error instanceof Error ? error.name : "unknown",
      );
      throw error;
    }
  },
});
