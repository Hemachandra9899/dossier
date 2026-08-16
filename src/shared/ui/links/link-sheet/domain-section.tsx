import {
  Dispatch,
  SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { mutate } from "swr";
import { useLimits } from "@/shared/utils/swr/use-limits";
import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { useEntitlements } from "@/features/access";
import { BLOCKED_PATHNAMES } from "@/shared/utils/constants";
import { generateRandomSlug } from "@/shared/utils/utils";
import { cn } from "@/shared/utils/utils";
import { Domain, LinkType } from "@prisma/client";
import { DomainConfigurationModal } from "@/shared/ui/domains/domain-configuration-modal";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { BadgeTooltip } from "@/shared/ui/tooltip";
import { DEFAULT_LINK_TYPE } from ".";

function getDefaultDomain(): string {
  if (typeof window !== "undefined") {
    return window.location.host;
  }
  if (process.env.NEXT_PUBLIC_BASE_URL) {
    try {
      return new URL(process.env.NEXT_PUBLIC_BASE_URL).host;
    } catch {
      return process.env.NEXT_PUBLIC_BASE_URL;
    }
  }
  return "localhost:3000";
}

export default function DomainSection({
  data,
  setData,
  domains,
  linkType,
  editLink,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: Dispatch<SetStateAction<DEFAULT_LINK_TYPE>>;
  domains?: Domain[];
  linkType: Omit<LinkType, "WORKFLOW_LINK">;
  editLink?: boolean;
}) {
  const defaultAppDomain = useMemo(() => getDefaultDomain(), []);
  const [isModalOpen, setModalOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState<string>(
    editLink && data.domain ? data.domain : defaultAppDomain,
  );
  const teamInfo = useTeam();
  const { limits } = useLimits();
  const { entitlements } = useEntitlements();

  const canUseCustomDomainForDocument =
    entitlements.customDomains || !!limits?.customDomainOnPro;
  const canUseCustomDomainForDataroom =
    entitlements.customDomains || !!limits?.customDomainInDataroom;

  const isEditingCustomDomain =
    editLink && data.domain && data.domain !== defaultAppDomain ? true : false;

  const generateAndSetSlug = useCallback(() => {
    const newSlug = generateRandomSlug();
    setData((prev) => ({ ...prev, slug: newSlug }));
  }, [setData]);

  const handleDomainChange = (value: string) => {
    const canChangeCustomDomain =
      linkType === "DOCUMENT_LINK"
        ? canUseCustomDomainForDocument
        : canUseCustomDomainForDataroom;

    if (isEditingCustomDomain && !canChangeCustomDomain) {
      setDisplayValue(data.domain ?? defaultAppDomain);
      return;
    }

    if (value === "add_domain" || value === "add_dataroom_domain") {
      setModalOpen(true);
      setData((prev) => ({ ...prev, domain: defaultAppDomain }));
      setDisplayValue(defaultAppDomain);
      return;
    }

    if (value !== defaultAppDomain) {
      setData((prev) => ({
        ...prev,
        domain: value,
        ...(!prev.slug && { slug: generateRandomSlug() }),
      }));
      setDisplayValue(value);
      return;
    }

    setData((prev) => ({ ...prev, domain: value }));
    setDisplayValue(value);
  };

  const handleSelectFocus = () => {
    mutate(`/api/teams/${teamInfo?.currentTeam?.id}/domains`);
  };

  useEffect(() => {
    if (domains && !editLink) {
      const defaultDomain = domains.find((domain) => domain.isDefault);

      const canUseCustomDomain =
        (linkType === "DOCUMENT_LINK" && canUseCustomDomainForDocument) ||
        (linkType === "DATAROOM_LINK" && canUseCustomDomainForDataroom);

      const domainValue = canUseCustomDomain
        ? (defaultDomain?.slug ?? defaultAppDomain)
        : defaultAppDomain;

      const isCustomDomain =
        domainValue !== defaultAppDomain && canUseCustomDomain;

      setData((prev) => ({
        ...prev,
        domain: domainValue,
        ...(isCustomDomain && !prev.slug && { slug: generateRandomSlug() }),
      }));

      setDisplayValue(domainValue);
    }
  }, [
    domains,
    editLink,
    linkType,
    setData,
    canUseCustomDomainForDocument,
    canUseCustomDomainForDataroom,
    defaultAppDomain,
  ]);

  const defaultDomain = editLink
    ? (data.domain ?? defaultAppDomain)
    : domains
      ? (domains.find((domain) => domain.isDefault)?.slug ?? defaultAppDomain)
      : defaultAppDomain;

  useEffect(() => {
    setDisplayValue(defaultDomain);
  }, [defaultDomain, editLink]);

  const currentDomain = domains?.find((domain) => domain.slug === data.domain);
  const isDomainVerified = currentDomain?.verified;

  const isSlugInvalid =
    !!data.slug &&
    (!/^[a-zA-Z0-9-]+$/.test(data.slug) ||
      BLOCKED_PATHNAMES.includes(`/${data.slug}`));

  const isDisabled =
    linkType === "DOCUMENT_LINK"
      ? isEditingCustomDomain && !canUseCustomDomainForDocument
      : isEditingCustomDomain && !canUseCustomDomainForDataroom;

  return (
    <>
      <Label htmlFor="link-domain">Domain</Label>
      <div className="flex">
        <Select
          value={displayValue}
          onValueChange={handleDomainChange}
          onOpenChange={handleSelectFocus}
          disabled={isDisabled}
        >
          <SelectTrigger
            className={cn(
              "flex h-10 w-full rounded-none rounded-l-md border border-input bg-white text-foreground placeholder-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-inset focus:ring-muted-foreground dark:border-gray-500 dark:bg-gray-800 focus:dark:bg-transparent sm:text-sm",
              data.domain && data.domain !== defaultAppDomain
                ? ""
                : "border-r-1 rounded-r-md",
            )}
          >
            <SelectValue placeholder="Select a domain" />
          </SelectTrigger>
          <SelectContent className="flex w-full rounded-md border border-input bg-white text-foreground placeholder-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-inset focus:ring-muted-foreground dark:border-gray-500 dark:bg-gray-800 focus:dark:bg-transparent sm:text-sm">
            <SelectItem value={defaultAppDomain} className="hover:bg-muted">
              {defaultAppDomain}
            </SelectItem>
            {linkType === "DOCUMENT_LINK" && (
              <>
                {domains?.map(({ slug }) => (
                  <SelectItem
                    key={slug}
                    value={slug}
                    className="hover:bg-muted hover:dark:bg-gray-700"
                  >
                    {slug}
                  </SelectItem>
                ))}
              </>
            )}
            {linkType === "DATAROOM_LINK" && (
              <>
                {domains?.map(({ slug }) => (
                  <SelectItem
                    key={slug}
                    value={slug}
                    className="hover:bg-muted hover:dark:bg-gray-700"
                  >
                    {slug}
                  </SelectItem>
                ))}
              </>
            )}
            <SelectItem
              className="hover:bg-muted hover:dark:bg-gray-700"
              value={
                linkType === "DOCUMENT_LINK"
                  ? "add_domain"
                  : "add_dataroom_domain"
              }
            >
              Add a custom domain ✨
            </SelectItem>
          </SelectContent>
        </Select>

        {data.domain && data.domain !== defaultAppDomain ? (
          <div className="relative flex min-w-0 flex-1">
            <span className="inline-flex items-center border border-l-0 border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
              /
            </span>
            <Input
              type="text"
              id="link-slug"
              aria-label="Link slug"
              value={data.slug || ""}
              onChange={(e) =>
                setData((prev) => ({ ...prev, slug: e.target.value }))
              }
              placeholder="custom-slug"
              className={cn(
                "h-10 rounded-none border border-l-0 border-input bg-white text-foreground placeholder-muted-foreground focus:border-muted-foreground focus:outline-none focus:ring-inset focus:ring-muted-foreground dark:border-gray-500 dark:bg-gray-800 focus:dark:bg-transparent sm:text-sm",
                data.domain && data.domain !== defaultAppDomain ? "flex" : "",
                isSlugInvalid
                  ? "border-destructive focus:border-destructive"
                  : "",
              )}
            />
            <BadgeTooltip
              content="Generate random slug"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <button
                type="button"
                onClick={generateAndSetSlug}
                className="flex items-center justify-center"
                aria-label="Generate random slug"
              >
                🎲
              </button>
            </BadgeTooltip>
          </div>
        ) : null}
      </div>

      {data.domain && data.domain !== defaultAppDomain && !isDomainVerified ? (
        <p className="mt-1 text-xs text-amber-500">
          This domain is pending DNS verification.
        </p>
      ) : null}

      <DomainConfigurationModal
        isOpen={isModalOpen}
        setIsOpen={setModalOpen}
        linkType={linkType}
      />
    </>
  );
}
