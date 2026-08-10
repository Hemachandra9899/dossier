# Dossier Signing — Checkpoint 4 (backend core)

Status: **implemented and tested**. This checkpoint builds the provider-backed
backend core for Dossier e-signatures on top of the existing signing infra and
the Checkpoint 1 audit. UI, embedded field editor and recipient viewer are
deferred to later checkpoints.

## Scope

Implemented:

- Prisma models + migration (`SignatureTemplate`, `SignatureRequest`,
  `SignatureRecipient`, `SignatureArtifact`, `ProviderEventLog`) and the
  follow-up migration adding `providerDocumentId`/`providerRecipientId`.
- `SigningProvider` port with a Documenso adapter (template create, editor
  session, per-visitor signing document, recipient signing session, signed
  artifact download, request cancel) and a single event mapper.
- Application layer (`modules/signing/application`) with use-cases:
  `create-template`, `create-editor-session`, `create-request`,
  `create-signing-session`, `cancel-request`, `get-request`,
  `get-signed-artifact`, `process-provider-event`, `mirror-signed-artifact`.
- Domain layer (`modules/signing/domain`): status vocabulary, state machine,
  external-id derivation, recipient validation, continuity token, errors.
- Repositories (`modules/signing/repositories`), signed-artifact storage port
  + S3 adapter, logging interface.
- API routes:
  - `POST /api/teams/:teamId/documents/:documentId/signature-templates`
  - `GET /api/teams/:teamId/signature-templates/:templateId`
  - `POST /api/teams/:teamId/signature-templates/:templateId/editor-session`
  - `POST /api/teams/:teamId/signature-requests`
  - `GET /api/teams/:teamId/signature-requests/:requestId`
  - `POST /api/teams/:teamId/signature-requests/:requestId/cancel`
  - `GET /api/teams/:teamId/signature-requests/:requestId/signed-artifact`
  - `POST /api/signature-requests/:requestId/session` (recipient-facing)
- Webhook ingestion:
  - `POST /api/webhooks/signing-dossier` (Documenso generic Webhook→legacy route
    reformatted) and
  - `POST /api/webhooks/signing-dossier/provider` (provider event contract
    `{ event, externalId }`).
- Durable artifact mirror handoff via Trigger.dev
  (`lib/trigger/signature-artifact-mirror` task + `process-signing` event
  indexer) wired to `ArtifactMirrorHandoff.enqueue(requestId)`.
- Feature flag `NEXT_PUBLIC_DOSSIER_SIGNING_ENABLED`
  (`modules/signing/config`). When unset/false every signing route returns 404.
- Unit + integration test suites.

Deferred (later checkpoints): setup UI, embedded field editor, recipient
viewer + sign-in place page, links-based creation, mirror retry/alerting UI.

## Design invariants

1. **Local-first rows.** Templates and requests are created locally as
   `PREPARING` inside a transaction with a deterministic Dossier external id
   before any provider call. On provider failure the row is kept and moved to
   `FAILED` (never a lost request, never an ambiguous intermediate state).
2. **State machine in the application layer only.** `assertCanTransitionTo`
   rejects illegal transitions (`SigningStateError`); Prisma is never the
   authority on state.
3. **Deterministic external ids.** `dossier:team:<teamId>:signature-request:<id>`
   (and `signature-template:`) bind provider webhooks back to Dossier rows
   without trusting raw numeric provider ids.
4. **Immutable artifact.** The mirrored `SignatureArtifact` row is
   write-once (`@@unique([signatureRequestId])`); re-mirroring is a no-op and
   never overwrites. SHA-256 + byte size are recorded at mirror time.
5. **Idempotent webhook.** Events that would not change state (unknown event,
   duplicate, already-applied) are no-ops. A repeated `DOCUMENT_COMPLETED`
   re-drives the mirror handoff (retry semantics).
6. **Provider events normalize through one mapper.**
   `DOCUMENT_SIGNED → PARTIALLY_SIGNED`, `DOCUMENT_COMPLETED → COMPLETED`,
   `DOCUMENT_REJECTED → DECLINED`, `DOCUMENT_CANCELLED → CANCELLED`,
   `RECIPIENT_EXPIRED → EXPIRED`. Event names are pinned to Documenso 2.16.0
   in `modules/signing/providers/documenso/mapper.ts`.
7. **Team scoping.** Every team route calls `requireTeamMember` and every
   repository read is scoped by `teamId`. Recipient-facing session lookup is
   scoped by `requestId` only (no team knowledge).

## State machine

`modules/signing/domain/state-machine.ts` — single source of truth:

```
DRAFT -> PREPARING
PREPARING -> READY | FAILED
READY -> SENT | VIEWED | SIGNING | PARTIALLY_SIGNED | CANCELLED | EXPIRED
SENT -> VIEWED | SIGNING | PARTIALLY_SIGNED | CANCELLED | EXPIRED
VIEWED -> SIGNING | PARTIALLY_SIGNED | CANCELLED | EXPIRED
SIGNING -> PARTIALLY_SIGNED | COMPLETED | CANCELLED | EXPIRED
PARTIALLY_SIGNED -> COMPLETED | CANCELLED | EXPIRED
COMPLETED / DECLINED / EXPIRED / CANCELLED / FAILED -> (terminal)
```

Provider-forced terminal moves (`DECLINED`, `EXPIRED`, `CANCELLED`) are
admitted from any non-terminal state.

## Error handling

All signing errors extend `SigningError` in `modules/signing/domain/signing-errors.ts`
and are mapped by `lib/errorHandler.ts`:

| Error | HTTP |
|---|---|
| `SigningValidationError` | 400 |
| `SigningNotFoundError` | 404 |
| `SigningStateError` | 409 |
| `SigningProviderError` | 502 |

## Running the tests

```bash
# unit (no database required)
npm run test:unit

# integration (requires a Postgres test database, schema-migrated)
createdb papermark_test
TEST_DATABASE_URL="postgresql://<user>@localhost:5432/papermark_test" \
  POSTGRES_PRISMA_URL="postgresql://<user>@localhost:5432/papermark_test" \
  POSTGRES_PRISMA_URL_NON_POOLING="postgresql://<user>@localhost:5432/papermark_test" \
  npx prisma migrate deploy
TEST_DATABASE_URL="postgresql://<user>@localhost:5432/papermark_test" npm run test:integration
```

Coverage map (spec scenarios): create template success; wrong-team document
rejection; provider create failure → `FAILED`; editor session authorization;
request creation; invalid template-document combination; duplicate recipient
handling; request provider failure → `FAILED`; valid state transitions;
invalid terminal-state transitions; recipient session authorization (expired /
cancelled / completed / identity mismatch); duplicate webhook no-op;
out-of-order webhook rejection; `DOCUMENT_SIGNED` / `DOCUMENT_COMPLETED` /
`DOCUMENT_REJECTED` / `DOCUMENT_CANCELLED`; artifact mirror + retry
idempotency + immutability; cross-team access denial; idempotent cancel.

## Enabling the feature

Set `NEXT_PUBLIC_DOSSIER_SIGNING_ENABLED=true` in `.env` (public, client-safe —
it only gates route availability). Provide the existing signing env vars
(`NEXT_PUBLIC_SIGNING_HOST`, `SIGNING_API_URL`, `SIGNING_API_KEY`,
`SIGNING_WEBHOOK_SECRET`) plus `NEXT_PRIVATE_VERIFICATION_SECRET` for the
recipient continuity cookie.
