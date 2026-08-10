import { useRef } from "react";

export function useLogoTone(src: string | null | undefined) {
  const ref = useRef<HTMLImageElement>(null);
  return {
    tone: "light" as "light" | "dark",
    imgProps: { ref },
  };
}
