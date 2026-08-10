// SignatureEditor: embeds the Documenso field-authoring canvas inside Dossier.
// Dossier owns everything around it (dialog, header, steps, buttons); Documenso
// owns only the draggable-fields rectangle. Authoring restrictions and the
// visual theme are inherited verbatim from the legacy Agreement flow so both
// products look identical.

import dynamic from "next/dynamic";

import { useEffect, useRef } from "react";

import LoadingSpinner from "@/components/ui/loading-spinner";

const authoringCssVars = {
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
  envelopeEditorBackground: "hsl(220 14.3% 95.9%)",
  radius: "0.5rem",
};

const authoringCss = `
  .embed--Root,
  .embed--DocumentContainer,
  .embed--DocumentWidget,
  .embed--DocumentWidgetContainer,
  .embed--DocumentViewer {
    border-radius: 0.5rem;
  }

  .embed--DocumentWidget,
  .embed--DocumentWidgetContainer,
  .embed--DocumentWidgetHeader,
  .embed--DocumentWidgetContent,
  .embed--DocumentWidgetFooter {
    box-shadow: none;
  }

  .embed--DocumentContainer {
    gap: 1rem;
  }
`;

const authoringFeatures = {
  general: {
    allowConfigureEnvelopeTitle: false,
    allowUploadAndRecipientStep: false,
    allowAddFieldsStep: true,
    allowPreviewStep: false,
    minimizeLeftSidebar: true,
  },
  settings: null,
  actions: {
    allowAttachments: false,
  },
  envelopeItems: {
    allowConfigureTitle: false,
    allowConfigureOrder: false,
    allowUpload: false,
    allowDelete: false,
    allowReplace: false,
  },
  recipients: null,
};

const INITIAL_EMBED_EVENT_GUARD_MS = 3000;

const EmbedUpdateEnvelope = dynamic(
  () =>
    import("@documenso/embed-react").then((mod) => mod.EmbedUpdateEnvelopeV2),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[600px] items-center justify-center">
        <LoadingSpinner className="h-10 w-10" />
      </div>
    ),
  },
);

export function SignatureEditor({
  host,
  presignToken,
  externalId,
  envelopeId,
  onReady,
}: {
  host: string;
  presignToken: string;
  externalId?: string | null;
  envelopeId: string;
  onReady?: () => void;
}) {
  const canHandleEnvelopeUpdatedRef = useRef(false);
  const hasFiredReadyRef = useRef(false);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      canHandleEnvelopeUpdatedRef.current = true;
    }, INITIAL_EMBED_EVENT_GUARD_MS);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="h-full min-h-[600px] w-full overflow-hidden rounded-lg border bg-background">
      <EmbedUpdateEnvelope
        className="h-full w-full"
        host={host}
        presignToken={presignToken}
        externalId={externalId ?? undefined}
        envelopeId={envelopeId}
        darkModeDisabled
        cssVars={authoringCssVars}
        css={authoringCss}
        features={authoringFeatures}
        onEnvelopeUpdated={() => {
          // The Documenso embed fires an update event during editor init. The
          // 3s guard ignores it; the first update after the guard means the
          // canvas is actually live, which is when the caller may proceed.
          if (!canHandleEnvelopeUpdatedRef.current) {
            return;
          }
          if (hasFiredReadyRef.current) {
            return;
          }
          hasFiredReadyRef.current = true;
          onReadyRef.current?.();
        }}
      />
    </div>
  );
}
