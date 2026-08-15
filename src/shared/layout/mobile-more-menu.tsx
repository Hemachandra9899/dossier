import Link from "next/link";
import { useRouter } from "next/router";

import { useEffect, useState } from "react";

import { useTeam } from "@/features/workspace/providers/workspace-provider";
import {
  BrushIcon,
  ChevronDownIcon,
  CogIcon,
  ContactIcon,
  XIcon,
} from "lucide-react";

import { useIsAdmin } from "@/shared/utils/hooks/use-is-admin";
import { useSelfMembership } from "@/shared/utils/hooks/use-self-membership";
import { useSlackIntegration } from "@/shared/utils/swr/use-slack-integration";
import { Team } from "@/shared/utils/types";
import { cn } from "@/shared/utils/utils";

import { SlackIcon } from "@/shared/ui/shared/icons/slack-icon";
import { MobileTeamSwitcher } from "./mobile-team-switcher";

interface MobileMoreMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileMoreMenu({ open, onClose }: MobileMoreMenuProps) {
  const router = useRouter();
  const { currentTeam, teams, setCurrentTeam } = useTeam() || {};
  const { isAdmin } = useIsAdmin();
  // Scoped members can't reach team-wide areas (visitors, branding, settings).
  const { isDataroomMember } = useSelfMembership();
  const { integration: slackIntegration } = useSlackIntegration({
    enabled: !!currentTeam?.id,
  });
  const [settingsExpanded, setSettingsExpanded] = useState(() =>
    router.pathname.includes("settings"),
  );

  const switchTeam = (team: Pick<Team, "id" | "name">) => {
    const target = teams?.find((t) => t.id === team.id);
    if (!target || target.id === currentTeam?.id) return;
    setCurrentTeam?.(target);
    onClose();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const settingsSubItems = [
    { label: "General", href: "/settings/general" },
    { label: "Team", href: "/settings/people" },
    { label: "Domains", href: "/settings/domains" },
    { label: "Notifications", href: "/settings/notifications" },
    { label: "Webhooks", href: "/settings/webhooks" },
    { label: "Slack", href: "/settings/slack" },
    ...(isAdmin ? [{ label: "Security", href: "/settings/security" }] : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex touch-manipulation flex-col bg-background pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)] [-webkit-tap-highlight-color:transparent] md:hidden">
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
        <span className="text-lg font-semibold">More</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <XIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4">
        {currentTeam && teams && teams.length > 0 && (
          <MobileTeamSwitcher
            currentTeam={currentTeam}
            teams={teams}
            onSwitch={switchTeam}
          />
        )}

        <div className="space-y-1">
          {!isDataroomMember && (
            <>
              <Link
                href="/visitors"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  router.pathname.includes("visitors")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <ContactIcon className="h-5 w-5" />
                Visitors
              </Link>

              <Link
                href="/branding"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                  router.pathname.includes("branding")
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <BrushIcon className="h-5 w-5" />
                Branding
              </Link>

              {/* Settings with expandable sub-items */}
              <div>
                <button
                  onClick={() => setSettingsExpanded((v) => !v)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                    router.pathname.includes("settings")
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <CogIcon className="h-5 w-5" />
                  Settings
                  <ChevronDownIcon
                    className={cn(
                      "ml-auto h-4 w-4 transition-transform",
                      settingsExpanded && "rotate-180",
                    )}
                  />
                </button>
                {settingsExpanded && (
                  <div className="ml-8 mt-1 space-y-0.5 border-l border-border pl-3">
                    {settingsSubItems.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onClose}
                        className={cn(
                          "block rounded-md px-3 py-2 text-sm transition-colors",
                          router.pathname.includes(
                            sub.href.replace("/settings/", "settings/"),
                          )
                            ? "font-medium text-foreground"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {!slackIntegration && (
                <Link
                  href="/settings/slack"
                  onClick={onClose}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SlackIcon className="h-5 w-5" />
                  Connect Slack
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
