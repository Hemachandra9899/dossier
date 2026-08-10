import { z } from "zod";

export const CARD_LAYOUT_OPTIONS = [
  { value: "LIST", label: "List layout" },
  { value: "GRID", label: "Grid layout" },
  { value: "COMPACT", label: "Compact layout" },
];

export const DataroomCardLayoutSchema = z.enum(["LIST", "GRID", "COMPACT"]);
export const DataroomViewerHeaderStyleSchema = z.enum([
  "DEFAULT",
  "MODERN",
  "NOTION",
  "SPLIT",
]);
export const DataroomViewerLayoutPresetSchema = z.enum([
  "STANDARD",
  "MODERN",
  "MINIMAL",
  "CUSTOM",
]);

export type DataroomCardLayout = "LIST" | "GRID" | "COMPACT" | string;
export type DataroomLayoutCardId = string;
export type DataroomViewerHeaderStyle =
  | "DEFAULT"
  | "MODERN"
  | "NOTION"
  | "SPLIT"
  | string;
export type DataroomViewerLayoutPreset =
  | "STANDARD"
  | "MODERN"
  | "MINIMAL"
  | "CUSTOM";

export function asDataroomCardLayout(v: any): DataroomCardLayout {
  return v || "LIST";
}

export function asDataroomViewerHeaderStyle(v: any): DataroomViewerHeaderStyle {
  return v || "DEFAULT";
}

export function inferDataroomViewerLayoutPreset(opts: any): string {
  return "STANDARD";
}
