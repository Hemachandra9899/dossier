import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export function BrandingLinkPreviewForm({
  enabled,
  onEnabledChange,
  title,
  onTitleChange,
  description,
  onDescriptionChange,
  imageUrl,
  onImageChange,
  faviconUrl,
  onFaviconChange,
  inheritanceHint,
}: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="preview-enable">Enable custom preview tags</Label>
        <Switch
          id="preview-enable"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
      {enabled && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="preview-title">Title</Label>
            <Input
              id="preview-title"
              value={title || ""}
              onChange={(e) => onTitleChange(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="preview-desc">Description</Label>
            <Input
              id="preview-desc"
              value={description || ""}
              onChange={(e) => onDescriptionChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
