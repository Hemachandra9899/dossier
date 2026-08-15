// Lazy load heavy components for better performance
import dynamic from "next/dynamic";
import ErrorPage from "next/error";

import { Suspense, useState } from "react";
import useSWR from "swr";

import { useTeam } from "@/features/workspace/providers/workspace-provider";
import { signingApi } from "@/features/signing/ui/signing-api";
import { RequestManagement } from "@/features/signing/ui/request-management";

import { useDocumentLinks } from "@/shared/utils/swr/use-document";
import { useDocumentOverview } from "@/shared/utils/swr/use-document-overview";
import DocumentHeader from "@/shared/ui/documents/document-header";
import { DocumentPreviewButton } from "@/features/documents/components/preview/document-preview-button";
// Import placeholder components
import DocumentStatsPlaceholder from "@/shared/ui/documents/document-stats-placeholder";
import LinkDocumentIndicator from "@/shared/ui/documents/link-document-indicator";
import NotionAccessibilityIndicator from "@/shared/ui/documents/notion-accessibility-indicator";
import VideoStatsPlaceholder from "@/shared/ui/documents/video-stats-placeholder";
import AppLayout from "@/shared/ui/layouts/app";
import LinkSheet from "@/shared/ui/links/link-sheet";
import LinksTable from "@/shared/ui/links/links-table";
import { Button } from "@/shared/ui/button";
import LoadingSpinner from "@/shared/ui/loading-spinner";

const StatsComponent = dynamic(
  () =>
    import("@/shared/ui/documents/stats").then((mod) => ({
      default: mod.StatsComponent,
    })),
  {
    loading: () => (
      <div className="flex h-48 animate-pulse items-center justify-center rounded-lg bg-gray-100">
        <LoadingSpinner className="h-6 w-6" />
      </div>
    ),
    ssr: false,
  },
);

const VideoAnalytics = dynamic(
  () => import("@/shared/ui/documents/video-analytics"),
  {
    loading: () => (
      <div className="flex h-48 animate-pulse items-center justify-center rounded-lg bg-gray-100">
        <LoadingSpinner className="h-6 w-6" />
      </div>
    ),
    ssr: false,
  },
);

const VisitorsTable = dynamic(
  () => import("@/shared/ui/visitors/visitors-table"),
  {
    loading: () => (
      <div className="flex h-64 animate-pulse items-center justify-center rounded-lg bg-gray-100">
        <LoadingSpinner className="h-6 w-6" />
      </div>
    ),
    ssr: false,
  },
);

const BulkImportLinksModal = dynamic(
  () =>
    import("@/shared/ui/links/bulk-import-modal").then((mod) => ({
      default: mod.BulkImportLinksModal,
    })),
  { ssr: false },
);

export default function DocumentPage() {
  const {
    data: overview,
    document: prismaDocument,
    primaryVersion,
    limits,
    team,
    isEmpty,
    loading: overviewLoading,
    error,
    mutate: mutateOverview,
  } = useDocumentOverview();

  // Always fetch links to show empty states properly
  const { links, error: linksError, mutate: mutateLinks } = useDocumentLinks();
  const teamInfo = useTeam();
  const teamId = teamInfo?.currentTeam?.id;

  const { data: activeRequestData, mutate: refreshActiveRequest } = useSWR(
    prismaDocument?.id && teamId ? [teamId, prismaDocument.id, "active-request"] : null,
    ([tId, dId]) => signingApi.getActiveRequest({ teamId: tId, documentId: dId }),
    { refreshInterval: 5000 }
  );
  const activeRequest = activeRequestData?.request;

  const [isLinkSheetOpen, setIsLinkSheetOpen] = useState<boolean>(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState<boolean>(false);

  // Mutate function that updates both overview and links
  const mutateDocument = () => {
    mutateOverview();
    mutateLinks();
  };

  if (error && error.status === 400) {
    return <ErrorPage statusCode={400} />;
  }

  const AddLinkButton = () => {
    return (
      <div className="flex items-center gap-2">
        <Button
          className="flex h-8 whitespace-nowrap text-xs lg:h-9 lg:text-sm"
          onClick={() => setIsLinkSheetOpen(true)}
        >
          Create Link
        </Button>
      </div>
    );
  };

  // Show loading only for the initial overview load
  if (overviewLoading) {
    return (
      <AppLayout>
        <main className="relative mx-2 mb-10 mt-4 space-y-8 px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
          <div className="flex h-screen items-center justify-center">
            <LoadingSpinner className="mr-1 h-20 w-20" />
          </div>
        </main>
      </AppLayout>
    );
  }

  if (!prismaDocument || !primaryVersion || !teamId) {
    return (
      <AppLayout>
        <main className="relative mx-2 mb-10 mt-4 space-y-8 px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
          <div className="flex h-screen items-center justify-center">
            <LoadingSpinner className="mr-1 h-20 w-20" />
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="relative mx-2 mb-10 mt-4 space-y-8 px-1 sm:mx-3 md:mx-5 md:mt-5 lg:mx-7 lg:mt-8 xl:mx-10">
        {/* Action Header - Shows immediately */}
        <DocumentHeader
          primaryVersion={primaryVersion}
          prismaDocument={prismaDocument}
          teamId={teamId}
          onBulkImportLinks={() => setIsBulkImportOpen(true)}
          actions={[
            <NotionAccessibilityIndicator
              key={"notion-status"}
              documentId={prismaDocument.id}
              primaryVersion={primaryVersion}
              onUrlUpdate={mutateDocument}
            />,
            <LinkDocumentIndicator
              key={"link-status"}
              documentId={prismaDocument.id}
              primaryVersion={primaryVersion}
              onUrlUpdate={mutateDocument}
            />,
            <DocumentPreviewButton
              key={"preview"}
              documentId={prismaDocument.id}
              primaryVersion={primaryVersion}
              advancedExcelEnabled={prismaDocument.advancedExcelEnabled}
              variant="outline"
              size="default"
              showTooltip
              className="h-8 whitespace-nowrap text-xs lg:h-9 lg:text-sm"
            />,
            <AddLinkButton key={"create-link"} />,
          ]}
        />

        {/* Progressive Loading: Always show components, but optimize for empty states */}
        <Suspense
          fallback={
            <div className="h-48 animate-pulse rounded-lg bg-gray-100" />
          }
        >
          {activeRequest ? (
            <RequestManagement
              teamId={teamId}
              requestId={activeRequest.id}
              onStateChange={refreshActiveRequest}
            />
          ) : (
            <>
              {/* Document Analytics - Always show, lazy loaded if not empty */}
              {primaryVersion.type !== "video" &&
                (isEmpty ? (
                  <DocumentStatsPlaceholder
                    numPages={primaryVersion.numPages || 1}
                    onCreateLink={() => setIsLinkSheetOpen(true)}
                  />
                ) : (
                  <StatsComponent
                    documentId={prismaDocument.id}
                    numPages={primaryVersion.numPages!}
                  />
                ))}

              {/* Video Analytics - Always show, lazy loaded if not empty */}
              {primaryVersion.type === "video" &&
                (isEmpty ? (
                  <VideoStatsPlaceholder
                    length={primaryVersion.length || 51}
                    onCreateLink={() => setIsLinkSheetOpen(true)}
                  />
                ) : (
                  <VideoAnalytics
                    documentId={prismaDocument.id}
                    primaryVersion={primaryVersion}
                    teamId={teamId}
                  />
                ))}

              {/* Links - Always show */}
              <LinksTable
                links={links}
                targetType={"DOCUMENT"}
                primaryVersion={primaryVersion}
                mutateDocument={mutateDocument}
                onBulkImportOpen={() => setIsBulkImportOpen(true)}
              />

              {/* Visitors - Always show */}
              <VisitorsTable
                primaryVersion={primaryVersion}
                isVideo={primaryVersion.type === "video"}
              />
            </>
          )}
        </Suspense>

        <LinkSheet
          isOpen={isLinkSheetOpen}
          linkType="DOCUMENT_LINK"
          setIsOpen={setIsLinkSheetOpen}
          existingLinks={links}
        />

        <BulkImportLinksModal
          isOpen={isBulkImportOpen}
          setIsOpen={setIsBulkImportOpen}
          targetType="DOCUMENT"
          targetId={prismaDocument.id}
          onImported={mutateDocument}
        />
      </main>
    </AppLayout>
  );
}
