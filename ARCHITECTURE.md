# Dossier — Architecture Reference

> **Status:** ARC.0 (Inventory + Rules). Runtime code is NOT yet moved.
> Last updated: 2026-08-14

---

## Target Directory Layout

```
dossier/
│
├── modules/                  ← Product feature modules
│   ├── files/
│   │   ├── application/      ← use-cases (create-file, get-files-board …)
│   │   ├── domain/           ← FileStatus, value objects
│   │   ├── requirements/     ← wraps Task/TaskList (Papermark tables hidden here)
│   │   ├── sharing/          ← wraps Dataroom/Link/Viewer (Papermark tables hidden here)
│   │   ├── server/           ← authorization, route helpers
│   │   └── ui/               ← file-detail-page, tabs, files-api
│   │
│   ├── documents/            ← NEW — owns all document lifecycle operations
│   │   ├── application/      ← createDocument, getDocument, deleteDocument …
│   │   ├── domain/
│   │   ├── server/
│   │   └── ui/
│   │
│   ├── verification/         ← MOVE from lib/verification + lib/trigger/dossier-document-analysis
│   │   ├── application/
│   │   ├── domain/
│   │   ├── provider/         ← openai-provider, extraction-schema
│   │   ├── jobs/             ← analyze-document.ts (was lib/trigger/dossier-document-analysis.ts)
│   │   ├── server/
│   │   └── ui/               ← verification card components
│   │
│   ├── signing/
│   │   ├── application/      ← (current — keep)
│   │   ├── domain/           ← (current — keep: state-machine, recipient-access-token …)
│   │   ├── provider/         ← RENAME from ports/ + providers/
│   │   │   ├── signing-provider.ts
│   │   │   └── documenso/
│   │   ├── jobs/             ← MOVE signing-related lib/trigger jobs here
│   │   ├── server/           ← RENAME from repositories/
│   │   ├── ui/               ← (current — keep)
│   │   ├── config.ts
│   │   └── logging.ts
│   │
│   └── completion/
│       ├── application/
│       ├── domain/
│       ├── jobs/
│       ├── server/
│       └── ui/
│
├── platform/                 ← Infrastructure shared across all modules
│   ├── auth/
│   ├── db/                   ← prisma singleton
│   ├── storage/              ← ONE ObjectStorage abstraction
│   │   ├── object-storage.ts
│   │   ├── s3-object-storage.ts
│   │   ├── storage-config.ts
│   │   └── storage-key.ts
│   ├── email/
│   ├── queue/
│   ├── config/
│   ├── logging/
│   └── http/
│
├── components/               ← Shared React UI (Radix + shadcn)
│   └── ui/
│
├── app/                      ← Next.js App Router (thin shells only)
├── pages/                    ← Next.js Pages Router (thin shells only)
├── prisma/
├── tests/
└── scripts/
```

---

## Module Dependency Rules

```
modules/files        → modules/documents, platform/*
modules/documents    → platform/*
modules/verification → modules/documents, platform/*
modules/signing      → modules/documents, platform/*
modules/completion   → modules/signing, modules/documents, platform/*

platform/*           → (nothing above — no module imports)
pages/*              → modules/*, platform/*  (thin shells — no business logic)
app/*                → modules/*, platform/*  (thin shells — no business logic)
```

### Forbidden cross-module imports (direction violations)

| FROM | TO | Reason |
|---|---|---|
| modules/signing | lib/files/* | Must use platform/storage |
| modules/signing | lib/trigger/* | Jobs belong in modules/signing/jobs/ |
| modules/verification | lib/trigger/* | Jobs belong in modules/verification/jobs/ |
| pages/* or app/* | lib/documents/* directly | Must go through modules/documents |
| Any module | ee/features/* directly | Only through Dossier-owned facades |

---

## Storage Rules (ONE implementation)

```
modules/documents    ─┐
modules/verification  ─┼──→  platform/storage  ──→  S3 / MinIO
modules/signing      ─┤
modules/completion   ─┘
```

Current violations to fix in ARC.2:
- lib/files/aws-client.ts → wrap in platform/storage/s3-object-storage.ts
- ee/features/storage/s3-store.ts → consolidate into platform/storage
- modules/signing/storage/s3-signed-artifact-storage.ts → delete, use platform/storage.put()

---

## Papermark / EE Facade Strategy

Do NOT rename database tables yet. Hide them behind Dossier facades:

| Papermark concept | Dossier facade |
|---|---|
| Task / TaskList | modules/files/requirements/ |
| Dataroom / Link / Viewer | modules/files/sharing/ |

New Dossier code uses addRequirement(), requestCorrection(), createFileShare() —
never references TaskList or Dataroom directly.

---

## Trigger Jobs Ownership

Jobs must live in the module that owns the feature.

| Current | Target |
|---|---|
| lib/trigger/dossier-document-analysis.ts | modules/verification/jobs/analyze-document.ts |
| lib/trigger/setup-signing-template.ts | modules/signing/jobs/setup-template.ts |
| lib/trigger/process-signing-provider-event.ts | modules/signing/jobs/process-provider-event.ts |
| lib/trigger/signature-artifact-mirror.ts | modules/signing/jobs/mirror-artifact.ts |
| lib/trigger/bulk-download.ts | keep (Papermark feature) |
| lib/trigger/export-visits.ts | keep (Papermark feature) |
| lib/trigger/convert-pdf-direct.ts | keep (Papermark feature) |
| lib/trigger/optimize-video-files.ts | keep (Papermark feature) |
| lib/trigger/pdf-to-image-route.ts | keep (Papermark feature) |

---

## Cleanup Sequence

ARC.0  Inventory + architecture rules            ← DONE
ARC.1  Remove repo/editor/agent clutter
ARC.2  One shared storage layer (platform/storage)
ARC.3  Create modules/documents
ARC.4  Move lib/verification → modules/verification
ARC.5  Simplify modules/signing (ports→provider, repositories→server, storage→delete)
ARC.6  Extract requirements + sharing facades from ee/features
ARC.7  Make pages/files/[fileId]/index.tsx a thin route shell
ARC.8  Delete proven-dead inherited lib/ code
Resume CP10.2

Each step must pass the existing test suite and build before the next step begins.

---

## What Must NOT Change During Cleanup

- Database table names (Task, TaskList, Dataroom, Link, Viewer …)
- Pages Router → App Router migration (separate effort)
- ee/ directory deletion (only individual files removed after proving no usage)
- ee/LICENSE.md — must be preserved
- LICENSE — must be preserved
