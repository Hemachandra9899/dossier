import { useState } from "react";

import { LinkAudienceType, LinkType } from "@prisma/client";
import { LinkPreset } from "@prisma/client";

import { DEFAULT_LINK_TYPE } from "@/shared/ui/links/link-sheet";
import AgreementSection from "@/shared/ui/links/link-sheet/agreement-section";
import AllowDownloadSection from "@/shared/ui/links/link-sheet/allow-download-section";
import AllowListSection from "@/shared/ui/links/link-sheet/allow-list-section";
import AllowNotificationSection from "@/shared/ui/links/link-sheet/allow-notification-section";
import ConversationSection from "@/shared/ui/links/link-sheet/conversation-section";
import CustomFieldsSection from "@/shared/ui/links/link-sheet/custom-fields-section";
import DenyListSection from "@/shared/ui/links/link-sheet/deny-list-section";
import EmailAuthenticationSection from "@/shared/ui/links/link-sheet/email-authentication-section";
import EmailProtectionSection from "@/shared/ui/links/link-sheet/email-protection-section";
import ExpirationSection from "@/shared/ui/links/link-sheet/expiration-section";
import FeedbackSection from "@/shared/ui/links/link-sheet/feedback-section";
import OGSection from "@/shared/ui/links/link-sheet/og-section";
import PasswordSection from "@/shared/ui/links/link-sheet/password-section";
import { ProBannerSection } from "@/shared/ui/links/link-sheet/pro-banner-section";
import QuestionSection from "@/shared/ui/links/link-sheet/question-section";
import ScreenshotProtectionSection from "@/shared/ui/links/link-sheet/screenshot-protection-section";
import UploadSection from "@/shared/ui/links/link-sheet/upload-section";
import WatermarkSection from "@/shared/ui/links/link-sheet/watermark-section";
import ChevronDown from "@/shared/ui/shared/icons/chevron-down";

export type LinkUpgradeOptions = {
  state: boolean;
  trigger: string;
  plan?: "Pro" | "Business" | "Data Rooms" | "Data Rooms Plus";
  highlightItem?: string[];
};

export const OnboardingLinkOptions = ({
  data,
  setData,
  targetId,
  linkType,
  editLink,
  currentPreset = null,
}: {
  data: DEFAULT_LINK_TYPE;
  setData: React.Dispatch<React.SetStateAction<DEFAULT_LINK_TYPE>>;
  targetId?: string;
  linkType: LinkType;
  editLink?: boolean;
  currentPreset?: LinkPreset | null;
}) => {
  const [showAdvancedSettings, setShowAdvancedSettings] =
    useState<boolean>(false);

  // `handleUpgradeStateChange` is passed to feature sections as a required
  // prop. With billing removed, every feature is unlocked, so it is a no-op.
  const handleUpgradeStateChange = () => {};

  // Basic settings that are always shown
  const basicSettings = (
    <>
      <EmailProtectionSection {...{ data, setData }} />
      <AllowNotificationSection {...{ data, setData }} />
      <AllowDownloadSection {...{ data, setData }} />
      <ExpirationSection {...{ data, setData }} presets={currentPreset} />
      <PasswordSection {...{ data, setData }} />
      {/* Advanced toggle for documents only */}
      {linkType === LinkType.DOCUMENT_LINK && (
        <div className="mb-4 mt-2">
          <button
            type="button"
            className="group flex w-full items-center justify-between text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowAdvancedSettings((v) => !v)}
            aria-expanded={showAdvancedSettings}
          >
            <span className="text-sm font-semibold text-gray-900">
              Advanced settings
            </span>
            <span
              className={`transition-transform ${showAdvancedSettings ? "rotate-180" : ""}`}
            >
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </div>
      )}
    </>
  );

  // Advanced settings that are shown only when showAdvancedSettings is true
  const advancedSettings = (
    <>
      {linkType === LinkType.DATAROOM_LINK && targetId ? (
        <UploadSection
          {...{ data, setData }}
          isAllowed={true}
          handleUpgradeStateChange={handleUpgradeStateChange}
          targetId={targetId}
        />
      ) : null}
      <OGSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
        editLink={editLink ?? false}
        presets={currentPreset}
      />
      <EmailAuthenticationSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      {data.audienceType === LinkAudienceType.GENERAL ? (
        <AllowListSection
          {...{ data, setData }}
          isAllowed={true}
          handleUpgradeStateChange={handleUpgradeStateChange}
          presets={currentPreset}
        />
      ) : null}
      {data.audienceType === LinkAudienceType.GENERAL ? (
        <DenyListSection
          {...{ data, setData }}
          isAllowed={true}
          handleUpgradeStateChange={handleUpgradeStateChange}
          presets={currentPreset}
        />
      ) : null}
      <ScreenshotProtectionSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      <WatermarkSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
        presets={currentPreset}
      />
      <AgreementSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
      />
      {linkType === LinkType.DATAROOM_LINK ? (
        <ConversationSection
          {...{ data, setData }}
          isAllowed={true}
          handleUpgradeStateChange={handleUpgradeStateChange}
        />
      ) : null}
      {linkType === LinkType.DOCUMENT_LINK ? (
        <>
          <FeedbackSection {...{ data, setData }} />
          <QuestionSection
            {...{ data, setData }}
            isAllowed={true}
            handleUpgradeStateChange={handleUpgradeStateChange}
          />
        </>
      ) : null}
      <CustomFieldsSection
        {...{ data, setData }}
        isAllowed={true}
        handleUpgradeStateChange={handleUpgradeStateChange}
        presets={currentPreset}
      />
      {linkType === LinkType.DOCUMENT_LINK ? (
        <ProBannerSection
          {...{ data, setData }}
          isAllowed={true}
          handleUpgradeStateChange={handleUpgradeStateChange}
        />
      ) : null}
    </>
  );

  return (
    <div>
      {basicSettings}
      {showAdvancedSettings && advancedSettings}
    </div>
  );
};
