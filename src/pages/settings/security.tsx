import { useRouter } from "next/router";

import { useEffect, useState } from "react";

import { useTeam } from "@/context/team-context";
import { FolderSync, Info, Shield, ShieldCheckIcon } from "lucide-react";

import { useFeatureFlags } from "@/lib/hooks/use-feature-flags";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { usePlan } from "@/lib/swr/use-billing";

import AppLayout from "@/components/layouts/app";
import { SettingsHeader } from "@/components/settings/settings-header";

const SSO_ELIGIBLE_PLANS = ["datarooms-premium", "datarooms-premium+old", "datarooms-unlimited", "datarooms-unlimited+old"];

export default function SecuritySettings() {
  const router = useRouter();
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;
  const teamPlan = teamInfo?.currentTeam?.plan;
  const { isFeatureEnabled } = useFeatureFlags();
  const { isAdmin, loading: isAdminLoading } = useIsAdmin();
  const { isDataroomsPlus } = usePlan();

  // Redirect non-admin users to general settings
  useEffect(() => {
    if (!isAdminLoading && !isAdmin) {
      router.replace("/settings/general");
    }
  }, [isAdmin, isAdminLoading, router]);

  // Show nothing while checking admin status
  if (isAdminLoading || !isAdmin) {
    return (
      <AppLayout>
        <div />
      </AppLayout>
    );
  }

  const isSSOFeatureEnabled = isFeatureEnabled("sso");
  const isPlanEligible = teamPlan
    ? SSO_ELIGIBLE_PLANS.includes(teamPlan)
    : false;
  const canAccessSSO = isSSOFeatureEnabled && isPlanEligible;

  return (
    <AppLayout>
      <main className="relative mx-2 mb-10 mt-4 space-y-8 overflow-hidden px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        <SettingsHeader />

        <div className="rounded-lg border border-muted p-6 sm:p-10">
          <div className="flex items-start space-x-3">
            <Shield className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-medium">
                SAML SSO &amp; SCIM Directory Sync
              </h2>
              <p className="text-sm text-muted-foreground">
                SAML Single Sign-On and SCIM directory sync are currently disabled.
              </p>
            </div>
          </div>
        </div>

        {/* SOC 2 Section */}
        <div className="rounded-lg border border-muted p-6 sm:p-10">
          <div className="flex items-start space-x-3">
            <ShieldCheckIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="space-y-1">
              <h2 className="text-xl font-medium">SOC 2 Type II Certification</h2>
              <p className="text-sm text-muted-foreground">
                SOC 2 Type II certification ensures that your data is handled
                with the highest security standards. Available on the Data Rooms
                Plus plan and above.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Your team is SOC 2 Type II certified. Contact support for
                certification documents.
              </p>
            </div>
          </div>
        </div>
      </main>
    </AppLayout>
  );
}
