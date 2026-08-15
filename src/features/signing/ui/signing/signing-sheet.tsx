// SigningSheet: the recipient-facing signing surface. Embeds Documenso's
// direct-signing canvas inside a Dossier-owned sheet; Dossier shows/hides it
// and owns the header, the review bar, and the completion/download states.

import dynamic from "next/dynamic";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";

import type { SigningSessionDTO } from "@/features/signing/api/signing-api";

const EmbedSignDocument = dynamic(
  () => import("@documenso/embed-react").then((mod) => mod.EmbedSignDocument),
  { ssr: false },
);

const signingCssVars = {
  background: "hsl(0 0% 100%)",
  foreground: "hsl(224 71.4% 4.1%)",
  muted: "hsl(220 14.3% 95.9%)",
  mutedForeground: "hsl(220 8.9% 46.1%)",
  popover: "hsl(0 0% 100%)",
  popoverForeground: "hsl(224 71.4% 4.1%)",
  card: "hsl(0 0% 100%)",
  cardBorder: "hsl(220 13% 91%)",
  cardBorderTint: "hsl(216 12.2% 83.9%)",
  cardForeground: "hsl(224 71.4% 4.1%)",
  fieldCard: "hsl(220 14.3% 95.9%)",
  fieldCardBorder: "hsl(220 13% 91%)",
  fieldCardForeground: "hsl(224 71.4% 4.1%)",
  widget: "hsl(0 0% 100%)",
  widgetForeground: "hsl(224 71.4% 4.1%)",
  border: "hsl(220 13% 91%)",
  input: "hsl(216 12.2% 83.9%)",
  primary: "hsl(220.9 39.3% 11%)",
  primaryForeground: "hsl(210 20% 98%)",
  secondary: "hsl(220 14.3% 95.9%)",
  secondaryForeground: "hsl(220.9 39.3% 11%)",
  accent: "hsl(220 14.3% 95.9%)",
  accentForeground: "hsl(220.9 39.3% 11%)",
  destructive: "hsl(0 84.2% 60.2%)",
  destructiveForeground: "hsl(210 20% 98%)",
  ring: "hsl(217.9 10.6% 64.9%)",
  warning: "hsl(38 92% 50%)",
  radius: "0.5rem",
};

// Injected into the Documenso iframe so the signing canvas sits cleanly inside
// the Dossier sheet: hide the sidebar, keep the bottom widget, flatten shadows.
const SIGNING_EMBED_CSS = `
    .embed--DocumentWidgetContainer {
      display: none !important;
    }

    .embed--DocumentViewer > .lg\\:hidden {
      display: block !important;
    }

    .embed--DocumentContainer {
      padding-left: 0;
      padding-right: 0;
    }

    .embed--Root,
    .embed--DocumentContainer,
    .embed--DocumentViewer {
      border-radius: 0.5rem;
    }

    .embed--DocumentWidgetHeader,
    .embed--DocumentCompleted,
    .embed--WaitingForTurn {
      box-shadow: none;
    }
  `;

export function SigningSheet({
  open,
  onOpenChange,
  session,
  documentName,
  onCompleted,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: SigningSessionDTO | null;
  documentName: string;
  onCompleted: () => void;
  onError: (message: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[96vw] bg-background px-0 sm:max-w-3xl">
        <SheetHeader className="px-6 pt-6 text-start">
          <SheetTitle>Sign {documentName}</SheetTitle>
          <SheetDescription>
            Review the document and follow the prompts to sign.
          </SheetDescription>
        </SheetHeader>

        <div className="h-[calc(100%-96px)] px-4 pb-4 pt-2 sm:px-6">
          {session ? (
            <div className="h-full overflow-hidden rounded-lg border">
              <EmbedSignDocument
                className="h-full w-full"
                host={session.host}
                token={session.token}
                darkModeDisabled
                cssVars={signingCssVars}
                css={SIGNING_EMBED_CSS}
                onDocumentCompleted={() => onCompleted()}
                onDocumentError={onError}
              />
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Preparing signing flow...
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}