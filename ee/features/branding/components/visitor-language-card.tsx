import React from "react";
import { Label } from "@/components/ui/label";

export function VisitorLanguageCard({
  defaultLanguage,
  onDefaultLanguageChange,
  hasAccess,
}: any) {
  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <Label htmlFor="visitor-lang" className="text-gray-900 dark:text-gray-100">
        Default Viewer Language
      </Label>
      <select
        id="visitor-lang"
        value={defaultLanguage || "en"}
        onChange={(e) => onDefaultLanguageChange(e.target.value)}
        className="w-full rounded border border-gray-200 bg-white p-2 text-sm text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <option value="en">English (US)</option>
        <option value="es">Español</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
      </select>
    </div>
  );
}
