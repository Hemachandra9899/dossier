import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronLeftIcon, ChevronRightIcon, RefreshCwIcon } from "lucide-react";

import { DocumentPreviewData } from "@/shared/utils/types/document-preview";
import { cn } from "@/shared/utils/utils";

import { Button } from "@/shared/ui/button";

const PRELOAD_RADIUS = 5;
const MAX_AUTO_RETRIES = 2;
const RETRY_BACKOFF_MS = 1500;
const IMAGE_TIMEOUT_MS = 25_000;

interface PreviewPagesViewerProps {
  documentData: DocumentPreviewData;
  onClose: () => void;
  pagesApiEndpoint?: string;
  initialPage?: number;
}

export function PreviewPagesViewer({
  documentData,
  onClose,
  pagesApiEndpoint,
  initialPage,
}: PreviewPagesViewerProps) {
  const [currentPage, setCurrentPage] = useState(() =>
    Math.min(Math.max(initialPage ?? 1, 1), documentData.numPages || 1),
  );
  const [pages, setPages] = useState(documentData.pages ?? []);
  const [imageCache, setImageCache] = useState<{ [key: number]: boolean }>({});
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const pagesRef = useRef(pages);
  const pendingRef = useRef<Set<number>>(new Set());
  const refetchedRef = useRef<Set<number>>(new Set());
  const retryCountRef = useRef(0);
  const generationRef = useRef(0);

  const { numPages, documentName } = documentData;

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  useEffect(() => {
    setPages(documentData.pages ?? []);
    pagesRef.current = documentData.pages ?? [];
    pendingRef.current = new Set();
    refetchedRef.current = new Set();
    retryCountRef.current = 0;
    setPageError(null);
    setImageError(false);
    generationRef.current += 1;
  }, [documentData.pages]);

  const ensurePagesLoaded = useCallback(
    async (centerPage: number) => {
      if (!pagesApiEndpoint) return;

      const generation = generationRef.current;
      const currentPages = pagesRef.current;
      const start = Math.max(1, centerPage - PRELOAD_RADIUS);
      const end = Math.min(numPages, centerPage + PRELOAD_RADIUS);
      const needed: number[] = [];

      for (let i = start; i <= end; i++) {
        if (!currentPages[i - 1]?.file && !pendingRef.current.has(i)) {
          needed.push(i);
        }
      }

      if (needed.length === 0) return;

      needed.forEach((pn) => pendingRef.current.add(pn));
      setPageError(null);

      try {
        const response = await fetch(pagesApiEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageNumbers: needed }),
        });

        if (generationRef.current !== generation) return;

        if (!response.ok) {
          throw new Error(`Failed to load page previews (${response.status})`);
        }

        const data = await response.json();
        if (generationRef.current !== generation) return;

        retryCountRef.current = 0;

        setPages((prev) => {
          const updated = [...prev];
          for (const fetchedPage of data.pages ?? []) {
            const idx = fetchedPage.pageNumber - 1;
            if (idx < 0) continue;
            while (updated.length <= idx) {
              updated.push({ pageNumber: updated.length + 1, file: null });
            }
            updated[idx] = { ...updated[idx], ...fetchedPage };
          }
          return updated;
        });
      } catch (err) {
        if (generationRef.current !== generation) return;

        retryCountRef.current += 1;
        if (retryCountRef.current <= MAX_AUTO_RETRIES) {
          setTimeout(
            () => ensurePagesLoaded(centerPage),
            RETRY_BACKOFF_MS * retryCountRef.current,
          );
        } else {
          setPageError(
            err instanceof Error
              ? err.message
              : "Failed to load page previews. Please try again.",
          );
        }
      } finally {
        if (generationRef.current === generation) {
          needed.forEach((pn) => pendingRef.current.delete(pn));
        }
      }
    },
    [pagesApiEndpoint, numPages],
  );

  useEffect(() => {
    ensurePagesLoaded(currentPage);
  }, [currentPage, ensurePagesLoaded]);

  const goToNextPage = useCallback(() => {
    if (currentPage < numPages) {
      setCurrentPage(currentPage + 1);
    }
  }, [currentPage, numPages]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  }, [currentPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          goToPreviousPage();
          break;
        case "ArrowRight":
          goToNextPage();
          break;
        case "Escape":
          onClose();
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goToPreviousPage, goToNextPage, onClose]);

  const currentPageData = pages[currentPage - 1];
  const hasFileUrl = !!currentPageData?.file;

  // Reset image state when navigating to a different page.
  useEffect(() => {
    setImageLoaded(imageCache[currentPage] || false);
    setImageError(false);
  }, [currentPage, hasFileUrl, imageCache]);

  // Fail fast when the current page image takes too long to load.
  useEffect(() => {
    if (!hasFileUrl || imageCache[currentPage]) return;

    const timer = setTimeout(() => {
      setImageError(true);
      setImageLoaded(false);
    }, IMAGE_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [currentPage, hasFileUrl, imageCache]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
    setImageCache((prev) => ({ ...prev, [currentPage]: true }));
  };

  const handleImageError = () => {
    // Signed URLs expire; fetch a fresh URL once before surfacing an error.
    if (!refetchedRef.current.has(currentPage)) {
      refetchedRef.current.add(currentPage);
      const idx = currentPage - 1;
      setPages((prev) => {
        const updated = [...prev];
        if (updated[idx]) {
          updated[idx] = { ...updated[idx], file: null };
        }
        return updated;
      });
      pendingRef.current.delete(currentPage);
      ensurePagesLoaded(currentPage);
      return;
    }

    setImageError(true);
    setImageLoaded(false);
  };

  const handleRetry = () => {
    refetchedRef.current.delete(currentPage);
    retryCountRef.current = 0;
    setPageError(null);
    setImageError(false);
    setImageLoaded(false);
    ensurePagesLoaded(currentPage);
  };

  if (!pages || pages.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-gray-400">No pages available for preview</p>
      </div>
    );
  }

  if (!currentPageData) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="text-gray-400">Page not found</p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Navigation Controls */}
      <div className="absolute left-4 top-4 z-50">
        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-3 py-2 text-white">
          <span className="text-sm">
            Page {currentPage} of {numPages}
          </span>
        </div>
      </div>

      {/* Document Title */}
      <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2">
        <div className="rounded-lg bg-black/20 px-3 py-2 text-white">
          <span className="text-sm font-medium">{documentName}</span>
        </div>
      </div>

      {/* Previous Page Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goToPreviousPage}
        disabled={currentPage <= 1}
        className={cn(
          "absolute left-4 top-1/2 z-40 h-12 w-12 -translate-y-1/2 rounded-full bg-black/20 text-white hover:bg-black/40",
          currentPage <= 1 && "cursor-not-allowed opacity-50",
        )}
      >
        <ChevronLeftIcon className="h-6 w-6" />
      </Button>

      {/* Next Page Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={goToNextPage}
        disabled={currentPage >= numPages}
        className={cn(
          "absolute right-4 top-1/2 z-40 h-12 w-12 -translate-y-1/2 rounded-full bg-black/20 text-white hover:bg-black/40",
          currentPage >= numPages && "cursor-not-allowed opacity-50",
        )}
      >
        <ChevronRightIcon className="h-6 w-6" />
      </Button>

      {/* Page Content */}
      <div className="flex h-full w-full items-center justify-center p-4">
        <div className="relative max-h-full max-w-full">
          {!hasFileUrl && !pageError && (
            <div className="flex items-center justify-center p-10">
              <div className="text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <p className="mt-2 text-xs text-gray-400">
                  Loading page {currentPage}…
                </p>
              </div>
            </div>
          )}

          {!hasFileUrl && pageError && (
            <div className="text-center">
              <p className="text-gray-400">{pageError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-3 text-gray-200"
              >
                <RefreshCwIcon className="mr-1 h-3 w-3" /> Retry
              </Button>
            </div>
          )}

          {hasFileUrl && (
            <>
              {(!imageLoaded || imageError) && (
                <div className="absolute inset-0 flex items-center justify-center">
                  {imageError ? (
                    <div className="text-center">
                      <p className="text-gray-400">
                        This page could not be loaded.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRetry}
                        className="mt-3 text-gray-200"
                      >
                        <RefreshCwIcon className="mr-1 h-3 w-3" /> Retry
                      </Button>
                    </div>
                  ) : (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  )}
                </div>
              )}

              <img
                src={currentPageData.file!}
                alt={`Page ${currentPage}`}
                className={cn(
                  "max-h-[calc(100vh-120px)] max-w-full object-contain transition-opacity duration-200",
                  imageLoaded ? "opacity-100" : "opacity-0",
                )}
                onLoad={handleImageLoad}
                onError={handleImageError}
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-4 left-1/2 z-50 -translate-x-1/2">
        <div className="flex items-center gap-2 rounded-lg bg-black/20 px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage <= 1}
            className="h-8 px-3 text-white hover:bg-white/10"
          >
            Previous
          </Button>

          <span className="text-sm text-white">
            {currentPage} / {numPages}
          </span>

          <Button
            variant="ghost"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage >= numPages}
            className="h-8 px-3 text-white hover:bg-white/10"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
