import { NextApiRequest, NextApiResponse } from "next";

import { getServerSession } from "next-auth/next";

import { enforceDocumentMemberScope } from "@/shared/utils/api/rbac/guard";
import { shouldHavePages } from "@/shared/utils/documents/document-processing";
import { resolvePreviewMode } from "@/shared/utils/documents/preview-mode";
import { getFeatureFlags } from "@/shared/utils/featureFlags";
import { getAdvancedExcelFileUrl } from "@/shared/utils/files/advanced-excel-url";
import { buildInlineDispositionForName } from "@/shared/utils/files/filename";
import { getFile } from "@/shared/utils/files/get-file";
import { signPageLinks } from "@/shared/utils/files/sign-page-links";
import prisma from "@/platform/db";
import { CustomUser } from "@/shared/utils/types";
import { log } from "@/shared/utils/utils";
import { resolveHtmlContentForRender } from "@/shared/utils/utils/html-document";

import { authOptions } from "../../../../auth/[...nextauth]";

const INITIAL_PAGES_TO_LOAD = 10;

export default async function handle(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { id: documentId, teamId } = req.query as {
    id: string;
    teamId: string;
  };
  const userId = (session.user as CustomUser).id;

  // Dataroom-scoped members may only access documents in their assigned rooms.
  if (await enforceDocumentMemberScope({ userId, teamId, documentId, res })) {
    return;
  }

  try {
    const team = await prisma.team.findUnique({
      where: {
        id: teamId,
        users: {
          some: { userId },
        },
      },
    });

    if (!team) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Fetch document and verify team membership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        team: {
          include: {
            users: {
              where: { userId },
              select: { userId: true },
            },
          },
        },
        versions: {
          where: { isPrimary: true },
          select: {
            id: true,
            type: true,
            hasPages: true,
            numPages: true,
            isVertical: true,
            file: true,
            storageType: true,
            pages: {
              // Only fetch the first window of page rows; the rest are signed
              // on-demand via the preview-pages endpoint as the viewer scrolls.
              where: { pageNumber: { lte: INITIAL_PAGES_TO_LOAD } },
              orderBy: { pageNumber: "asc" },
              select: {
                file: true,
                storageType: true,
                pageNumber: true,
                embeddedLinks: true,
                pageLinks: true,
                metadata: true,
              },
            },
          },
        },
      },
    });

    // Check if document exists and user is team member
    if (!document || document.team.users.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const primaryVersion = document.versions[0];
    if (!primaryVersion) {
      return res.status(404).json({ message: "Document version not found" });
    }

    // Never trust `hasPages` alone: a legacy row can claim pages exist while no
    // (or too few) DocumentPage rows were actually created. Only serve the page
    // viewer when real generated pages match the declared page count.
    const generatedPageCount = await prisma.documentPage.count({
      where: { versionId: primaryVersion.id },
    });

    const previewMode = resolvePreviewMode({
      type: primaryVersion.type,
      file: primaryVersion.file,
      hasPages: primaryVersion.hasPages,
      numPages: primaryVersion.numPages,
      generatedPageCount,
    });

    const isPdf =
      primaryVersion.type === "pdf" ||
      primaryVersion.file?.toLowerCase().endsWith(".pdf");

    const numPages = primaryVersion.numPages ?? 0;

    // Prepare return data structure
    const returnData = {
      documentId,
      documentName: document.name,
      documentType: document.type,
      fileType: primaryVersion.type,
      isVertical: primaryVersion.isVertical,
      numPages: primaryVersion.numPages,
      advancedExcelEnabled: document.advancedExcelEnabled,
      isProcessing: false,
      pages: undefined as any,
      file: undefined as string | undefined,
      fallbackFile: undefined as string | undefined,
      sheetData: undefined as any,
      htmlContent: undefined as string | undefined,
    };

    if (previewMode.mode === "pages") {
      // All generated pages exist. Sign URLs for the first window of pages;
      // remaining pages are placeholders fetched on-demand by the client via
      // the preview-pages endpoint.
      const pageRows = new Map(
        primaryVersion.pages.map((page) => [page.pageNumber, page]),
      );

      returnData.pages = [];
      for (let pageNumber = 1; pageNumber <= numPages; pageNumber++) {
        const page = pageRows.get(pageNumber);
        if (page) {
          const { storageType, ...otherPageData } = page;
          const signedLinks = await signPageLinks(otherPageData.pageLinks);
          const fileName = page.file.split("/").pop() || `page-${pageNumber}.jpeg`;
          returnData.pages.push({
            ...otherPageData,
            pageNumber,
            file: await getFile({
              data: page.file,
              type: storageType,
              responseContentDisposition: buildInlineDispositionForName(fileName),
            }),
            ...(signedLinks ? { pageLinks: signedLinks } : {}),
          });
        } else {
          // Placeholder so the viewer can navigate to pages beyond the window.
          returnData.pages.push({ pageNumber, file: null });
        }
      }

      // Give the page viewer an escape hatch to the original PDF if a page
      // image is missing or fails to load.
      if (isPdf) {
        const fileName = primaryVersion.file.split("/").pop() || "document.pdf";
        returnData.fallbackFile = await getFile({
          data: primaryVersion.file,
          type: primaryVersion.storageType,
          responseContentDisposition: buildInlineDispositionForName(fileName),
        });
      }
    } else if (previewMode.mode === "pdf") {
      // Raw PDF: still being converted, never converted, or a legacy row that
      // claims hasPages=true without the matching DocumentPage rows. Serve the
      // original file inline so the browser renders it instead of downloading
      // it; the viewer shows a "generating page previews" banner.
      const fileName = primaryVersion.file.split("/").pop() || "document.pdf";
      const fileUrl = await getFile({
        data: primaryVersion.file,
        type: primaryVersion.storageType,
        responseContentDisposition: buildInlineDispositionForName(fileName),
      });
      returnData.file = fileUrl;
      returnData.fallbackFile = fileUrl;
      returnData.numPages = primaryVersion.numPages || 0;
      returnData.pages = [];
      returnData.isProcessing = shouldHavePages(primaryVersion.type);
    } else if (previewMode.mode === "processing") {
      return res.status(400).json({
        message: "Document is still processing. Please wait and try again.",
      });
    } else if (primaryVersion.type === "image") {
      // Single image files
      returnData.file = await getFile({
        data: primaryVersion.file,
        type: primaryVersion.storageType,
      });
      returnData.numPages = 1;
    } else if (primaryVersion.type === "sheet") {
      if (document.advancedExcelEnabled) {
        // Advanced Excel mode: use Office Online viewer URL
        returnData.file = await getAdvancedExcelFileUrl({
          file: primaryVersion.file,
          storageType: primaryVersion.storageType,
        });
        returnData.numPages = 1;
      }
      // Non-advanced sheets: return 200 with advancedExcelEnabled=false so
      // PreviewViewer renders its inline fallback instead of showing an error.
    } else if (primaryVersion.type === "html") {
      const featureFlags = await getFeatureFlags({ teamId });
      if (!featureFlags.htmlDocuments) {
        return res.status(400).json({
          message: "HTML documents are not enabled for this team.",
        });
      }
      try {
        const fileUrl = await getFile({
          data: primaryVersion.file,
          type: primaryVersion.storageType,
        });
        returnData.htmlContent = await resolveHtmlContentForRender({
          documentId,
          url: fileUrl,
        });
        returnData.numPages = 1;
      } catch (error) {
        console.error("Failed to load HTML document preview:", error);
        return res.status(400).json({
          message:
            error instanceof Error && error.message
              ? error.message
              : "Preview not available for this document",
        });
      }
    } else if (primaryVersion.type === "notion") {
      // Notion documents - preview not supported
      return res.status(400).json({
        message: "Notion document preview coming soon",
      });
    } else {
      return res.status(400).json({
        message: "Preview not available for this document type",
      });
    }

    return res.status(200).json(returnData);
  } catch (error) {
    log({
      message: "Error fetching document preview data",
      type: "error",
      mention: true,
    });
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}
