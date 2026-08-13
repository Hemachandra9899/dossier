import { rgb } from "pdf-lib";

export function hexToRgb(hex: string) {
  let bigint = parseInt(hex.slice(1), 16);
  let r = ((bigint >> 16) & 255) / 255; // Convert to 0-1 range
  let g = ((bigint >> 8) & 255) / 255; // Convert to 0-1 range
  let b = (bigint & 255) / 255; // Convert to 0-1 range
  return rgb(r, g, b);
}
