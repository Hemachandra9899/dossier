import { useTranslation } from "react-i18next";

import { formatDateLocalized } from "@/shared/utils/i18n/format";
import { asSupportedLocale, DEFAULT_LOCALE } from "@/shared/utils/i18n/locales";
import { cn } from "@/shared/utils/utils";

import { useViewerSurfaceTheme } from "@/shared/ui/view/viewer/viewer-surface-theme";

export function DataroomNoBannerTitle({
  name,
  lastUpdatedAt,
  showLastUpdated,
  className,
}: {
  name: string;
  lastUpdatedAt?: Date | string | null;
  showLastUpdated?: boolean;
  className?: string;
}) {
  const { usesLightText, palette } = useViewerSurfaceTheme();
  const { t, i18n } = useTranslation("dataroom");
  const activeLocale = asSupportedLocale(i18n.language) ?? DEFAULT_LOCALE;

  return (
    <div className={cn("min-w-0", className)}>
      <div
        className={cn(
          "text-3xl",
          !usesLightText && "text-foreground",
        )}
        style={usesLightText ? { color: palette.textColor } : undefined}
      >
        {name}
      </div>
      {showLastUpdated && lastUpdatedAt ? (
        <time
          className={cn(
            "mt-0.5 block text-sm",
            !usesLightText && "text-muted-foreground",
          )}
          dateTime={new Date(lastUpdatedAt).toISOString()}
          style={
            usesLightText ? { color: palette.mutedTextColor } : undefined
          }
        >
          {t("shell.lastUpdated", "Last updated {{date}}", {
            date: formatDateLocalized(lastUpdatedAt, activeLocale),
          })}
        </time>
      ) : null}
    </div>
  );
}
