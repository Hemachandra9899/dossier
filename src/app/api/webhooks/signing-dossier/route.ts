// POST /api/webhooks/signing-dossier — receive Documenso signing webhooks for
// the new Dossier SignatureRequest flow.
//
// verify -> validate -> derive dedupeKey -> INSERT into the SigningProviderEvent
// inbox (idempotent) -> acknowledge quickly -> durable processing on Trigger.dev.
// Unlike the legacy Agreement flow this never uses waitUntil.

import { NextRequest, NextResponse } from "next/server";

import { createSigningContext } from "@/modules/signing/application/context";
import { isDossierSigningRuntimeEnabled } from "@/modules/signing/config";
import { createProviderEventDedupeKey } from "@/modules/signing/domain/signing-event";
import { DOCUMENSO_SIGNING_EVENTS, mapDocumensoEventToStatus } from "@/modules/signing/provider/documenso/mapper";
import {
  DOCUMENSO_WEBHOOK_SECRET_HEADER,
  documensoWebhookPayloadSchema,
  verifyDocumensoWebhookSecret,
} from "@/modules/signing/provider/documenso/webhook";
import { processSigningProviderEventTask } from "@/lib/trigger/process-signing-provider-event";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get(DOCUMENSO_WEBHOOK_SECRET_HEADER);
  const { ok, configured } = verifyDocumensoWebhookSecret(secretHeader);

  // Missing secret => misconfiguration (503 so Documenso keeps retrying);
  // wrong secret => forgery (401 immediately).
  if (!configured) {
    return NextResponse.json(
      { message: "Signing webhook is not configured." },
      { status: 503 },
    );
  }
  if (!ok) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  // Runtime kill switch: when signing is disabled at runtime, provider events
  // are acknowledged but never inboxed. The legacy Agreement webhook is
  // unaffected.
  if (!isDossierSigningRuntimeEnabled) {
    return NextResponse.json({ ok: true });
  }

  try {
    const body = await req.json().catch(() => null);
    const parseResult = documensoWebhookPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      // 400 (not 200) so Documenso surfaces schema drift.
      return NextResponse.json({ message: "Invalid webhook payload." }, { status: 400 });
    }

    const {
      event,
      payload: { id: documentId, externalId },
    } = parseResult.data;

    // Only inbox events that map onto Dossier request state.
    if (!DOCUMENSO_SIGNING_EVENTS.has(event) || !externalId) {
      return NextResponse.json({ ok: true });
    }

    const ctx = createSigningContext();

    const dedupeKey = createProviderEventDedupeKey({
      event,
      externalId,
      documentId,
    });

    const { created, id } = await ctx.events.insertIfAbsent({
      provider: "DOCUMENSO",
      dedupeKey,
      eventType: event,
      externalId,
      providerDocumentId: documentId,
      payload: parseResult.data,
    });

    // Duplicate delivery: acknowledged, never processed twice.
    if (!created) {
      return NextResponse.json({ ok: true });
    }

    // Acknowledge immediately; business processing + artifact mirroring run
    // durably on Trigger.dev.
    await processSigningProviderEventTask.trigger({ eventId: id });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[signing] dossier webhook handler failed", error);
    // Never echo the internal error — Documenso retry logs could leak internals.
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
