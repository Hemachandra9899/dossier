import React from "react";

export function BrandingPreviewChrome({ name, basePath, urlLabel, params }: any) {
  const { brandColor, accentColor, accentButtonColor, ctaLabel } = params || {};
  return (
    <div
      className="rounded-lg border p-4 space-y-4 shadow-sm"
      style={{ backgroundColor: accentColor || "#ffffff" }}
    >
      <div className="flex items-center gap-2 border-b pb-2 text-xs text-muted-foreground">
        <span>{urlLabel || "papermark.com/view/..."}</span>
      </div>
      <div className="p-6 text-center space-y-3">
        <h3 className="font-bold text-lg" style={{ color: brandColor || "#000000" }}>
          Preview (Live Mock)
        </h3>
        {ctaLabel && (
          <button
            type="button"
            className="px-4 py-2 rounded text-white text-xs"
            style={{ backgroundColor: accentButtonColor || "#000000" }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}
