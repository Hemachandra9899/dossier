import dynamic from "next/dynamic";

import { useState } from "react";

import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "sonner";

import { Badge } from "@/shared/ui/badge";

import {
  type PublicSignedArtifactDTO,
  type SigningSessionDTO,
} from "@/features/signing/api/signing-api";

import {
  publicSignatureRequestQuery,
  publicSignedArtifactQuery,
} from "@/features/signing/api/signing.queries";

import { SignatureStatusBadge } from "../signature-status-badge";

import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

import { useRecipientSigningUrl } from "@/features/signing/ui/use-recipient-signing-url";

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

/* Recipient signing page CSS.
   — Show the field widget so recipients can see progress (e.g. "4 Fields Remaining").
   — Keep the bottom widget area accessible.
   — No lateral sidebar; the page is full-width. */
const recipientSigningCss = `
  .embed--DocumentWidgetContainer {
    display: block !important;
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
    border-radius: 0;
  }

  .embed--DocumentWidgetHeader,
  .embed--DocumentCompleted,
  .embed--WaitingForTurn {
    box-shadow: none;
  }
`;

export function RecipientSigningView({
  session,
  recipientName,
  documentName,
  onCompleted,
  onError,
}: {
  session: SigningSessionDTO;
  recipientName?: string | null;
  documentName: string;
  onCompleted: () => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background px-4 sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {documentName}
          </p>
        </div>

        {recipientName ? (
          <p className="text-xs text-muted-foreground">
            {recipientName}
          </p>
        ) : null}
      </header>

      <main className="flex-1">
        <EmbedSignDocument
          className="h-full w-full"
          host={session.host}
          token={session.token}
          darkModeDisabled
          cssVars={signingCssVars}
          css={recipientSigningCss}
          name={recipientName ?? undefined}
          lockName={Boolean(recipientName?.trim())}
          onDocumentReady={undefined}
          onDocumentCompleted={onCompleted}
          onDocumentError={onError}
        />
      </main>
    </div>
  );
}