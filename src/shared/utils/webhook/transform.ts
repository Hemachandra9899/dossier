import { newId } from "@/shared/utils/id-helper";
import { webhookPayloadSchema } from "@/shared/utils/zod/schemas/webhooks";

import { WebhookTrigger } from "./types";

export const prepareWebhookPayload = (trigger: WebhookTrigger, data: any) => {
  const payload = webhookPayloadSchema.parse({
    id: newId("webhookEvent"),
    event: trigger,
    data: data,
    createdAt: new Date().toISOString(),
  });

  return payload;
};
