import { cn } from "@/shared/utils/utils";

import { productConfig } from "@/shared/config/product";

export function ProductLogo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <img
        src={productConfig.logo}
        alt={`${productConfig.name} logo`}
        className="h-7 w-7"
      />
      {showWordmark && (
        <span className="text-lg font-semibold tracking-tight text-foreground">
          {productConfig.name}
        </span>
      )}
    </span>
  );
}
