# Dossier — Product & Target Architecture

> **Status:** Active Target Architecture.
> Last updated: 2026-08-15

---

## Target Directory Layout

```text
dossier/
├── public/
│   ├── fonts/
│   ├── icons/
│   ├── images/
│   └── logos/
│
├── prisma/
│   └── schema/
│
├── scripts/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
└── src/
    │
    ├── app/                              # Next.js routing ONLY (App Router)
    │   ├── layout.tsx                    # Root Dossier layout + CoreProviders
    │   ├── (auth)/                       # Dossier before authentication
    │   │   ├── login/page.tsx            # Unauthenticated login page
    │   │   ├── register/page.tsx
    │   │   └── verify/page.tsx
    │   ├── (product)/                    # Authenticated Dossier
    │   │   ├── layout.tsx                # Product shell + workspace providers
    │   │   ├── dashboard/page.tsx
    │   │   └── files/page.tsx
    │   └── api/                          # Thin HTTP adapters
    │
    ├── pages/                            # Next.js legacy routing ONLY
    │   ├── api/
    │   └── files/[fileId]/index.tsx
    │
    ├── modules/                          # THE DOSSIER PRODUCT MODULES
    │   ├── auth/                         # Screens (SignInScreen), components, server
    │   ├── files/                        # Screens, components, file-status, server
    │   ├── documents/                    # Document repository & service
    │   ├── requirements/                 # Requirements facade (Task/TaskList)
    │   ├── sharing/                      # Sharing facade (Dataroom/Link)
    │   ├── verification/                 # Rules engine, providers (OpenAI), jobs
    │   ├── signing/                      # Signing service, state, providers, jobs
    │   ├── completion/                   # Completion readiness & runs
    │   ├── workspace/                    # Workspace & team providers
    │   ├── branding/                     # Branding screens & components
    │   ├── analytics/                    # Analytics screens & components
    │   ├── account/                      # Account screens & components
    │   └── settings/                     # Settings screens & components
    │
    ├── shared/                           # REUSED SHARED PRODUCT UTILITIES
    │   ├── ui/                           # Pure reusable UI (button, dialog, input...)
    │   ├── shell/                        # Product shells (product-shell, product-entry-shell)
    │   ├── providers/                    # CoreProviders, WorkspaceProviders
    │   ├── hooks/                        # Reusable React hooks
    │   ├── config/                       # Centralized product.ts (Dossier branding)
    │   └── lib/                          # cn.ts, dates.ts, errors.ts
    │
    └── platform/                         # NON-PRODUCT INFRASTRUCTURE
        ├── db/                           # Prisma singleton
        ├── storage/                      # Unified ObjectStorage interface & S3 implementation
        ├── email/                        # Email services
        ├── queue/                        # Trigger / Job queues
        ├── logging/                      # Logger
        ├── http/                         # HTTP fetchers
        └── observability/                # Observability & telemetry
```

---

## Import & Boundary Rules

```text
app / pages
  ↓
modules
  ↓
shared
  ↓
platform
```

1. Routes (`src/app/` and `src/pages/`) are thin HTTP/adapter shells.
2. Sign-in, Register, and Verify live under `src/modules/auth/` and use the shared [`ProductEntryShell`](file:///Users/teja/Desktop/dossier/src/shared/shell/product-entry-shell.tsx).
3. Centralized product config lives in [`src/shared/config/product.ts`](file:///Users/teja/Desktop/dossier/src/shared/config/product.ts) — hardcoded branding strings from legacy Papermark defaults are forbidden in product code.
4. Database models are hidden behind domain facades (`requirements` for Task/TaskList, `sharing` for Dataroom/Link).
5. All storage operations use `src/platform/storage`.
