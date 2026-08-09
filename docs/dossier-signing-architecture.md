# Dossier — Signing Architecture Audit (Checkpoint 1)

**Date:** 2026-08-10
**Scope:** Research only. No product code was changed.
**Repos audited:**
- Papermark fork (the Dossier application): `/Users/teja/Desktop/papermark` (HEAD `3e3ab9ab`)
- Documenso fork (the signing engine): `/Users/teja/Documents/documenso` (v2.16.0)

---

## 1. Architecture decision

```text
DOSSIER
═══════════════════════════════════════════

PRIMARY CODEBASE
Papermark fork

PURPOSE
UI
Authentication
Teams/workspaces
Documents
Folders
Datarooms
Sharing
Viewer
Analytics
Contacts
Billing
Signature orchestration
Final signed document storage

                    │
                    │ HTTPS / SDK
                    ▼

SIGNING ENGINE
Documenso fork

PURPOSE
Signature template
Envelope
Recipients
Fields
Signing session
PDF signature
Signing audit
Temporary signing files

                    │
                    │ Webhooks
                    ▼

                DOSSIER
```

> **Papermark is Dossier. Documenso is infrastructure.**
> The customer should never use the Documenso dashboard.

Core rules (non-negotiable):

1. Do **not** merge the repositories, Prisma schemas, or database tables.
2. Do **not** expose the Documenso dashboard, create Documenso customer accounts, use Documenso billing, or let Documenso drive customer-facing email.
3. Do **not** query the Documenso DB from Dossier. All provider traffic goes over the public V2 API (`HTTPS`/SDK) and authenticated webhooks.
4. Do **not** redesign the Papermark UI, rewrite the Papermark viewer, or remove existing analytics.
5. Signing is **optional**. A document can exist with `SignatureRequest[] = []` (Store/Share only).

---

## 2. The existing integration (verified working reference)

Papermark already contains a working Papermark → Documenso integration. This is the reference implementation. We generalize it, we do not rewrite it from scratch.

### 2.1 End-to-end flow today

**Phase A — Admin prepares (via the Agreement feature)**

1. `components/links/link-sheet/agreement-panel/index.tsx` → `POST /api/teams/{teamId}/agreements` with `signingProvider: "DOCUMENSO"`. Server sets `signingExternalId = papermark:team:{teamId}:agreement:{agreementId}` and a unique slug.
2. Panel calls `POST /api/teams/{teamId}/agreements/{agreementId}/signing/setup` → enqueues Trigger job `setup-signing-template` (idempotency key `${teamId}-${agreement.id}-signing-template-setup`), returns `{ runId, publicAccessToken }`.
3. Panel polls realtime + `GET /signing/setup-status` → resolves `{ presignToken, externalId, envelopeId, host }`.
4. `components/agreements/signing-template-authoring.tsx` mounts `EmbedUpdateEnvelopeV2` (dynamic import from `@documenso/embed-react`); admin places fields; `/signing/presign` re-mints the token for later edits.

**Phase B — Visitor signs**

5. Visitor opens a Papermark link; `components/view/access-form/agreement-section.tsx` renders the signing widget.
6. `POST /api/agreements/signing/session` (Zod-validated) creates/continues the `AgreementResponse`, sets `pm_sas_{linkId}` (90-day HMAC access cookie) + `pm_sds` (30-min download cookie), then mounts `EmbedDirectTemplate` with the template direct-link token and `externalId` = the response's `signingExternalId`.
7. Visitor signs inside Documenso's embedded UI.

**Phase C — Completion**

8. Documenso POSTs `DOCUMENT_SIGNED` / `DOCUMENT_COMPLETED` to `app/api/webhooks/signing/route.ts`.
9. Handler verifies `x-documenso-secret` (`timingSafeEqual`, 503 when unconfigured / 401 on mismatch), looks up the response by `externalId`, calls `syncAgreementResponseWithSigningDocument` (re-verifies `document.externalId` and `document.templateId` bindings), and `waitUntil(mirrorSignedAgreementToStorage)`.
10. Mirror downloads the signed PDF (30s timeout, 50 MB cap) and writes it to team S3 at `${teamId}/agreements/{agreementId}/signed/{agreementResponseId}.pdf`, recording `signedFileKey`/`signedFileName`/`signedFileStorageType`.

### 2.2 SDK surface in use (installed `@documenso/sdk-typescript@0.8.1`)

The installed SDK is the Speakeasy-generated V2 client. Current usage is confined to `lib/signing/*`:

- `templates.create`, `templates.get`, `templates.update` (via setup job / agreements)
- `templates.directLink.create` / `directLink.toggle` / `directLink.delete`
- `templates.use` (direct-link → per-visitor document)
- `documents.get`, `documents.update`
- `envelopes.get`, `envelopes.recipients.createMany` / `updateMany`
- Embed presign tokens are minted via the API route and passed to `@documenso/embed-react`

The SDK also exposes everything else needed for the Dossier domain without any Documenso fork changes: `documents.create`, `documents.distribute`, `documents.download`, `documents.fields.*`, `documents.recipients.*`, `envelopes.*` (audit log, items download), `templates.recipients.*`, `embedding.embeddingPresign.*`.

### 2.3 Webhook contract (Documenso 2.16.0, verified in `packages/trpc/server`)

- Wire body: `{ event, payload, createdAt, webhookEndpoint }`; secret header `X-Documenso-Secret`.
- Event enum (exact strings): `DOCUMENT_CREATED`, `DOCUMENT_SENT`, `DOCUMENT_OPENED`, `DOCUMENT_SIGNED`, `DOCUMENT_COMPLETED`, `DOCUMENT_REJECTED`, `DOCUMENT_CANCELLED`, `RECIPIENT_EXPIRED`, `DOCUMENT_RECIPIENT_COMPLETED`, `DOCUMENT_REMINDER_SENT`, `TEMPLATE_CREATED`, `TEMPLATE_UPDATED`, `TEMPLATE_DELETED`, `TEMPLATE_USED`.
- Payload: `{ id, envelopeId, externalId?, userId, teamId, templateId, title, status, visibility, source, authOptions, formValues, documentMeta, recipients[] }`.
- **There is no unique webhook delivery ID in the payload.** Deduplication must be derived (e.g. `event + payload.id + externalId`), or the Dossier-side `SigningProviderEvent` table must own a dedupe key.
- `DOCUMENT_SIGNED` fires on each recipient signature; `DOCUMENT_COMPLETED` fires after the final recipient signs and the PDF is sealed. `DOCUMENT_REJECTED` fires on decline (rejection). Webhook failures are retried by Documenso's `internal.execute-webhook` job and resendable from its UI.

### 2.4 Email control in Documenso

Per-workflow booleans in `documentMeta.emailSettings` (`recipientSigningRequest`, `recipientRemoved`, `recipientSigned`, `documentPending`, `documentCompleted`, `documentDeleted`, `ownerDocumentCompleted`, `ownerRecipientExpired`, `ownerDocumentCreated`) and `distributionMethod` ≠ `EMAIL` auto-disables recipient emails. **Dossier owns notifications**: Dossier must set `emailSettings` so Documenso does not send independent customer emails.

---

## 3. Reusable code inventory (Papermark)

All of the following is preserved and reused; none of it is rewritten.

| File | What to reuse |
|---|---|
| `lib/signing/client.ts` | Single SDK client instantiation + all signing env vars (`SIGNING_API_KEY`, `SIGNING_API_URL`, `NEXT_PUBLIC_SIGNING_HOST`, `SIGNING_WEBHOOK_SECRET`). Becomes the Documenso adapter client. |
| `lib/signing/agreements.ts` | External-ID builders, webhook secret verification, Viewer recipient + direct-link ensure/delete, team-folder handling, signer access/identity, embed config, signed-state semantics, `syncAgreementResponseWithSigningDocument` anti-tamper checks. **Contains dead code**: `createSigningDocumentFromTemplate`, `getReusableSigningDocumentSession`, `ensureSigningDocumentSession` (defined, imported nowhere). |
| `lib/signing/envelopes.ts` | `getEnvelope`, `getEnvelopeSignedDownloadUrl` (fast path by documentId; legacy envelope-item fallback typed `any`). |
| `lib/signing/mirror.ts` | Guarded signed-PDF download (30s AbortController, 50 MB cap) + mirror to team S3 + overwrite guard (`signedFileKey` presence). |
| `lib/signing/access-token.ts` | `pm_sas_{linkId}` 90-day HMAC-SHA256 access cookie (HttpOnly, SameSite=Lax, Secure in prod). |
| `lib/signing/download-token.ts` | `pm_sds` 30-min path-scoped download cookie. |
| `lib/signing/download.ts` | Client-side signed-PDF download helper + team download URL builder. |
| `lib/signing/setup-status.ts` | Contract + resolution of the Trigger-based template setup status. |
| `lib/signing/template-upload.ts` | Template upload prep: 30 MB cap, `application/pdf` check, presigned S3 URL. |
| `lib/trigger/setup-signing-template.ts` | Trigger job that creates the Documenso template, sets up envelope, syncs, moves to team folder. |
| `components/agreements/signing-template-authoring.tsx` | `EmbedUpdateEnvelopeV2` wrapper: dynamic import, cssVars, features, 3s stale-event guard. → becomes `modules/signing/ui/signature-editor.tsx`. |
| `components/view/access-form/agreement-section.tsx` | Visitor session + `EmbedDirectTemplate` + localStorage persistence + polling/retry. → becomes `components/view/signing/*`. |
| `pages/api/agreements/signing/session.ts` | Zod input validation, `100/min` link + `20/min` IP rate limits, continuity checks (access cookie + download token + requested response id), new-signer vs continue-signer, already-signed protection, secure cookies. |
| `pages/api/agreements/signing/complete.ts` | Completion config streaming + access-cookie mint. (Note: client `recipientId` is declared but ignored.) |
| `pages/api/agreements/signing/status.ts` | Signed-state poller (cookie proof, `30/min` IP limit). |
| `app/api/webhooks/signing/route.ts` | Verified, idempotent webhook handler + `waitUntil` mirror. |
| Download routes | Admin + visitor signed-PDF download with the full auth chain. |
| Storage | `lib/files/*`, `ee/features/storage/config.ts` (team-scoped S3, presigned URLs), `lib/files/stream-file-server.ts` (multipart upload). |

### 3.1 Prisma models today (verbatim essentials)

```prisma
model Agreement {
  id            String   @id @default(cuid())
  name          String
  contentType   String   @default("LINK")        // "LINK" | "TEXT"
  teamId        String
  deletedAt     DateTime?
  signingProvider   String @default("LEGACY")    // "LEGACY" | "DOCUMENSO"
  signingExternalId String? @unique
  signingEnvelopeId String?
  signingTemplateId String?
  requireName       Boolean @default(true)
  links      Link[]
  responses  AgreementResponse[]
}

model AgreementResponse {
  id                  String @id @default(cuid())
  agreementId         String
  viewId              String? @unique
  linkId              String?
  signerEmail         String?
  signerName          String?
  signedFileKey       String?
  signedFileName      String?
  signedFileStorageType DocumentStorageType?
  signingStatus       String @default("PENDING") // "PENDING" | "SIGNED" | "COMPLETED" | "FAILED"
  signingExternalId   String? @unique
  signingEnvelopeId   String?
  signingDocumentId   Int?
  acceptanceType      String? @default("CLICK")
  completedAt         DateTime?
  ...
}
```

`Document`, `Link`, `View`, `Team`, `UserTeam` are the standard Papermark models. Storage enums: `DocumentStorageType { VERCEL_BLOB, S3_PATH }`. There is **no** `DocumentActivity` model; activity is captured via `View` + relations + audit log. `UserTeam` already tracks `signingCount`/`agreementCount`.

---

## 4. Legacy Agreement coupling (what must be decoupled)

The current integration is coupled to the Agreement feature in five concrete ways:

1. **Data model** — `Agreement.signingProvider` is the master switch; `AgreementResponse` carries all signing state. The Dossier domain needs its own `SignatureTemplate` / `SignatureRequest` / `SignatureRecipient` / `SignatureArtifact` models, keyed off `Document`, not `Agreement`.
2. **Link access** — `app/api/views/route.ts` + `app/api/views-dataroom/route.ts` call `ensureAgreementResponseForAccess`; the Documenso session is currently part of link auth. The Dossier flow keys signing off a document's `SignatureRequest`, still issued inside the Papermark viewer.
3. **CRUD coupling** — `[agreementId]/index.ts` blocks content edits when `signingProvider === "DOCUMENSO"`; soft-delete must account for live webhooks.
4. **UI coupling** — `agreement-panel` is the only entry point for setup/authoring/sync; rows + visitor tables read `signedFileKey`/`signingStatus`.
5. **Trigger coupling** — job ID, queue, idempotency key derived from agreement IDs; `trigger.config.ts` must keep `lib/trigger` in `dirs`.

Migration stance: **keep legacy Agreement signing working until the new `SignatureRequest` E2E flow passes.** Extract the shared primitives (client, external IDs, verification, mirror, embed wrappers, session protections) behind a `SigningProvider` port, then build the Dossier domain on top. Do not delete `lib/signing/*` legacy helpers during migration — the legacy flow stays on them.

---

## 5. Migration risks

1. **Provider event drift** — Documenso event names must be pinned to the version in the fork. Verify exact names against the checked-out repo before committing the mapper (audit confirmed 2.16.0 names above).
2. **No webhook delivery ID** — must build a deterministic dedupe key (`SigningProviderEvent.dedupeKey`) from `event + payload.id + externalId`; the existing handler already short-circuits terminal states, but a DB-level conditional update (or unique index + upsert) hardens the webhook write race.
3. **Mirror is best-effort** — mirroring runs in `waitUntil`; a failure is only logged. Add a retry/alert path (alert: `DOCUMENT_COMPLETED` + no `SignatureArtifact` after 5 min).
4. **Dead code** — `createSigningDocumentFromTemplate`, `getReusableSigningDocumentSession`, `ensureSigningDocumentSession` in `lib/signing/agreements.ts` are unused; remove during the extraction phase.
5. **Env docs gap** — `.env.example` documents none of the signing vars; add them.
6. **`any` typing** — `lib/signing/envelopes.ts` legacy envelope-item fallback is typed `any`; type it once the SDK surface is fixed.
7. **Cross-tenant risk** — every new team-owned resource must scope queries by `teamId` (never bare `id`). Add automated cross-tenant tests.
8. **Documenso fork discipline** — prefer zero Documenso modifications. Current capabilities (SDK create/envelope/distribute/download, presign tokens, embed components, webhooks, emailSettings suppression, S3-compatible storage, multiple job providers) already satisfy the required surface, so no fork changes are anticipated.

---

## 6. Target architecture (new Dossier signing code)

Only new Dossier signing code follows the clean structure. Existing Papermark files are not moved.

```text
papermark/  (this repo = Dossier)
│
├── modules/
│   └── signing/
│       ├── domain/
│       │   ├── signature-template.ts
│       │   ├── signature-request.ts
│       │   ├── signature-recipient.ts
│       │   ├── signature-artifact.ts
│       │   ├── signing-event.ts
│       │   └── signing-errors.ts
│       ├── application/
│       │   ├── create-template.ts
│       │   ├── prepare-template.ts
│       │   ├── create-request.ts
│       │   ├── create-signing-session.ts
│       │   ├── process-provider-event.ts
│       │   ├── complete-request.ts
│       │   ├── cancel-request.ts
│       │   └── mirror-signed-artifact.ts
│       ├── ports/
│       │   └── signing-provider.ts
│       ├── providers/
│       │   └── documenso/
│       │       ├── client.ts
│       │       ├── provider.ts
│       │       ├── template.ts
│       │       ├── envelope.ts
│       │       ├── session.ts
│       │       ├── webhook.ts
│       │       ├── mapper.ts
│       │       └── artifact.ts
│       └── ui/
│           ├── request-signature-button.tsx
│           ├── signature-setup-sheet.tsx
│           ├── signature-editor.tsx
│           ├── review-and-sign-button.tsx
│           ├── signing-sheet.tsx
│           └── signature-status-badge.tsx
│
└── lib/signing/
    └── legacy/          # current Agreement signing code stays here during migration
```

### 6.1 Provider port (the most important boundary)

```ts
// modules/signing/ports/signing-provider.ts
export type SigningProviderName = "DOCUMENSO";

export interface ProviderTemplate {
  provider: SigningProviderName;
  templateId: string;
  envelopeId: string;
  externalId: string;
}

export interface ProviderEditorSession {
  host: string;
  presignToken: string;
  envelopeId: string;
  externalId: string;
}

export interface ProviderSigningSession {
  host: string;
  token: string;
  externalId: string;
}

export interface ProviderSignedArtifact {
  downloadUrl: string;
  mimeType: "application/pdf";
}

export interface CreateProviderTemplateInput {
  externalId: string;
  title: string;
  fileName: string;
  file: Uint8Array;
}

export interface SigningProvider {
  createTemplate(input: CreateProviderTemplateInput): Promise<ProviderTemplate>;
  createEditorSession(template: ProviderTemplate): Promise<ProviderEditorSession>;
  createSigningSession(input: {
    providerTemplateId: string;
    providerEnvelopeId: string;
    externalId: string;
    recipient: { email?: string | null; name?: string | null };
  }): Promise<ProviderSigningSession>;
  getSignedArtifact(input: {
    providerEnvelopeId: string;
    providerDocumentId?: number | null;
  }): Promise<ProviderSignedArtifact>;
  cancelRequest(input: { providerEnvelopeId: string }): Promise<void>;
}
```

**Rule:** `import { Documenso } from "@documenso/sdk-typescript"` may only appear inside `modules/signing/providers/documenso/*` (plus the embed React package inside the signing UI adapter).

### 6.2 Domain statuses (Dossier owns the vocabulary)

`SignatureRequestStatus`: `DRAFT | PREPARING | READY | SENT | VIEWED | SIGNING | PARTIALLY_SIGNED | COMPLETED | DECLINED | EXPIRED | CANCELLED | FAILED`

`SignatureRecipientStatus`: `PENDING | VIEWED | SIGNING | SIGNED | DECLINED | EXPIRED`

Provider → Dossier mapping (pinned to 2.16.0 event names; re-verify against the fork):

| Documenso event | Dossier status |
|---|---|
| `DOCUMENT_SIGNED` | `PARTIALLY_SIGNED` (single signer → request `COMPLETED` on `DOCUMENT_COMPLETED`) |
| `DOCUMENT_COMPLETED` | `COMPLETED` |
| `DOCUMENT_REJECTED` | `DECLINED` |
| `DOCUMENT_CANCELLED` | `CANCELLED` |

### 6.3 External IDs (deterministic, never raw numeric IDs)

```ts
export function buildTemplateExternalId(input: { teamId: string; templateId: string }) {
  return `dossier:team:${input.teamId}:signature-template:${input.templateId}`;
}
export function buildRequestExternalId(input: { teamId: string; requestId: string }) {
  return `dossier:team:${input.teamId}:signature-request:${input.requestId}`;
}
```

### 6.4 New Prisma models (added to existing schema, relations merged with real `Team`/`Document`/`Link`)

- `SignatureTemplate` — team, document, provider, `providerExternalId @unique`, `providerTemplateId`, `providerEnvelopeId`, status `PREPARING|READY|FAILED|ARCHIVED`.
- `SignatureRequest` — team, document, template, optional `linkId`; provider, `providerExternalId @unique`, `providerEnvelopeId`, `providerDocumentId Int?`, status, `sentAt/viewedAt/completedAt/cancelledAt/expiresAt`; `@@unique([provider, providerEnvelopeId])`.
- `SignatureRecipient` — request, name/email/phone, `signingOrder`, `providerRecipientId`, status, `viewedAt/signedAt`.
- `SignatureArtifact` — `signatureRequestId @unique`, `storageKey`, `fileName`, `mimeType`, `sha256`, `sizeBytes BigInt`, createdAt. **Immutable** — never overwrite.
- `SigningProviderEvent` — `dedupeKey @unique`, provider, `eventType`, `externalId?`, `providerDocumentId?`, `payload Json`, `processedAt?`, `failedAt?`, `errorCode?`.

A document may have **zero** `SignatureRequest`s:

```text
Document
   ├── ShareLinks[]
   ├── Views[]
   ├── DataroomDocuments[]
   └── SignatureRequests[]     ← optional
```

### 6.5 APIs (adapt URL style to Papermark conventions)

```text
TEMPLATES   POST  /api/teams/:teamId/documents/:documentId/signature-template
            POST  /api/signature-templates/:templateId/editor-session

REQUESTS    POST  /api/signature-requests
            GET   /api/signature-requests/:requestId
            POST  /api/signature-requests/:requestId/send
            POST  /api/signature-requests/:requestId/cancel
            POST  /api/signature-requests/:requestId/remind

RECIPIENT   POST  /api/signature-requests/:requestId/session
            POST  /api/signature-requests/:requestId/complete

ARTIFACT    GET   /api/signature-requests/:requestId/signed-document

PROVIDER    POST  /api/webhooks/signing          (existing route generalized)
```

Route handlers stay thin; business logic lives in `modules/signing/application/`.

### 6.6 Request creation (transaction + no ambiguous state)

```ts
const request = await prisma.$transaction(async (tx) => {
  const request = await tx.signatureRequest.create({
    data: { teamId, documentId, templateId, provider: "DOCUMENSO",
            providerExternalId: temporaryExternalId, status: "PREPARING" },
  });
  const externalId = buildRequestExternalId({ teamId, requestId: request.id });
  return tx.signatureRequest.update({
    where: { id: request.id },
    data: { providerExternalId: externalId },
  });
});
// then call the provider; on failure → status FAILED
```

### 6.7 Webhook design (generalize the existing route)

```text
Documenso → POST /api/webhooks/signing
  ├─ verify secret (existing timingSafeEqual check)
  ├─ parse payload (Zod)
  ├─ compute dedupeKey (event + payload.id + externalId, sha256)
  ├─ upsert SigningProviderEvent (unique dedupeKey) → no-op if already processed
  └─ processProviderEvent()
       ├─ find SignatureRequest by externalId
       ├─ normalize status via mapper
       ├─ update request + recipient, write audit event
       └─ if COMPLETED → mirrorSignedArtifact()  (download → size check → SHA-256 → S3 → SignatureArtifact)
```

### 6.8 Signed artifact ownership (mandatory)

```text
Documenso signed PDF
        ↓ download (guarded, 50 MB ceiling)
        ↓ size validation
        ↓ SHA-256
        ↓ Dossier S3/R2 (team-scoped)
        ↓ SignatureArtifact (immutable)
```

Storage layout: `teams/{teamId}/documents/{docId}/signatures/{requestId}/signed.pdf`.

Immutability rule: never overwrite `signed.pdf`. Corrections create a **new** `SignatureRequest` → new artifact. `SignatureArtifact` has no update path.

### 6.9 Authorization

Every team-owned mutation must scope by team:

```ts
where: { id: resourceId, teamId: actor.teamId }
```

Add automated cross-tenant tests (Team A cannot load / session / download / edit Team B resources).

### 6.10 Feature flag

```ts
export const isDossierSigningEnabled =
  process.env.NEXT_PUBLIC_DOSSIER_SIGNING_ENABLED === "true";
```

Gates: `Request Signature`, `Signatures` sidebar, `Review & Sign`, new signing APIs. Legacy signing stays until the new flow is proven.

---

## 7. UI plan (preserve Papermark)

- **Documents table:** add one action `Request signature` to the existing row actions (Share / Add to dataroom / Rename / Download / Delete). No redesign.
- **Document detail:** `[ Share ] [ Request signature ] [...]`. No signature UI until requested.
- **Setup flow** (`modules/signing/ui/signature-setup-sheet.tsx`, Papermark `Sheet`/`Dialog`): Step 1 Recipients → Step 2 Prepare (embedded field editor) → Step 3 Review → Send. Same buttons/typography/cards as Papermark.
- **Field editor:** convert the existing `EmbedUpdateEnvelopeV2` wrapper (`components/agreements/signing-template-authoring.tsx`) into `modules/signing/ui/signature-editor.tsx`; reuse the existing CSS/theme implementation.
- **Recipient experience** (`components/view/signing/*`): extract from `agreement-section.tsx`. Viewer shows `[ Review & Sign ]` only when `signatureRequest != null && signatureRequest.status !== "COMPLETED"`. Otherwise the viewer is unchanged.
- **Signing session route:** `POST /api/signature-requests/:requestId/session` `{ email, name }` → `{ requestId, host, token, externalId }`. Keep the existing Zod validation, link/IP rate limits, continuity checks, provider token retrieval, signed-state protection, secure cookies.

---

## 8. Environment variables

Dossier (new): `NEXT_PUBLIC_DOSSIER_SIGNING_ENABLED`.
Existing signing vars to document in `.env.example`: `NEXT_PUBLIC_SIGNING_HOST`, `SIGNING_API_URL`, `SIGNING_API_KEY`, `SIGNING_WEBHOOK_SECRET`.
Documenso: standard Postgres + S3-compatible storage + `NEXT_PRIVATE_JOBS_PROVIDER` + `NEXT_PRIVATE_ENCRYPTION_KEY`; configure `emailSettings`/`distributionMethod` so Documenso does not send duplicate customer emails.

---

## 9. Implementation order & checkpoints

| # | Deliverable | Gate |
|---|---|---|
| 0 | Existing Papermark + self-hosted Documenso signing working unchanged | manual E2E |
| 1 | **This audit note** | done |
| 2 | `SigningProvider` abstraction added with existing behavior preserved | existing signing E2E still passes |
| 3 | New Prisma models + migration | `prisma migrate` clean |
| 4 | `Request Signature` UI (documents table + detail) | admin E2E |
| 5 | Embedded field editor inside Dossier | admin E2E |
| 6 | Recipient viewer + `Review & Sign` | recipient E2E |
| 7 | Webhook + final artifact (dedupe, SHA-256, immutable) | completion E2E |
| 8 | E2E + security + non-signing regression tests | CI green |
| 9 | Feature-flagged pilot rollout | staged |

Tests required: unit (status mapping, external IDs, state transitions, webhook dedupe, recipient validation, tenant authorization, artifact hashing), integration (create template/request, provider failure → `FAILED`, webhook → status, duplicate webhook no-op, completed → artifact, cancelled cannot complete), security (cross-tenant), and Playwright E2E (signing flow + the critical non-signing regression: upload → share → recipient opens → analytics recorded, **no Documenso calls**).

Observability: structured fields `{ requestId, teamId, documentId, signatureTemplateId, signatureRequestId, provider, providerEnvelopeId, providerDocumentId, providerEventType }`; metrics for template/request/session create success+failure, webhook received/duplicate/failed, `signature_completed`, mirror success/failure; alert on `DOCUMENT_COMPLETED` + no artifact after 5 minutes.

---

## 10. Definition of done

- [ ] Papermark UI remains the Dossier UI; no customer needs a Documenso account or sees the Documenso dashboard.
- [ ] Documents / sharing / analytics work without signing; `Request Signature` is optional.
- [ ] Documenso SDK isolated behind the provider layer; Dossier and Documenso DBs independent.
- [ ] Dossier owns auth, billing, notifications, and the final signed PDF; Documenso owns signing execution only.
- [ ] Field editor embedded in Dossier; recipient signs inside the Dossier experience.
- [ ] Webhooks authenticated + idempotent; provider IDs mapped to Dossier IDs; final PDF has SHA-256; artifact immutable.
- [ ] Team authorization on every signing resource; cross-tenant tests pass.
- [ ] Non-signing regression E2E and signing E2E pass.
- [ ] Feature flag exists; legacy signing flow remains until migration is proven.
- [ ] No unnecessary Documenso fork changes.
